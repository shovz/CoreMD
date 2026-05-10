import os
import sys
from pathlib import Path
from pymongo import MongoClient
try:
    from rapidfuzz import fuzz
except ImportError:
    print("Error: rapidfuzz not installed. Please run 'pip install rapidfuzz'")
    sys.exit(1)

# Load .env from backend/
try:
    from dotenv import load_dotenv
    _ENV_PATH = Path(__file__).parent.parent.parent / "backend" / ".env"
    load_dotenv(_ENV_PATH)
except ImportError:
    pass

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/CoreMD")

def find_duplicates():
    client = MongoClient(MONGO_URI)
    db = client.get_database()
    questions_col = db.get_collection("questions")

    print(f"Fetching questions from {MONGO_URI}...")
    all_questions = list(questions_col.find({}, {"question_id": 1, "stem": 1, "topic": 1}))
    total_count = len(all_questions)
    print(f"Total questions found: {total_count}")

    # Group by topic to speed up (optional but good)
    topics = {}
    for q in all_questions:
        topic = q.get("topic", "Unknown")
        if topic not in topics:
            topics[topic] = []
        topics[topic].append(q)

    duplicates = []
    processed_count = 0
    
    print("\nScanning for duplicates (similarity > 85%)...")
    
    for topic, qs in topics.items():
        n = len(qs)
        for i in range(n):
            for j in range(i + 1, n):
                q1 = qs[i]
                q2 = qs[j]
                
                score = fuzz.token_set_ratio(q1["stem"], q2["stem"])
                if score > 85:
                    duplicates.append({
                        "q1_id": q1["question_id"],
                        "q2_id": q2["question_id"],
                        "q1_stem": q1["stem"][:100],
                        "q2_stem": q2["stem"][:100],
                        "topic": topic,
                        "score": score
                    })
            processed_count += 1
            if processed_count % 100 == 0:
                print(f"  Processed {processed_count}/{total_count} questions...")

    print("\n" + "="*50)
    if not duplicates:
        print("No duplicates or high-similarity questions found.")
    else:
        print(f"Found {len(duplicates)} potential duplicate pairs:")
        for d in duplicates:
            print(f"\n[{d['topic']}] Score: {d['score']:.1f}%")
            print(f"  1. {d['q1_id']}: {d['q1_stem']}...")
            print(f"  2. {d['q2_id']}: {d['q2_stem']}...")
    print("="*50)

    client.close()

if __name__ == "__main__":
    find_duplicates()
