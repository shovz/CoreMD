"""
generate_stage_a_questions.py - Generate non-chain MCQs for Stage A from Harrison chunks.

Usage (from project root):
    python backend/scripts/generate_stage_a_questions.py --count 100

Environment:
    Loads backend/.env and reads:
    - OPENAI_API_KEY
    - MONGO_URI
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from openai import OpenAI
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError

try:
    from dotenv import load_dotenv
except ImportError as exc:
    raise RuntimeError("python-dotenv is required to load backend/.env") from exc


_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)

MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/CoreMD")
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

DIFFICULTIES = ("easy", "medium", "hard")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Stage A MCQs from Harrison chunks")
    parser.add_argument("--count", type=int, default=100, help="Number of questions to generate")
    parser.add_argument("--batch-size", type=int, default=10, help="Questions per OpenAI call")
    parser.add_argument("--model", type=str, default="gpt-4o-mini")
    parser.add_argument("--max-chunk-len", type=int, default=1200)
    return parser.parse_args()


def get_database(client: MongoClient) -> Any:
    try:
        return client.get_default_database()
    except Exception:
        db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0] or "CoreMD"
        return client.get_database(db_name)


def extract_json_array(text: str) -> list[dict[str, Any]]:
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\[.*\])\s*```", cleaned, flags=re.DOTALL)
    if fenced:
        cleaned = fenced.group(1).strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start != -1 and end != -1 and end > start:
        parsed = json.loads(cleaned[start : end + 1])
        if isinstance(parsed, list):
            return parsed
    raise ValueError("OpenAI response did not contain a valid JSON array")


def normalize_question(raw: dict[str, Any]) -> dict[str, Any]:
    stem = str(raw.get("stem", "")).strip()
    options_raw = raw.get("options", [])
    options = [str(opt).strip() for opt in options_raw] if isinstance(options_raw, list) else []
    explanation = str(raw.get("explanation", "")).strip()
    topic = str(raw.get("topic", "")).strip() or "Internal Medicine"
    chapter_ref = str(raw.get("chapter_ref", "")).strip()
    difficulty = str(raw.get("difficulty", "")).strip().lower()
    if difficulty not in DIFFICULTIES:
        difficulty = "medium"
    try:
        correct_option = int(raw.get("correct_option", -1))
    except (TypeError, ValueError):
        correct_option = -1

    if not stem:
        raise ValueError("stem is empty")
    if len(options) != 4:
        raise ValueError("options must contain exactly 4 items")
    if correct_option < 0 or correct_option > 3:
        raise ValueError("correct_option must be in range [0, 3]")
    if not explanation:
        raise ValueError("explanation is empty")
    if not chapter_ref:
        raise ValueError("chapter_ref is empty")

    return {
        "stem": stem,
        "options": options,
        "correct_option": correct_option,
        "explanation": explanation,
        "topic": topic,
        "chapter_ref": chapter_ref,
        "difficulty": difficulty,
        "is_chain": False,
    }


def build_prompt(chunks: list[dict[str, Any]], count: int) -> str:
    context_lines: list[str] = []
    for i, ch in enumerate(chunks, start=1):
        chapter_ref = str(ch.get("chapter_id", "")).strip()
        section = str(ch.get("section_title", "")).strip() or "General"
        text = str(ch.get("text", "")).strip()
        context_lines.append(
            f"[{i}] chapter_ref: {chapter_ref}\nsection_title: {section}\nexcerpt: {text}"
        )
    context = "\n\n".join(context_lines)

    return (
        "You are generating high-quality internal medicine MCQs for resident exam preparation.\n"
        "CRITICAL: Use ONLY facts that appear in the provided Harrison excerpts. "
        "Do not use external facts.\n"
        f"Generate exactly {count} questions as a JSON array. No prose, no markdown.\n"
        "Each item must follow this schema:\n"
        "{\n"
        '  "stem": "string",\n'
        '  "options": ["string","string","string","string"],\n'
        '  "correct_option": 0,\n'
        '  "explanation": "string",\n'
        '  "topic": "string",\n'
        '  "chapter_ref": "pXX_cYYY",\n'
        '  "difficulty": "easy|medium|hard"\n'
        "}\n"
        "Rules:\n"
        "- Exactly one best answer.\n"
        "- Avoid trivial wording; test reasoning.\n"
        "- Keep stem concise (1-3 sentences).\n"
        "- Ensure explanation explicitly references the excerpted concept.\n"
        "- chapter_ref MUST match one of the provided chapter_ref values.\n\n"
        "HARRISON EXCERPTS:\n"
        f"{context}\n"
    )


def generate_batch(
    oai: OpenAI, model: str, chunks: list[dict[str, Any]], batch_size: int
) -> list[dict[str, Any]]:
    prompt = build_prompt(chunks, batch_size)
    completion = oai.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Return strict JSON only. No markdown fences. "
                    "If uncertain, still return best effort valid JSON."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
    )
    content = completion.choices[0].message.content or ""
    raw_items = extract_json_array(content)
    if len(raw_items) != batch_size:
        raise ValueError(f"Expected {batch_size} questions, got {len(raw_items)}")
    return [normalize_question(item) for item in raw_items]


def sample_chunks(chunks_coll: Collection, sample_size: int, max_len: int) -> list[dict[str, Any]]:
    docs = list(
        chunks_coll.aggregate(
            [
                {"$match": {"chapter_id": {"$exists": True, "$ne": None}, "text": {"$exists": True, "$ne": ""}}},
                {"$sample": {"size": sample_size}},
                {"$project": {"_id": 0, "chapter_id": 1, "section_title": 1, "text": 1}},
            ]
        )
    )
    for d in docs:
        d["text"] = str(d.get("text", ""))[:max_len]
    return docs


def insert_questions(questions_coll: Collection, questions: list[dict[str, Any]], batch_seq: int) -> int:
    inserted = 0
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    for idx, q in enumerate(questions, start=1):
        doc = dict(q)
        doc["question_id"] = f"q_stagea_gen_{ts}_{batch_seq:03d}_{idx:02d}"
        try:
            questions_coll.insert_one(doc)
            inserted += 1
        except DuplicateKeyError:
            continue
    return inserted


def main() -> None:
    args = parse_args()
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is required in backend/.env")
    if args.count < 1 or args.batch_size < 1:
        raise RuntimeError("count and batch-size must be >= 1")

    client = MongoClient(MONGO_URI)
    db = get_database(client)
    questions_coll = db["questions"]
    chunks_coll = db["text_chunks"]
    questions_coll.create_index("question_id", unique=True, background=True)

    existing_non_chain = questions_coll.count_documents({"is_chain": {"$ne": True}})
    print(f"Existing non-chain questions: {existing_non_chain}")

    oai = OpenAI(api_key=OPENAI_API_KEY)

    target = args.count
    inserted_total = 0
    batch_seq = 0
    while inserted_total < target:
        batch_seq += 1
        remaining = target - inserted_total
        batch_size = min(args.batch_size, remaining)
        retries = 3
        last_err: Exception | None = None

        for attempt in range(retries):
            try:
                chunks = sample_chunks(chunks_coll, sample_size=max(12, batch_size * 2), max_len=args.max_chunk_len)
                if not chunks:
                    raise RuntimeError("No text_chunks found. Run ingestion first.")
                generated = generate_batch(oai, args.model, chunks, batch_size)
                inserted = insert_questions(questions_coll, generated, batch_seq=batch_seq)
                inserted_total += inserted
                print(f"Batch {batch_seq}: generated={len(generated)} inserted={inserted} total={inserted_total}/{target}")
                break
            except Exception as exc:  # noqa: BLE001
                last_err = exc
                wait_s = 2 ** attempt
                print(f"Batch {batch_seq} attempt {attempt + 1}/{retries} failed: {exc}")
                if attempt < retries - 1:
                    time.sleep(wait_s)
        else:
            raise RuntimeError(f"Failed batch {batch_seq} after retries: {last_err}")

    final_non_chain = questions_coll.count_documents({"is_chain": {"$ne": True}})
    print(f"Done. Inserted {inserted_total} new questions.")
    print(f"Final non-chain question count: {final_non_chain}")
    client.close()


if __name__ == "__main__":
    main()

