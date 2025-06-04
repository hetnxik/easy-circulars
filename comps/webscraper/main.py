from comps import CustomLogger
from urlscraper import URLScraper
from circular import Circular
from fastapi import Request
from fastapi.responses import JSONResponse
from datetime import datetime
import os
import json
import requests
import re
from pathlib import Path, PosixPath
from comps import MicroService, ServiceRoleType
from neo4j import GraphDatabase
import atexit
import time
from neo4j.exceptions import ServiceUnavailable

logger = CustomLogger("web_scraper")
server_host_ip = os.getenv("SERVER_HOST_IP", "localhost")
server_port = os.getenv("SERVER_PORT", "8000")
dataprep_host_ip = os.getenv("DATAPREP_HOST_IP", "localhost")
dataprep_port = os.getenv("DATAPREP_PORT", "8003")

NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")


class WebScraperService:
    def __init__(self, host="0.0.0.0", port=8002):
        self.host = host
        self.port = port
        self.endpoint = "/v1/scrape"
        self._neo4j_driver = None
        self._connect_neo4j()
        atexit.register(self.close_neo4j_driver)

    def _connect_neo4j(self, max_retries=10, delay=3):
        for attempt in range(1, max_retries + 1):
            try:
                self._neo4j_driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
                self._neo4j_driver.verify_connectivity()
                logger.info(f"Successfully connected to Neo4j at {NEO4J_URI}")
                with self._neo4j_driver.session() as session:
                    session.run("CREATE INDEX circular_core_id IF NOT EXISTS FOR (n:Circular) ON (n.core_id)")
                    session.run("CREATE INDEX circular_title IF NOT EXISTS FOR (n:Circular) ON (n.title)")
                    session.run("CREATE INDEX circular_date IF NOT EXISTS FOR (n:Circular) ON (n.date)")
                    logger.info("Ensured necessary indexes for linking exist.")
                return
            except ServiceUnavailable as e:
                logger.warning(f"Attempt {attempt}/{max_retries}: Neo4j not ready ({e}). Retrying in {delay}s...")
            except Exception as e:
                logger.error(f"Unexpected error while connecting to Neo4j: {e}")
                break
            time.sleep(delay)

        logger.error("Failed to connect to Neo4j after multiple attempts.")
        self._neo4j_driver = None

    def close_neo4j_driver(self):
        if self._neo4j_driver is not None:
            logger.info("Closing Neo4j driver connection.")
            self._neo4j_driver.close()
            self._neo4j_driver = None

    def start(self):
        self.service = MicroService(
            self.__class__.__name__,
            service_role=ServiceRoleType.MEGASERVICE,
            host=self.host,
            port=self.port,
            endpoint=self.endpoint,
        )

        self.service.add_route(self.endpoint, self.handle_request, methods=["POST"])
        self.service.start()

    def _link_circulars_version(self, circular: Circular):
        if not self._neo4j_driver:
            logger.error("Neo4j driver not available. Skipping linking.")
            return
        if not circular._id:
            logger.warning(f"Circular missing _id, cannot store in Neo4j: {circular.url}")
            return
        if not circular.pdf_url:
            logger.warning(f"Circular missing pdf_url, cannot store in Neo4j: {circular.url}")
            return

        neo4j_date = None
        if isinstance(circular.date, datetime):
            neo4j_date = circular.date
        elif isinstance(circular.date, str):
            try:
                neo4j_date = datetime.fromisoformat(circular.date.replace('Z', '+00:00'))
            except ValueError:
                logger.warning(f"Could not parse date string '{circular.date}' for Neo4j. Storing as null.")

        query = """
        MERGE (c:Circular {pdf_url: $pdf_url})
        ON CREATE SET
            c._id = $_id,
            c.title = $title,
            c.core_id = $core_id,
            c.date = CASE WHEN $date IS NOT NULL THEN datetime($date) ELSE null END,
            c.path = $path,
            c.url = $url,
            c.created_at = timestamp()
        ON MATCH SET
            c._id = $_id,
            c.title = $title,
            c.core_id = $core_id,
            c.date = CASE WHEN $date IS NOT NULL THEN datetime($date) ELSE c.date END,
            c.path = $path,
            c.url = $url,
            c.updated_at = timestamp()

        WITH c
        WHERE c.core_id IS NOT NULL AND c.core_id <> ''

        OPTIONAL MATCH (tail:Circular)
        WHERE tail.core_id = c.core_id
        AND tail.title = c.title
        AND NOT EXISTS((tail)-[:VERSION]->())

        WITH c, tail
        WHERE tail IS NOT NULL AND tail <> c
        MERGE (tail)-[r:VERSION {core_id: c.core_id, title: c.title}]->(c)
        """
        params = {
            "pdf_url": circular.pdf_url,
            "_id": circular._id,
            "title": circular.title,
            "core_id": circular.core_id,
            "date": neo4j_date.isoformat() if neo4j_date else None,
            "path": str(PosixPath(circular.path)),
            "url": circular.url,
        }

        try:
            with self._neo4j_driver.session() as session:
                result = session.run(query, params)
                summary = result.consume()
                logger.info(f"Neo4j: Processed node for {circular.pdf_url}. "
                            f"Nodes created: {summary.counters.nodes_created}, "
                            f"Version Relationships created: {summary.counters.relationships_created}, "
                            f"Properties set: {summary.counters.properties_set}")
        except Exception as e:
            logger.error(f"Failed to execute Neo4j query for {circular.pdf_url}: {e}")
            logger.error(f"Query params for failed Neo4j op: {params}")

    def _link_circulars_references(self, circular: Circular):
        if not self._neo4j_driver:
            logger.error("Neo4j driver not available. Skipping linking.")
            return

        with self._neo4j_driver.session() as session:
            for reference_circular_id in circular.references:
                try:
                    result = session.run(
                        """
                        MATCH (ref: Circular)
                        WHERE ref._id ENDS WITH $reference_id
                        OR ref._id STARTS WITH $reference_id
                        RETURN ref._id AS id
                        LIMIT 1
                        """,
                        reference_id=reference_circular_id
                    )
                    record = result.single()
                    if record:
                        full_ref_id = record["id"]
                        session.run(
                            """
                            MATCH (src: Circular {_id: $src_id})
                            MATCH (ref: Circular {_id: $ref_id})
                            MERGE (src)-[:REFERS]->(ref)
                            """,
                            src_id=circular._id,
                            ref_id=full_ref_id
                        )
                        logger.info(f"Linked {circular._id} -> {full_ref_id} with REFERS")
                    else:
                        logger.warning(f"Reference circular with {reference_circular_id} not found.")
                except Exception as e:
                    logger.error(f"Error linking reference {reference_circular_id}: {e}")

    def post_circular_to_api(self, circular: Circular):
        api_date = None
        if isinstance(circular.date, datetime):
            api_date = circular.date.isoformat()
        elif isinstance(circular.date, str):
            api_date = circular.date

        data = {
            '_id': circular._id,
            'core_id': circular.core_id,
            'title': circular.title,
            'tags': getattr(circular, 'tags', []),
            'date': api_date,
            'path': str(circular.path) if circular.path else None,
            'pdf_url': circular.pdf_url
        }
        url = f"http://{server_host_ip}:{server_port}/api/circulars"
        try:
            response = requests.post(url, json=data)
            if response.status_code in [200, 201]:
                logger.info(f"Successfully posted circular {circular._id} to API: {response.status_code}")
            else:
                logger.error(f"Failed to post circular {circular._id} to API: {response.status_code} {response.text}")
        except requests.RequestException as e:
            logger.error(f"Error posting circular {circular._id} to API {url}: {e}")

    def send_request_to_dataprep(self, pdf_local_path: Path):
        url = f"http://{dataprep_host_ip}:{dataprep_port}/v1/dataprep"
        try:
            if not pdf_local_path.is_file():
                logger.error(f"PDF file not found for DataPrep: {pdf_local_path}")
                return

            with open(pdf_local_path, 'rb') as f:
                files = {'files': (pdf_local_path.name, f)}
                data = {'parser_type': getattr(self, 'parser_type', 'lightweight')}
                response = requests.post(url, files=files, data=data)

            if response.status_code == 200:
                logger.info(f"Successfully sent {pdf_local_path.name} to DataPrep: {response.status_code}")
                result = response.json()
                text = result.get("text")
                return text
            else:
                logger.error(f"Failed to send {pdf_local_path.name} to DataPrep: {response.status_code} {response.text}")
        except FileNotFoundError:
            logger.error(f"Error opening PDF file for DataPrep (not found): {pdf_local_path}")
        except requests.RequestException as e:
            logger.error(f"Error sending request to DataPrep {url}: {e}")
        except Exception as e:
            logger.error(f"Unexpected error sending to DataPrep for {pdf_local_path}: {e}")

    def generate_tags_from_text(self, text: str):
        server_host_ip = os.getenv("LLM_SERVER_HOST_IP")
        server_port = os.getenv("LLM_SERVER_PORT")
        model_name = os.getenv("LLM_MODEL_ID")
        use_model_param = os.getenv("LLM_USE_MODEL_PARAM", "false").lower() == "true"

        url = f"http://{server_host_ip}:{server_port}/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Accept": "text/event-stream"
        }

        logger.info("Generating tags...")
        base_prompt = f"""
            Given the following RBI Circular text, identify relevant tags.

            Text: {str(text)}

            CRITICAL INSTRUCTION: You must format your entire response in EXACTLY the following way:

            TAG: [first-tag]
            TAG: [second-tag]
            TAG: [third-tag]
            ...

            Replace [first-tag], [second-tag], etc. with actual tags that are:
            - AT MOST 2 words each
            - ALL LOWERCASE
            - Words SEPARATED BY HYPHENS
            - RELEVANT to the content (no generic fillers)

            IMPORTANT:
            - Generate UP TO 5 tags maximum
            - Include ONLY truly relevant tags - fewer than 5 is acceptable if there aren't enough relevant concepts
            - Each tag must be on its own line with the exact "TAG: " prefix
            - PROVIDE NOTHING ELSE in your response - no explanations, introductions, or JSON

            Your entire response should ONLY contain lines starting with "TAG: " followed by a relevant tag.     
        """    

        data = {
            "messages": [
                {
                    "role": "system",
                    "content": """
                        You are a helpful assistant that always responds with valid JSON.
                    """
                },
                {
                    "role": "user",
                    "content": f"For the given problem statement, return the metadata in JSON format with all the required fields.\n Problem Statement:\n{base_prompt}",
                }
            ],
            "stream": False
        }

        if use_model_param and model_name:
            data["model"] = model_name
        else:
            data["file_name"] = ""

        response = requests.post(url, headers=headers, json=data)
        response_data = json.loads(response.text)
        result = response_data['choices'][0]['message']['content']
        print(result)
        tags = []
        for line in result.strip().split("\n"):
            if line.startswith("TAG: "):
                tag = line[5:].strip()
                if tag:
                    tags.append(tag)
        return tags

    async def handle_request(self, request: Request):
        try:
            data = await request.json()
            month_str = data.get('month')
            year_str = data.get('year')
            day_str = data.get('day')

            if not month_str or not year_str:
                return JSONResponse(content={"error": "Missing 'month' or 'year' in request body"}, status_code=400)

            try:
                month = int(month_str)
                year = int(year_str)
                day = int(day_str) if day_str is not None else None
            except ValueError:
                return JSONResponse(content={"error": "Invalid 'day', 'month', or 'year' format. Ensure they are numbers."}, status_code=400)

            scraper = URLScraper("https://rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx")
            circular_page_urls = scraper.get_circular_by_date(month=month, year=year)
            logger.info(f"Found {len(circular_page_urls)} circular page URLs for {month:02d}/{year}")

            processed_for_criteria_count = 0
            total_evaluated_count = 0

            for page_url in circular_page_urls:
                total_evaluated_count += 1
                try:
                    c = Circular(page_url)
                    c.fetch_metadata()  

                    if not c.pdf_url:
                        logger.warning(f"Skipping circular from {page_url} due to missing PDF URL.")
                        continue
                    if not c._id:  
                        logger.warning(f"Skipping circular from {page_url} due to missing Circular ID (_id) after metadata fetch.")
                        continue

                    
                    if day is not None:  
                        logger.info(f"Day filter active. Requested: Day={day}, Month={month}, Year={year}. For Circular ID: {c._id or page_url}")

                        if c.date and isinstance(c.date, datetime):
                            
                            logger.info(f"Circular {c._id} has date: {c.date.strftime('%Y-%m-%d')} (Actual D={c.date.day}, M={c.date.month}, Y={c.date.year})")

                            
                            matches_day_component = (c.date.day == day)
                            matches_month_component = (c.date.month == month)
                            matches_year_component = (c.date.year == year)

                            is_match = matches_day_component and matches_month_component and matches_year_component

                            if not is_match:
                                logger.info(f"FILTERING MISMATCH: Circular {c._id} (D={c.date.day}, M={c.date.month}, Y={c.date.year}) " +
                                            f"does NOT match Requested (D={day}, M={month}, Y={year}). Skipping.")
                                logger.debug(f"Mismatch details - Day: {matches_day_component}, Month: {matches_month_component}, Year: {matches_year_component}")
                                continue  
                            else:
                                logger.info(f"FILTERING MATCH: Circular {c._id} (D={c.date.day}, M={c.date.month}, Y={c.date.year}) " +
                                            f"MATCHES Requested (D={day}, M={month}, Y={year}). Processing.")
                        else:
                           
                            logger.warning(f"FILTERING SKIPPING (bad/missing date): Circular {c._id or page_url} for day-specific request. " +
                                           f"c.date type: {type(c.date)}, c.date value: '{c.date}'.")
                            continue
                    

                    
                    if c.download_pdf():  
                        logger.info(f"Processing downloaded circular: {c._id} (Date: {c.date.strftime('%Y-%m-%d') if isinstance(c.date, datetime) else c.date})")

                        self._link_circulars_version(c)
                        self._link_circulars_references(c)

                        if c.path:
                            local_pdf_path_for_dataprep = Path(c.path)
                            root = Path(__file__).parent.parent.parent
                            actual_local_path = root / "ui" / "public" / str(local_pdf_path_for_dataprep).lstrip('/')

                            if actual_local_path.is_file():
                                text = self.send_request_to_dataprep(actual_local_path)
                                c.tags = self.generate_tags_from_text(text)
                            else:
                                logger.error(f"Constructed local path for DataPrep does not exist or is not a file: {actual_local_path} (original c.path: {c.path})")
                        else:
                            logger.warning(f"Skipping DataPrep for {c._id} because c.path is not set.")

                        self.post_circular_to_api(c)

                        processed_for_criteria_count += 1
                    else:
                        logger.error(f"Failed to download PDF for circular: {c.url}")

                except Exception as inner_e:
                    logger.error(f"Error processing individual circular page {page_url}: {inner_e}", exc_info=True)

            return JSONResponse(
                content={
                    "status": "success",
                    "message": f"Processed circulars for {month:02d}/{year}" + (f"/{day:02d}" if day is not None else ""),
                    "urls_found_for_month_index": len(circular_page_urls),
                    "circulars_matching_criteria_processed": processed_for_criteria_count,
                    "total_circular_urls_evaluated_from_month_index": total_evaluated_count
                },
                status_code=200
            )
        except Exception as e:
            logger.error(f"Error handling scrape request: {e}", exc_info=True)
            return JSONResponse(
                content={"status": "error", "message": str(e)},
                status_code=500
            )


if __name__ == "__main__":
    print(f"Starting WebScraperService on port 8002...")
    print(f"Connecting to Neo4j at: {NEO4J_URI}")
    print(f"API Server endpoint: http://{server_host_ip}:{server_port}/api/circulars")
    print(f"DataPrep endpoint: http://{dataprep_host_ip}:{dataprep_port}/v1/dataprep")

    web_scraper_service = WebScraperService(port=8002)
    web_scraper_service.start()