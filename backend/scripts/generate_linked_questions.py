"""
generate_linked_questions.py - Generate linked follow-up MCQs for existing questions.

Usage (from project root):
    python backend/scripts/generate_linked_questions.py

Optional flags:
    --parents-limit 20           Number of parent questions to process.
    --followups-per-parent 3     Number of follow-up links to maintain per parent.
    --model gpt-4o-mini          OpenAI model for generation.

Environment:
    Loads backend/.env and reads:
    - OPENAI_API_KEY
    - MONGO_URI
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Any, TypedDict

from openai import OpenAI
from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError

try:
    from dotenv import load_dotenv
except ImportError as exc:
    raise RuntimeError("python-dotenv is required to load backend/.env") from exc

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)

MONGO_URI: str = os.getenv("MONGO_URI", "")
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")


class GeneratedQuestion(TypedDict):
    stem: str
    options: list[str]
    correct_option: int
    explanation: str
    difficulty: str


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be >= 1")
    return parsed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate linked follow-up questions")
    parser.add_argument("--parents-limit", type=positive_int, default=20)
    parser.add_argument("--followups-per-parent", type=positive_int, default=3)
    parser.add_argument("--model", type=str, default="gpt-4o-mini")
    return parser.parse_args()


def get_database(client: MongoClient) -> Any:
    try:
        default_db = client.get_default_database()
        return default_db
    except Exception:
        db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0] or "CoreMD"
        return client.get_database(db_name)


def ensure_indexes(
    questions: Collection,
    followups: Collection,
) -> None:
    # Keep the existing uniqueness guarantee on questions.question_id.
    questions.create_index("question_id", unique=True, background=True)

    followups.create_index("link_id", unique=True, background=True)
    followups.create_index(
        [("parent_question_id", ASCENDING), ("trigger", ASCENDING), ("priority", ASCENDING)],
        background=True,
    )


def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()

    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, flags=re.DOTALL)
    if fenced:
        cleaned = fenced.group(1).strip()

    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        obj = json.loads(cleaned[start : end + 1])
        if isinstance(obj, dict):
            return obj

    raise ValueError("OpenAI response did not contain a valid JSON object")


def normalize_generated_question(raw: dict[str, Any], fallback_difficulty: str) -> GeneratedQuestion:
    stem = str(raw.get("stem", "")).strip()
    explanation = str(raw.get("explanation", "")).strip()

    options_raw = raw.get("options")
    options: list[str] = []
    if isinstance(options_raw, list):
        options = [str(item).strip() for item in options_raw]

    correct_option_raw = raw.get("correct_option")
    try:
        correct_option = int(correct_option_raw)
    except (TypeError, ValueError):
        correct_option = -1

    difficulty = str(raw.get("difficulty", fallback_difficulty)).strip().lower()
    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = fallback_difficulty if fallback_difficulty in {"easy", "medium", "hard"} else "medium"

    if len(options) != 4:
        raise ValueError("generated options must contain exactly 4 items")
    if not stem:
        raise ValueError("generated stem is empty")
    if not explanation:
        raise ValueError("generated explanation is empty")
    if correct_option < 0 or correct_option > 3:
        raise ValueError("correct_option must be in range [0, 3]")

    return {
        "stem": stem,
        "options": options,
        "correct_option": correct_option,
        "explanation": explanation,
        "difficulty": difficulty,
    }


def generate_followups_for_parent(
    client: OpenAI,
    model: str,
    parent: dict[str, Any],
    count: int,
) -> list[GeneratedQuestion]:
    parent_stem = str(parent.get("stem", "")).strip()
    parent_options = parent.get("options", [])
    parent_correct_option = parent.get("correct_option", 0)
    parent_explanation = str(parent.get("explanation", "")).strip()
    parent_difficulty = str(parent.get("difficulty", "medium")).strip().lower() or "medium"

    prompt = (
        "Generate follow-up multiple-choice questions for internal medicine learning.\n"
        "Return ONLY valid JSON object with this schema:\n"
        "{\n"
        '  "followups": [\n'
        "    {\n"
        '      "stem": "string",\n'
        '      "options": ["string", "string", "string", "string"],\n'
        '      "correct_option": 0,\n'
        '      "explanation": "string",\n'
        '      "difficulty": "easy|medium|hard"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        f"Generate exactly {count} followups.\n"
        "Each follow-up must be clinically related to the parent question, but not a rephrase.\n"
        "Keep stems concise (1-2 sentences). Keep explanations short and educational.\n"
        "Do not include markdown or code fences.\n\n"
        "Parent question:\n"
        f"stem: {parent_stem}\n"
        f"options: {json.dumps(parent_options, ensure_ascii=True)}\n"
        f"correct_option: {parent_correct_option}\n"
        f"explanation: {parent_explanation}\n"
        f"topic: {parent.get('topic', '')}\n"
        f"chapter_ref: {parent.get('chapter_ref', '')}\n"
        f"difficulty: {parent_difficulty}\n"
    )

    max_retries = 3
    last_exc: Exception | None = None
    completion = None
    for attempt in range(max_retries + 1):
        try:
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You generate valid JSON only. No extra keys, no prose, no markdown. "
                            "Always return exactly the requested number of followups."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
            )
            break
        except Exception as exc:  # noqa: BLE001
            # Retry only transient OpenAI-side/transport failures.
            exc_name = exc.__class__.__name__
            retryable_names = {
                "RateLimitError",
                "APIConnectionError",
                "APITimeoutError",
                "InternalServerError",
                "APIError",
            }
            if exc_name not in retryable_names or attempt >= max_retries:
                raise
            last_exc = exc
            wait_secs = 2 ** attempt
            print(
                f"OpenAI transient error for parent={parent.get('question_id', 'unknown')} "
                f"({exc_name}), retry {attempt + 1}/{max_retries} in {wait_secs}s..."
            )
            time.sleep(wait_secs)

    if completion is None:
        raise RuntimeError(f"OpenAI generation failed after retries: {last_exc!r}")

    content = completion.choices[0].message.content or ""
    payload = extract_json_object(content)

    raw_items = payload.get("followups")
    if not isinstance(raw_items, list):
        raise ValueError("JSON payload missing followups list")
    if len(raw_items) != count:
        raise ValueError(f"expected {count} followups, got {len(raw_items)}")

    generated: list[GeneratedQuestion] = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            raise ValueError("followup item is not an object")
        generated.append(normalize_generated_question(raw, parent_difficulty))

    return generated


def question_id_for(parent_question_id: str, priority: int) -> str:
    return f"{parent_question_id}__fu{priority:02d}"


def link_id_for(parent_question_id: str, priority: int) -> str:
    return f"{parent_question_id}::correct::{priority:02d}"


def verify_link_references(questions: Collection, followups: Collection) -> tuple[int, int]:
    invalid_count = 0
    total = 0

    for link in followups.find({}, {"_id": 0, "parent_question_id": 1, "followup_question_id": 1}):
        total += 1
        parent_exists = questions.find_one({"question_id": link["parent_question_id"]}, {"_id": 1}) is not None
        followup_exists = questions.find_one({"question_id": link["followup_question_id"]}, {"_id": 1}) is not None
        if not parent_exists or not followup_exists:
            invalid_count += 1

    return total, invalid_count


def main() -> None:
    args = parse_args()

    if not _ENV_PATH.exists():
        raise RuntimeError(f"Missing env file: {_ENV_PATH}")
    if not MONGO_URI:
        raise RuntimeError("MONGO_URI is required in backend/.env")
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is required in backend/.env")

    mongo_client: MongoClient = MongoClient(MONGO_URI)  # type: ignore[type-arg]
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

    try:
        db = get_database(mongo_client)
        questions = db.get_collection("questions")
        followups = db.get_collection("question_followups")

        ensure_indexes(questions, followups)

        parent_cursor = questions.find(
            {"question_id": {"$not": re.compile(r"__fu\d+$")}},
            {
                "_id": 0,
                "question_id": 1,
                "stem": 1,
                "options": 1,
                "correct_option": 1,
                "explanation": 1,
                "topic": 1,
                "chapter_ref": 1,
                "difficulty": 1,
            },
        ).sort("question_id", ASCENDING)

        parents = list(parent_cursor.limit(max(1, args.parents_limit)))

        if not parents:
            print("No parent questions found in questions collection.")
            return

        inserted_questions = 0
        skipped_questions = 0
        inserted_links = 0
        skipped_links = 0
        processed_parents = 0

        for parent in parents:
            parent_question_id = str(parent["question_id"])

            existing_links = list(
                followups.find(
                    {"parent_question_id": parent_question_id, "trigger": "correct"},
                    {"_id": 0, "priority": 1},
                )
            )
            existing_priorities = {
                int(doc["priority"])
                for doc in existing_links
                if isinstance(doc.get("priority"), int)
            }

            missing_priorities = [
                p
                for p in range(1, args.followups_per_parent + 1)
                if p not in existing_priorities
            ]

            if not missing_priorities:
                processed_parents += 1
                print(
                    f"[{processed_parents}/{len(parents)}] parent={parent_question_id}: "
                    "already complete, skipped generation"
                )
                continue

            generated_items = generate_followups_for_parent(
                openai_client,
                args.model,
                parent,
                len(missing_priorities),
            )

            local_inserted_q = 0
            local_skipped_q = 0
            local_inserted_l = 0
            local_skipped_l = 0

            for priority, generated in zip(missing_priorities, generated_items):
                followup_question_id = question_id_for(parent_question_id, priority)
                link_id = link_id_for(parent_question_id, priority)

                question_doc = {
                    "question_id": followup_question_id,
                    "stem": generated["stem"],
                    "options": generated["options"],
                    "correct_option": generated["correct_option"],
                    "explanation": generated["explanation"],
                    "topic": parent.get("topic"),
                    "chapter_ref": parent.get("chapter_ref"),
                    "difficulty": generated["difficulty"],
                }

                if questions.find_one({"question_id": followup_question_id}, {"_id": 1}):
                    skipped_questions += 1
                    local_skipped_q += 1
                else:
                    try:
                        questions.insert_one(question_doc)
                        inserted_questions += 1
                        local_inserted_q += 1
                    except DuplicateKeyError:
                        skipped_questions += 1
                        local_skipped_q += 1

                link_doc = {
                    "link_id": link_id,
                    "parent_question_id": parent_question_id,
                    "followup_question_id": followup_question_id,
                    "trigger": "correct",
                    "priority": priority,
                }

                if followups.find_one({"link_id": link_id}, {"_id": 1}):
                    skipped_links += 1
                    local_skipped_l += 1
                else:
                    try:
                        followups.insert_one(link_doc)
                        inserted_links += 1
                        local_inserted_l += 1
                    except DuplicateKeyError:
                        skipped_links += 1
                        local_skipped_l += 1

            processed_parents += 1
            print(
                f"[{processed_parents}/{len(parents)}] parent={parent_question_id}: "
                f"questions +{local_inserted_q}/skip {local_skipped_q}, "
                f"links +{local_inserted_l}/skip {local_skipped_l}"
            )

        total_links, invalid_links = verify_link_references(questions, followups)
        if invalid_links > 0:
            raise RuntimeError(
                f"Link integrity check failed: {invalid_links}/{total_links} link docs reference missing questions"
            )

        print("\nSummary")
        print(f"- Parents processed: {processed_parents}")
        print(f"- Questions inserted: {inserted_questions}")
        print(f"- Questions skipped: {skipped_questions}")
        print(f"- Links inserted: {inserted_links}")
        print(f"- Links skipped: {skipped_links}")
        print(f"- Link integrity: OK ({total_links} links validated)")

    finally:
        mongo_client.close()


if __name__ == "__main__":
    main()
