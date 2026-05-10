import os
import json
import glob
from pathlib import Path
from pymongo import MongoClient

# Load .env from backend/
try:
    from dotenv import load_dotenv
    # Script is in docs/scripts/, .env is in backend/
    _ENV_PATH = Path(__file__).parent.parent.parent / "backend" / ".env"
    load_dotenv(_ENV_PATH)
except ImportError:
    pass

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/CoreMD")
INPUT_DIR = "docs/generated cases"

EXCLUDED_PARTS = ["PART_1_", "PART_19_", "PART_20_"]

def ingest_cases():
    client = MongoClient(MONGO_URI)
    try:
        db = client.get_database()
        cases_col = db.get_collection("cases")
        questions_col = db.get_collection("case_questions")

        # Ensure indexes
        cases_col.create_index("case_id", unique=True, background=True)
        cases_col.create_index("title", unique=True, background=True)
        questions_col.create_index("case_question_id", unique=True, background=True)

        json_files = glob.glob(os.path.join(INPUT_DIR, "*.json"))

        total_cases_inserted = 0
        total_questions_inserted = 0
        total_cases_skipped = 0

        for file_path in json_files:
            file_name = os.path.basename(file_path)

            # Skip excluded parts
            if any(file_name.startswith(prefix) for prefix in EXCLUDED_PARTS):
                print(f"Skipping excluded file: {file_name}")
                continue

            print(f"Processing: {file_name}")
            with open(file_path, "r", encoding="utf-8") as f:
                data_list = json.load(f)

            for item in data_list:
                case_info = item.get("case")
                questions = item.get("questions", [])

                if not case_info:
                    continue

                # Check if case exists
                if cases_col.find_one({"$or": [{"case_id": case_info["case_id"]}, {"title": case_info["title"]}]}):
                    total_cases_skipped += 1
                else:
                    cases_col.insert_one(case_info)
                    total_cases_inserted += 1
                    
                    # Insert questions only if case was inserted
                    for q in questions:
                        if not questions_col.find_one({"case_question_id": q["case_question_id"]}):
                            questions_col.insert_one(q)
                            total_questions_inserted += 1

        print("\n" + "="*30)
        print(f"Case Ingestion complete!")
        print(f"Total Cases inserted:    {total_cases_inserted}")
        print(f"Total Questions inserted: {total_questions_inserted}")
        print(f"Total Cases skipped:     {total_cases_skipped}")
        print("="*30)

    except Exception as e:
        print(f"Error during ingestion: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    ingest_cases()
