from comps import CustomLogger
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable
from fastapi import HTTPException, Request
import os
import time

logger = CustomLogger("neo4j_operations")

NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

neo4j_driver = None

for attempt in range(1, 10):
    try:
        neo4j_driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        neo4j_driver.verify_connectivity()
        logger.info(f"Successfully connected to Neo4j at {NEO4J_URI}")
        break
    except ServiceUnavailable as e:
        logger.warning(f"Attempt {attempt}/10: Neo4j not ready ({e}). Retrying in 3s...")
    except Exception as e:
        logger.error(f"Unexpected error while connecting to Neo4j: {e}")
        break
    time.sleep(3)

async def handle_circular_get_references(request: Request):
    try:
        circular_id = request.query_params.get("circular_id")
        if not circular_id:
            raise HTTPException(status_code=400, detail="Missing 'circular_id' in request")
        
        if not neo4j_driver:
            logger.error("Neo4j driver not available.")
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        with neo4j_driver.session() as session:
            result = session.run(
                """
                MATCH (c:Circular {_id: $circular_id})-[r:REFERS]->(references)
                RETURN references
                ORDER BY references.date DESC
                """,
                circular_id=circular_id
            )
            references = []
            for record in result:
                reference_node = record["references"]
                references.append({
                    "circular_id": reference_node.get("_id"),
                    "title": reference_node.get("title"),
                    "date": reference_node.get("date").to_native().strftime("%Y-%m-%d"),
                    "path": reference_node.get("path"),
                })
            
            return {"references": references}
    
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.exception("Unexpected error while fetching references.")
        raise HTTPException(status_code=500, detail="Internal server error")
    
async def handle_circular_get_versions(request: Request):
    try:
        circular_id = request.query_params.get("circular_id")
        core_id = request.query_params.get("core_id")
        title = request.query_params.get("title")

        if not all([circular_id, core_id, title]):
            raise HTTPException(status_code=400, detail="Missing required parameters in request")
        
        if not neo4j_driver:
            logger.error("Neo4j driver not available.")
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        with neo4j_driver.session() as session:
            result = session.run(
                """
                MATCH (c:Circular)-[rel:VERSION]-(v:Circular)
                WHERE v._id <> $circular_id
                AND rel.core_id = $core_id
                AND rel.title = $title
                RETURN v
                ORDER BY v.date DESC
                """,
                circular_id=circular_id,
                core_id=core_id,
                title=title
            )
            seen_ids = set()
            versions = []
            for record in result:
                v_node = record["v"]
                node_id = v_node.get("_id")
                if node_id in seen_ids:
                    continue
                seen_ids.add(node_id)
                versions.append({
                    "circular_id": v_node.get("_id"),
                    "title": v_node.get("title"),
                    "date": v_node.get("date").to_native().strftime("%Y-%m-%d"),
                    "path": v_node.get("path"),
                })
            
            return {"versions": versions}
    
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.exception("Unexpected error while fetching versions.")
        raise HTTPException(status_code=500, detail="Internal server error")
