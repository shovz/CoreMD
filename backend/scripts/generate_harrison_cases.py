import asyncio
import json
import os
import re
import sys
import uuid
from pathlib import Path
from notebooklm import NotebookLMClient
from pymongo import MongoClient

try:
    from rapidfuzz import fuzz
except ImportError:
    fuzz = None

# Load .env from backend/ to get MONGO_URI
try:
    from dotenv import load_dotenv
    # Script is in docs/scripts/, .env is in backend/
    _ENV_PATH = Path(__file__).parent.parent.parent / "backend" / ".env"
    load_dotenv(_ENV_PATH)
except ImportError:
    pass

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/CoreMD")

# Configuration
NOTEBOOK_ID = os.getenv("NOTEBOOK_ID")
SCRIPT_DIR = Path(__file__).parent.resolve()
ROOT_DIR = SCRIPT_DIR.parent.parent
OUTPUT_DIR = ROOT_DIR / "docs" / "generated cases"
CASES_PER_SOURCE = 5
EXCLUDED_PARTS = ["PART_1_", "PART_19_", "PART_20_"]

# Prompt template to ensure strict JSON output and schema compliance
PROMPT_TEMPLATE = """
Please generate {num_cases} clinical case(s) strictly based on the content of the document titled '{source_title}'.
Each case must include:
1. Full clinical context (Presentation, History, Physical Exam, Labs, Imaging, Discussion, Diagnosis, Management).
2. Two sequential multiple-choice questions:
   - Question 1 (Step 1): Focus on DIAGNOSIS.
   - Question 2 (Step 2): Focus on MANAGEMENT or TREATMENT of the confirmed diagnosis.

CRITICAL INSTRUCTIONS:
1. The case content and the questions MUST NOT contain any references to the document title, file name, or phrases like "According to the text", "In this document", etc.
2. You must provide a `chapter_ref` field that identifies the specific Harrison's Book chapter this case is based on.
   FORMAT: chapter_ref MUST be formatted as 'pXX_cYYY' where XX is the 2-digit part number and YYY is the 3-digit chapter number (e.g., 'p06_c238').

You MUST return your answer ONLY as a valid JSON array. No preamble, no intro text, no markdown code block markers. Just the raw JSON array.

The JSON array must contain exactly {num_cases} object(s). Each object must follow this structure:
{{
    "case": {{
        "title": "Concise clinical title",
        "specialty": "The medical specialty (e.g., Cardiology)",
        "presentation": "Current symptoms and vital signs",
        "history": "Past medical history, medications, social history",
        "physical_exam": "Key physical findings",
        "labs": "Laboratory results",
        "imaging": "Imaging findings (if applicable, or 'N/A')",
        "discussion": "Short clinical summary/pearls",
        "diagnosis": "The final diagnosis",
        "management": "Correct management plan",
        "chapter_ref": "pXX_cYYY"
    }},
    "questions": [
        {{
            "step": 1,
            "stem": "The diagnosis question stem based on presentation/labs/imaging",
            "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
            "correct_option": 0, // 0-indexed int
            "explanation": "Why the correct answer is correct",
            "option_explanations": ["Reason for A", "Reason for B", "Reason for C", "Reason for D"]
        }},
        {{
            "step": 2,
            "stem": "The management question stem referencing the confirmed diagnosis",
            "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
            "correct_option": 0, // 0-indexed int
            "explanation": "Why the correct answer is correct",
            "option_explanations": ["Reason for A", "Reason for B", "Reason for C", "Reason for D"]
        }}
    ]
}}
"""

