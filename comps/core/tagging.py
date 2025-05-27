import logging
import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

class TagGenerator:
    def __init__(self, text: str):
        self.text = text
        self.tags = []

    def generate_tags(self, text, tokenizer, model, device, max_new_tokens=150, num_tags=5):
        logger.info("Generating tags from text input")

        prompt = (
        "Extract the most relevant and technical tags from the following text, "
        "ensuring they are specific to the domain of the content.\n\n"
        "The tags must meet the following conditions:\n"
        "- All tags should be in lowercase.\n"
        "- If a tag consists of multiple words, replace spaces with hyphens between words.\n"
        "- Tags should not contain any symbols or special characters apart from hyphens.\n"
        "- Generate exactly {num_tags} tags, ordered from most relevant to least relevant.\n\n"
        f"{text}\n\n"
        "Output the tags as a JSON list without additional explanation."
        )

        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ]
        
        text_input = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        model_inputs = tokenizer([text_input], return_tensors="pt").to(device)

        logger.info("Processing input through the model")

        with torch.no_grad():  
            generated_ids = model.generate(
                model_inputs.input_ids,
                max_new_tokens=max_new_tokens
            )

        output = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]

        try:
            start = output.find("[")
            end = output.find("]") + 1
            raw_tags = json.loads(output[start:end])  
            self.tags = [tag.replace("_", "-").lower() for tag in raw_tags]
            logger.info(f"Tags generated successfully: {self.tags}")
            return self.tags
        except json.JSONDecodeError as e:
            logger.error(f"JSON Error: {e}\nOutput: {output}")
            return []

def load_model():
    logger.info("Loading model and tokenizer")
    device = "cuda" if torch.cuda.is_available() else "cpu"

    model = AutoModelForCausalLM.from_pretrained(
        "Qwen/Qwen2-1.5B-Instruct",
        torch_dtype="auto",
        device_map="auto",  
        trust_remote_code=True
    )

    tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2-1.5B-Instruct")
    logger.info(f"Model loaded on {device}")
    
    return model, tokenizer, device  

model, tokenizer, device = load_model()

def generate_tags_from_file(text: str):
    try:       
        if text == "":              
            logger.warning("Text is empty.")
        if not text.strip():        
            logger.warning("Text contains only whitespace.")

        try:
            tag_object = TagGenerator(text)
            tag_object.generate_tags(text, tokenizer, model, device, max_new_tokens=150, num_tags=5)
            logger.info(f"Generated tags: {tag_object.tags}")
        except Exception as gen_error:
            logger.error(f"Tag generation failed: {gen_error}")

        if not tag_object.tags:
            logger.warning("Tag generation returned an empty list.")
        logger.info(f"Tags saved to database")

        return tag_object.tags
    except Exception as e:
        logger.error(f"Unexpected error: {e}")