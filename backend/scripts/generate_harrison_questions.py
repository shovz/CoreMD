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
OUTPUT_DIR = ROOT_DIR / "docs" / "generated questions"
QUESTIONS_PER_SOURCE = 20
EXCLUDED_PARTS = ["PART_1_", "PART_19_", "PART_20_"]

# Prompt template to ensure strict JSON output and schema compliance
PROMPT_TEMPLATE = """
Please generate {num_questions} multiple-choice question(s) strictly based on the content of the document titled '{source_title}'.
The question(s) should represent different levels of difficulty: include easy, medium, and hard questions.

CRITICAL INSTRUCTIONS:
1. The question text (`stem`) and the `explanation` MUST NOT contain any references to the document title, file name, or phrases like "According to the text", "In this document",
 "In this part", etc. Treat the question as a standalone medical board exam question.
2. In the `explanation`, explain the medical reasoning clearly without referring to any specific files or documents.
3. You must provide a `chapter_ref` field that identifies the specific Harrison's Book chapter this question is based on.
   FORMAT: chapter_ref MUST be formatted as 'pXX_cYYY' where XX is the 2-digit part number and YYY is the 3-digit chapter number (e.g., 'p06_c238').

You MUST return your answer ONLY as a valid JSON array. No preamble, no intro text, no markdown code block markers (like ```json). Just the raw JSON array.

The JSON array must contain exactly {num_questions} object(s). Each object must follow this structure:
{{
    "stem": "The medical question text (NO file references)",
    "options": [
        "A. Option 1",
        "B. Option 2",
        "C. Option 3",
        "D. Option 4"
    ],
    "correct_option": 0, // Integer index (0-3) corresponding to the correct option
    "explanation": "Detailed medical explanation (NO file references)",
    "chapter_ref": "pXX_cYYY",
    "topic": "General specialty/topic (e.g., Cardiology)",
    "difficulty": "medium" // easy, medium, or hard
}}
"""

async def generate_questions():
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Connect to MongoDB for duplicate checking
    try:
        mongo_client = MongoClient(MONGO_URI)
        db = mongo_client.get_database() # Uses database from URI or default
        questions_col = db["questions"]
        # Basic check to see if we can connect
        mongo_client.admin.command('ping')
        print(f"Connected to MongoDB at {MONGO_URI}")
    except Exception as e:
        print(f"Warning: Could not connect to MongoDB. Duplication check will be skipped. Error: {e}")
        questions_col = None

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

                existing_questions = []
                if os.path.exists(output_file):
                    print(f"Loading existing questions from {output_file}")
                    with open(output_file, "r", encoding="utf-8") as f:
                        try:
                            existing_questions = json.load(f)
                            print(f"Found {len(existing_questions)} existing questions.")
                        except json.JSONDecodeError:
                            print(f"Could not parse existing file {output_file}, starting fresh.")
                            existing_questions = []
                
                if len(existing_questions) >= 40:
                    print(f"Skipping {source.title}, already has {len(existing_questions)} questions.")
                    continue

                prompt = PROMPT_TEMPLATE.format(source_title=source.title, num_questions=QUESTIONS_PER_SOURCE)

                print(f"Requesting {QUESTIONS_PER_SOURCE} questions for '{source.title}'...")

                # Retry logic for timeouts or transient errors
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

                        raw_questions = json.loads(clean_json)
                        if not isinstance(raw_questions, list):
                            print(f"Error: AI response is not a list for {source.title}")
                            break

                        final_questions = []
                        for q in raw_questions:
                            stem = q.get("stem", "").strip()
                            if not stem:
                                continue

                            # Duplication check in MongoDB (Exact + Fuzzy)
                            if questions_col is not None:
                                # 1. Exact match
                                if questions_col.find_one({"stem": stem}):
                                    print(f"Skipping exact duplicate in DB: {stem[:50]}...")
                                    continue

                                # 2. Fuzzy match
                                if fuzz:
                                    topic = q.get("topic", "")
                                    candidates = list(questions_col.find({"topic": topic}, {"stem": 1}).limit(200))

                                    is_fuzzy_dupe = False
                                    for cand in candidates:
                                        score = fuzz.token_set_ratio(stem, cand["stem"])
                                        if score > 85:
                                            print(f"Skipping fuzzy duplicate ({score:.1f}%): {stem[:50]}...")
                                            is_fuzzy_dupe = True
                                            break
                                    if is_fuzzy_dupe:
                                        continue

                            # Assign ID
                            q["question_id"] = f"q_{uuid.uuid4().hex[:12]}"
                            final_questions.append(q)

                        # Save
                        if final_questions:
                            all_questions = existing_questions + final_questions
                            with open(output_file, "w", encoding="utf-8") as f:
                                json.dump(all_questions, f, indent=4, ensure_ascii=False)
                            print(f"Successfully saved {len(final_questions)} new questions to {output_file} (Total: {len(all_questions)})")
                        else:
                            print(f"No new questions generated (all were duplicates or empty) for {source.title}")
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
    asyncio.run(generate_questions())