async def generate_cases():
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Connect to MongoDB for duplicate checking
    try:
        mongo_client = MongoClient(MONGO_URI)
        db = mongo_client.get_database()
        cases_col = db["cases"]
        mongo_client.admin.command('ping')
        print(f"Connected to MongoDB at {MONGO_URI}")
    except Exception as e:
        print(f"Warning: Could not connect to MongoDB. Error: {e}")
        cases_col = None

    try:
        async with await NotebookLMClient.from_storage() as client:
            print(f"Connected to NotebookLM. Target Notebook: {NOTEBOOK_ID}")

            # Fetch sources for the notebook
            sources = await client.sources.list(NOTEBOOK_ID)
            if not sources:
                print("No sources found in the notebook.")
                return

            print(f"Found {len(sources)} sources. Starting generation...")

            for source in sources:
                safe_title = re.sub(r'[^a-zA-Z0-9_\-]', '_', source.title)

                # Check exclusion list
                if any(safe_title.startswith(prefix) for prefix in EXCLUDED_PARTS):
                    print(f"Skipping excluded source: {source.title} (safe_title: {safe_title})")
                    continue

                print(f"\n--- Processing: {source.title} ---")

                # Check if file already exists locally
                output_file = os.path.join(OUTPUT_DIR, f"{safe_title}.json")

                existing_data = []
                if os.path.exists(output_file):
                    print(f"Loading existing cases from {output_file}")
                    with open(output_file, "r", encoding="utf-8") as f:
                        try:
                            existing_data = json.load(f)
                            print(f"Found {len(existing_data)} existing cases.")
                        except json.JSONDecodeError:
                            print(f"Could not parse existing file {output_file}, starting fresh.")
                            existing_data = []

                if len(existing_data) >= 10: # Limit per source
                    print(f"Skipping {source.title}, already has {len(existing_data)} cases.")
                    continue

                prompt = PROMPT_TEMPLATE.format(source_title=source.title, num_cases=CASES_PER_SOURCE)

                print(f"Requesting {CASES_PER_SOURCE} cases for '{source.title}'...")

                # Retry logic
                max_retries = 2
                for attempt in range(max_retries + 1):
                    try:
                        result = await client.chat.ask(NOTEBOOK_ID, prompt)
                        raw_answer = result.answer.strip()

                        # Extract JSON array
                        match = re.search(r'(\[.*\])', raw_answer, re.DOTALL)
                        clean_json = match.group(1) if match else raw_answer
                        if clean_json.startswith("```"):
                            clean_json = re.sub(r'^```(?:json)?\s*', '', clean_json)
                            clean_json = re.sub(r'\s*```$', '', clean_json)

                        raw_data = json.loads(clean_json)
                        if not isinstance(raw_data, list):
                            print(f"Error: AI response is not a list for {source.title}")
                            break

                        final_data = []
                        for item in raw_data:
                            case_info = item.get("case", {})
                            title = case_info.get("title", "").strip()
                            if not title:
                                continue

                            # Duplication check in DB (Exact + Fuzzy)
                            if cases_col is not None:
                                # 1. Exact match
                                if cases_col.find_one({"title": title}):
                                    print(f"Skipping exact duplicate in DB: {title[:50]}...")
                                    continue

                                # 2. Fuzzy match
                                if fuzz:
                                    specialty = case_info.get("specialty", "")
                                    candidates = list(cases_col.find({"specialty": specialty}, {"title": 1}).limit(200))

                                    is_fuzzy_dupe = False
                                    for cand in candidates:
                                        score = fuzz.token_set_ratio(title, cand["title"])
                                        if score > 85:
                                            print(f"Skipping fuzzy duplicate ({score:.1f}%): {title[:50]}...")
                                            is_fuzzy_dupe = True
                                            break
                                    if is_fuzzy_dupe:
                                        continue

                            # Assign IDs
                            cid = f"case_{uuid.uuid4().hex[:12]}"
                            item["case"]["case_id"] = cid

                            for i, q in enumerate(item.get("questions", [])):
                                q["case_id"] = cid
                                q["case_question_id"] = f"cq_{cid}_s{q.get('step', i+1)}"

                            final_data.append(item)

                        # Save
                        if final_data:
                            all_data = existing_data + final_data
                            with open(output_file, "w", encoding="utf-8") as f:
                                json.dump(all_data, f, indent=4, ensure_ascii=False)
                            print(f"Successfully saved {len(final_data)} new cases to {output_file} (Total: {len(all_data)})")
                        else:
                            print(f"No new cases generated for {source.title}")
                        break

                    except json.JSONDecodeError as e:
                        if attempt < max_retries:
                            print(f"JSON Parse error, retrying ({attempt+1}/{max_retries})...")
                            continue
                        print(f"Failed to parse JSON for {source.title}: {e}")
                    except Exception as e:
                        if "timeout" in str(e).lower() and attempt < max_retries:
                            print(f"Timeout, retrying ({attempt+1}/{max_retries})...")
                            await asyncio.sleep(5)
                            continue
                        print(f"An error occurred: {e}")
                        break
    except Exception as e:
        print(f"Critical error: {e}")

if __name__ == "__main__":
    asyncio.run(generate_cases())
