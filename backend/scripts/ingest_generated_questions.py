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
INPUT_DIR = "docs/generated questions"

EXCLUDED_PARTS = ["PART_1_", "PART_19_", "PART_20_"]

def ingest_questions():
    client = MongoClient(MONGO_URI)
    try:
        # Get database name from URI or default
        db = client.get_database()
        collection = db.get_collection("questions")
        
        # Ensure index
        collection.create_index("question_id", unique=True, background=True)
        collection.create_index("stem", unique=True, background=True)

        json_files = glob.glob(os.path.join(INPUT_DIR, "*.json"))
        
        total_inserted = 0
        total_skipped = 0
        
        for file_path in json_files:
            file_name = os.path.basename(file_path)
            
            # Skip excluded parts
            if any(file_name.startswith(prefix) for prefix in EXCLUDED_PARTS):
                print(f"Skipping excluded file: {file_name}")
                continue
            
            print(f"Processing: {file_name}")
            with open(file_path, "r", encoding="utf-8") as f:
                questions = json.load(f)
                
            for q in questions:
                # Check for existing question by ID or Stem
                if collection.find_one({"$or": [{"question_id": q["question_id"]}, {"stem": q["stem"]}]}):
                    total_skipped += 1
                else:
                    collection.insert_one(q)
                    total_inserted += 1
                    
        print("\n" + "="*30)
        print(f"Ingestion complete!")
        print(f"Total inserted: {total_inserted}")
        print(f"Total skipped:  {total_skipped}")
        print("="*30)

    except Exception as e:
        print(f"Error during ingestion: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    ingest_questions()
