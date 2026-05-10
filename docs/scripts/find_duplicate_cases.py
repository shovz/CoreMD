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

def find_duplicate_cases():
    client = MongoClient(MONGO_URI)
    db = client.get_database()
    cases_col = db.get_collection("cases")

    print(f"Fetching cases from {MONGO_URI}...")
    all_cases = list(cases_col.find({}, {"case_id": 1, "title": 1, "specialty": 1}))
    total_count = len(all_cases)
    print(f"Total cases found: {total_count}")

    # Group by specialty
    specialties = {}
    for c in all_cases:
        spec = c.get("specialty", "Unknown")
        if spec not in specialties:
            specialties[spec] = []
        specialties[spec].append(c)

    duplicates = []
    
    print("\nScanning for duplicate cases (title similarity > 85%)...")
    
    for spec, cs in specialties.items():
        n = len(cs)
        for i in range(n):
            for j in range(i + 1, n):
                c1 = cs[i]
                c2 = cs[j]
                
                score = fuzz.token_set_ratio(c1["title"], c2["title"])
                if score > 85:
                    duplicates.append({
                        "c1_id": c1["case_id"],
                        "c2_id": c2["case_id"],
                        "c1_title": c1["title"],
                        "c2_title": c2["title"],
                        "specialty": spec,
                        "score": score
                    })

    print("\n" + "="*50)
    if not duplicates:
        print("No duplicate cases found.")
    else:
        print(f"Found {len(duplicates)} potential duplicate case pairs:")
        for d in duplicates:
            print(f"\n[{d['specialty']}] Score: {d['score']:.1f}%")
            print(f"  1. {d['c1_id']}: {d['c1_title']}")
            print(f"  2. {d['c2_id']}: {d['c2_title']}")
    print("="*50)

    client.close()

if __name__ == "__main__":
    find_duplicate_cases()
