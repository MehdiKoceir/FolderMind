import json
import urllib.request
import urllib.error

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "llama3.2"

class OllamaConnectionError(Exception):
    """Raised when Ollama cannot be reached."""
    pass

def check_ollama_status():
    """Checks if Ollama is running and responsive."""
    try:
        # Check standard health endpoint or tag endpoint
        req = urllib.request.Request("http://localhost:11434/")
        with urllib.request.urlopen(req, timeout=2) as response:
            return response.status == 200
    except Exception:
        return False

def analyze_file_content(filename, file_text, model=DEFAULT_MODEL, is_retry=False):
    """
    Sends file text to Ollama for summarization and categorization.
    Configures format='json' to ensure a structured JSON response.
    Returns: {"summary": "...", "category": "...", "tags": ["...", "..."]}
    """
    if not check_ollama_status():
        raise OllamaConnectionError("Ollama is not running or accessible on localhost:11434.")

    system_prompt = (
        "You are an expert file organizer AI. "
        "Analyze the following file text and provide metadata in JSON format.\n"
        "The output MUST be a single JSON object with EXACTLY these fields:\n"
        "{\n"
        '  "summary": "1-2 sentences summarizing the document content.",\n'
        '  "category": "A single word or short phrase representing the category. Use a standard taxonomy '
        'like Documents, Code, Finance, Personal, Work, Education, Notes, or create a specific new one if nothing fits.",\n'
        '  "tags": ["3 to 5 relevant keyword tags, lowercase"]\n'
        "}\n"
        "Return ONLY the JSON. Do not include any introductory or concluding text, markdown code blocks, or extra notes."
    )

    prompt = f"Filename: {filename}\nContent:\n{file_text}"

    data = {
        "model": model,
        "prompt": f"{system_prompt}\n\nDocument to analyze:\n{prompt}",
        "stream": False,
        "format": "json" # Ensures Ollama returns valid JSON
    }

    try:
        req_data = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(
            OLLAMA_URL,
            data=req_data,
            headers={'Content-Type': 'application/json'}
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            res_body = response.read().decode('utf-8')
            res_json = json.loads(res_body)
            raw_response = res_json.get("response", "").strip()
            
            # Parse the inner JSON response
            parsed_metadata = json.loads(raw_response)
            
            # Validate keys
            if "summary" not in parsed_metadata or "category" not in parsed_metadata or "tags" not in parsed_metadata:
                raise ValueError("Response JSON is missing required fields.")
                
            if not isinstance(parsed_metadata["tags"], list):
                if isinstance(parsed_metadata["tags"], str):
                    parsed_metadata["tags"] = [t.strip() for t in parsed_metadata["tags"].split(",") if t.strip()]
                else:
                    parsed_metadata["tags"] = []

            # Clean category to capitalize nicely
            cat = str(parsed_metadata["category"]).strip().title()
            parsed_metadata["category"] = cat if cat else "Other"
            
            return parsed_metadata
            
    except (urllib.error.URLError, ConnectionError) as e:
        raise OllamaConnectionError(f"Failed to communicate with Ollama: {str(e)}")
    except Exception as e:
        if not is_retry:
            print(f"Ollama parsing failed: {str(e)}. Retrying once...")
            # Simple retry once with simpler instruction
            return analyze_file_content(filename, file_text, model, is_retry=True)
        else:
            print(f"Ollama failed on retry: {str(e)}. Falling back to uncategorized.")
            # Fallback output
            return {
                "summary": "AI processing failed. Could not generate automated summary.",
                "category": "Uncategorized",
                "tags": ["error", "fallback"]
            }
