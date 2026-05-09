"""
Backfill per-option explanations for existing CoreMD MCQs.

Usage from project root:
    python backend/scripts/backfill_option_explanations.py --limit 50

Requires backend/.env with MONGO_URI and OPENAI_API_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any

from openai import OpenAI
from pymongo import MongoClient

try:
    from dotenv import load_dotenv
except ImportError as exc:
    raise RuntimeError("python-dotenv is required to load backend/.env") from exc

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)

MONGO_URI = os.getenv("MONGO_URI", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill option_explanations for questions and case_questions")
    parser.add_argument("--limit", type=int, default=100, help="Maximum documents to update per collection")
    parser.add_argument("--model", type=str, default="gpt-4o-mini")
    parser.add_argument("--collection", choices=["questions", "case_questions", "both"], default="both")
    return parser.parse_args()


def get_database(client: MongoClient) -> Any:
    try:
        return client.get_default_database()
    except Exception:
        db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0] or "CoreMD"
        return client.get_database(db_name)


def extract_json_array(text: str) -> list[Any]:
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\[.*\])\s*```", cleaned, flags=re.DOTALL)
    if fenced:
        cleaned = fenced.group(1).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start == -1 or end == -1 or end <= start:
            raise
        parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, list):
        raise ValueError("OpenAI response must be a JSON array")
    return parsed


def needs_backfill(doc: dict[str, Any]) -> bool:
    options = doc.get("options")
    explanations = doc.get("option_explanations")
    return not (
        isinstance(options, list)
        and isinstance(explanations, list)
        and len(options) == len(explanations)
        and all(str(item).strip() for item in explanations)
    )


def generate_option_explanations(client: OpenAI, model: str, doc: dict[str, Any]) -> list[str]:
    options = [str(item).strip() for item in doc["options"]]
    prompt = (
        "Write concise explanations for each option in this internal medicine MCQ.\n"
        "Return ONLY a JSON array of exactly 4 strings. The strings must align with the options by index.\n"
        "For the correct option, explain why it is correct. For each distractor, explain why it is incorrect.\n\n"
        f"Stem: {doc.get('stem', '')}\n"
        f"Options: {json.dumps(options, ensure_ascii=True)}\n"
        f"Correct option index: {doc.get('correct_option')}\n"
        f"Existing correct-answer explanation: {doc.get('explanation', '')}\n"
    )
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "Return strict JSON only. No markdown, no prose."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )
    raw = extract_json_array(response.choices[0].message.content or "")
    explanations = [str(item).strip() for item in raw]
    if len(explanations) != len(options) or not all(explanations):
        raise ValueError("generated option_explanations length mismatch or empty item")
    return explanations


def backfill_collection(db: Any, client: OpenAI, model: str, collection_name: str, limit: int) -> tuple[int, int]:
    collection = db[collection_name]
    updated = 0
    skipped = 0
    cursor = collection.find(
        {
            "options": {"$type": "array"},
            "correct_option": {"$exists": True},
            "explanation": {"$exists": True, "$ne": ""},
        },
        {"_id": 1, "question_id": 1, "case_question_id": 1, "stem": 1, "options": 1, "correct_option": 1, "explanation": 1, "option_explanations": 1},
    )
    for doc in cursor:
        if updated >= limit:
            break
        if not needs_backfill(doc):
            skipped += 1
            continue
        explanations = generate_option_explanations(client, model, doc)
        collection.update_one({"_id": doc["_id"]}, {"$set": {"option_explanations": explanations}})
        updated += 1
        doc_id = doc.get("question_id") or doc.get("case_question_id") or str(doc["_id"])
        print(f"{collection_name}: updated {doc_id}")
    return updated, skipped


def main() -> None:
    args = parse_args()
    if not MONGO_URI:
        raise RuntimeError("MONGO_URI is required in backend/.env")
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is required in backend/.env")

    mongo = MongoClient(MONGO_URI)
    ai = OpenAI(api_key=OPENAI_API_KEY)
    db = get_database(mongo)

    collections = ["questions", "case_questions"] if args.collection == "both" else [args.collection]
    for collection_name in collections:
        updated, skipped = backfill_collection(db, ai, args.model, collection_name, max(0, args.limit))
        print(f"{collection_name}: updated={updated}, skipped_already_enriched={skipped}")


if __name__ == "__main__":
    main()
