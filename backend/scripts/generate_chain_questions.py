"""
Generate AI-powered multi-step question chains for CoreMD.

Usage:
    cd backend
    python scripts/generate_chain_questions.py

Requires OPENAI_API_KEY and MONGO_URI in backend/.env (or infra/env/.env.development).
Generates ~16 chains (3 questions each, 48 total) across 8 clinical specialties.
Chain questions are stored in the 'questions' collection with is_chain=True,
hidden from normal topic browsing.
Links are stored in 'question_followups' so QuestionDetailPage shows them inline.
"""

import json
import os
import random
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from pymongo import MongoClient

# Load env — try backend/.env first, then infra/env/.env.development
_base = Path(__file__).resolve().parent.parent
for _env in [_base / ".env", _base.parent / "infra" / "env" / ".env.development"]:
    if _env.exists():
        load_dotenv(dotenv_path=_env)
        break

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/CoreMD")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    print("ERROR: OPENAI_API_KEY not set. Check backend/.env")
    sys.exit(1)

TOPICS = [
    "Cardiology",
    "Pulmonology",
    "Nephrology",
    "Gastroenterology",
    "Endocrinology",
    "Hematology",
    "Infectious Disease",
    "Neurology",
]

CHAINS_PER_TOPIC = 2

CHAIN_PROMPT = """\
You are a senior internal medicine physician creating progressive clinical reasoning questions for residents.

Generate a chain of 3 questions for the specialty: {topic}

Rules:
- Q1: A realistic clinical scenario (2-4 sentences). Tests initial diagnosis or workup.
- Q2: Continues the same patient scenario. Tests underlying mechanism or next management step.
- Q3: Deepest level. Tests a complication, edge case, or nuanced therapeutic decision.
- Each question has exactly 4 options, one correct.
- correct_option is 0-indexed (0=A, 1=B, 2=C, 3=D). Vary which option is correct across questions.
- difficulty: Q1="medium", Q2="hard", Q3="hard"

Return ONLY a JSON array of 3 objects, no other text:
[
  {{
    "stem": "...",
    "options": ["...", "...", "...", "..."],
    "correct_option": 0,
    "explanation": "2-3 sentence explanation of why this is correct.",
    "difficulty": "medium"
  }},
  {{
    "stem": "...",
    "options": ["...", "...", "...", "..."],
    "correct_option": 1,
    "explanation": "...",
    "difficulty": "hard"
  }},
  {{
    "stem": "...",
    "options": ["...", "...", "...", "..."],
    "correct_option": 2,
    "explanation": "...",
    "difficulty": "hard"
  }}
]"""


def shuffle_options(q: dict) -> dict:
    options = q["options"]
    correct_answer = options[int(q["correct_option"])]
    random.shuffle(options)
    q["options"] = options
    q["correct_option"] = options.index(correct_answer)
    return q


def generate_chain(client: OpenAI, topic: str) -> list[dict]:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": CHAIN_PROMPT.format(topic=topic)}],
        temperature=0.8,
    )
    content = response.choices[0].message.content.strip()
    if content.startswith("```"):
        parts = content.split("```")
        content = parts[1]
        if content.startswith("json"):
            content = content[4:]
    questions = json.loads(content.strip())
    return [shuffle_options(q) for q in questions]


def main():
    mongo = MongoClient(MONGO_URI)
    db = mongo.get_default_database()
    ai = OpenAI(api_key=OPENAI_API_KEY)

    total = len(TOPICS) * CHAINS_PER_TOPIC
    chain_num = 0

    for topic in TOPICS:
        # Check how many chain questions already exist for this topic
        existing = db["questions"].count_documents({"topic": topic, "is_chain": True})
        chains_needed = CHAINS_PER_TOPIC - (existing // 3)
        if chains_needed <= 0:
            print(f"Skipping {topic} — already has {existing} chain questions")
            continue

        # Find existing regular questions for this topic to use as entry points
        trigger_pool = list(
            db["questions"].find(
                {"topic": {"$regex": topic, "$options": "i"}, "is_chain": {"$ne": True}},
                {"question_id": 1, "_id": 0},
            ).limit(20)
        )

        for _ in range(chains_needed):
            chain_num += 1
            print(f"Generating chain {chain_num}/{total}: {topic}")

            try:
                questions = generate_chain(ai, topic)
            except Exception as e:
                print(f"  ERROR: {e}")
                continue

            if len(questions) != 3:
                print(f"  ERROR: expected 3 questions, got {len(questions)}")
                continue

            # Build question documents
            import uuid
            q_ids = [f"chain_{uuid.uuid4().hex[:14]}" for _ in range(3)]

            for i, q in enumerate(questions):
                doc = {
                    "question_id": q_ids[i],
                    "stem": q["stem"],
                    "options": q["options"],
                    "correct_option": int(q["correct_option"]),
                    "explanation": q["explanation"],
                    "topic": topic,
                    "chapter_ref": None,
                    "difficulty": q.get("difficulty", "hard"),
                    "is_chain": True,
                }
                if not db["questions"].find_one({"question_id": q_ids[i]}):
                    db["questions"].insert_one(doc)

            # Link Q1 → Q2 and Q2 → Q3
            for parent_id, child_id in [(q_ids[0], q_ids[1]), (q_ids[1], q_ids[2])]:
                if not db["question_followups"].find_one(
                    {"parent_question_id": parent_id, "trigger": "correct"}
                ):
                    db["question_followups"].insert_one(
                        {
                            "parent_question_id": parent_id,
                            "followup_question_id": child_id,
                            "trigger": "correct",
                            "priority": 1,
                        }
                    )

            # Link a random existing question → Q1 as entry point
            if trigger_pool:
                trigger = random.choice(trigger_pool)
                trigger_id = trigger["question_id"]
                if not db["question_followups"].find_one(
                    {"parent_question_id": trigger_id, "trigger": "correct"}
                ):
                    db["question_followups"].insert_one(
                        {
                            "parent_question_id": trigger_id,
                            "followup_question_id": q_ids[0],
                            "trigger": "correct",
                            "priority": 1,
                        }
                    )
                    # Remove from pool so the same trigger isn't reused
                    trigger_pool = [t for t in trigger_pool if t["question_id"] != trigger_id]

    chain_q_count = db["questions"].count_documents({"is_chain": True})
    followup_count = db["question_followups"].count_documents({})
    print(f"\nDone.")
    print(f"  Chain questions in DB: {chain_q_count}")
    print(f"  question_followups links: {followup_count}")
    mongo.close()


if __name__ == "__main__":
    main()
