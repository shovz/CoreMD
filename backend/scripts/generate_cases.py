"""
generate_cases.py — Generate 2 step-questions for every case that lacks them.

Uses GPT-4o with each case's full clinical content to produce:
  - Step 1: diagnosis question
  - Step 2: management question

Idempotent: skips any case that already has case_questions.
Also fixes answer-position bias in existing case_questions (shuffles options).

Usage:
    cd backend
    python scripts/generate_cases.py
"""

import json
import os
import random
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from pymongo import MongoClient

for _env in [
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent / "infra" / "env" / ".env.development",
]:
    if _env.exists():
        load_dotenv(dotenv_path=_env)
        break

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/CoreMD")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    print("ERROR: OPENAI_API_KEY not set. Check backend/.env")
    sys.exit(1)

STEP1_PROMPT = """\
You are a senior clinician writing a multiple-choice question for internal medicine residents.

Based on this clinical case, write a DIAGNOSIS question (Step 1).

Case title: {title}
Specialty: {specialty}
Presentation: {presentation}
History: {history}
Physical exam: {physical_exam}
Labs: {labs}
Imaging: {imaging}
Diagnosis: {diagnosis}

Write a question that tests the resident's ability to identify the correct diagnosis given the clinical findings above. Use the presentation/labs/imaging as the stem.

Return ONLY valid JSON (no markdown):
{{
  "stem": "2-4 sentence clinical question stem",
  "options": ["option A text", "option B text", "option C text", "option D text"],
  "correct_option": <0-indexed int for the correct option>,
  "explanation": "2-3 sentence explanation of the correct answer"
}}"""

STEP2_PROMPT = """\
You are a senior clinician writing a multiple-choice question for internal medicine residents.

Based on this clinical case, write a MANAGEMENT question (Step 2).

Case title: {title}
Specialty: {specialty}
Diagnosis: {diagnosis}
Management: {management}
Discussion: {discussion}

Write a question that tests the resident's ability to choose the correct immediate management or treatment for this confirmed diagnosis.

Return ONLY valid JSON (no markdown):
{{
  "stem": "2-4 sentence clinical question stem referencing the confirmed diagnosis",
  "options": ["option A text", "option B text", "option C text", "option D text"],
  "correct_option": <0-indexed int for the correct option>,
  "explanation": "2-3 sentence explanation of the correct answer"
}}"""


def shuffle_options(q: dict) -> dict:
    options = q["options"]
    correct_answer = options[int(q["correct_option"])]
    random.shuffle(options)
    q["options"] = options
    q["correct_option"] = options.index(correct_answer)
    return q


def parse_response(content: str) -> dict:
    content = content.strip()
    if content.startswith("```"):
        parts = content.split("```")
        content = parts[1]
        if content.startswith("json"):
            content = content[4:]
    return json.loads(content.strip())


def generate_question(client: OpenAI, prompt: str) -> dict:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    q = parse_response(response.choices[0].message.content)
    return shuffle_options(q)


def main():
    mongo = MongoClient(MONGO_URI)
    db = mongo.get_default_database()
    ai = OpenAI(api_key=OPENAI_API_KEY)

    # Fix answer bias in existing case_questions
    existing = list(db["case_questions"].find({}))
    shuffled = 0
    for cq in existing:
        options = cq["options"]
        correct_answer = options[cq["correct_option"]]
        random.shuffle(options)
        new_idx = options.index(correct_answer)
        if new_idx != cq["correct_option"]:
            db["case_questions"].update_one(
                {"_id": cq["_id"]},
                {"$set": {"options": options, "correct_option": new_idx}},
            )
            shuffled += 1
    if shuffled:
        print(f"Reshuffled {shuffled} existing case_questions answers.")

    # Find cases missing questions
    cases_with_qs = set(db["case_questions"].distinct("case_id"))
    all_cases = list(db["cases"].find({}, {"_id": 0}))
    missing = [c for c in all_cases if c["case_id"] not in cases_with_qs]

    if not missing:
        print("All cases already have questions.")
        mongo.close()
        return

    print(f"Generating questions for {len(missing)} cases...\n")

    for i, case in enumerate(missing, 1):
        cid = case["case_id"]
        title = case["title"].encode("ascii", "replace").decode("ascii")
        print(f"  [{i}/{len(missing)}] {cid}: {title}")

        def fmt(key):
            return case.get(key) or "N/A"

        try:
            # Step 1 — diagnosis
            p1 = STEP1_PROMPT.format(
                title=fmt("title"),
                specialty=fmt("specialty"),
                presentation=fmt("presentation"),
                history=fmt("history"),
                physical_exam=fmt("physical_exam"),
                labs=fmt("labs"),
                imaging=fmt("imaging"),
                diagnosis=fmt("diagnosis"),
            )
            q1 = generate_question(ai, p1)

            # Step 2 — management
            p2 = STEP2_PROMPT.format(
                title=fmt("title"),
                specialty=fmt("specialty"),
                diagnosis=fmt("diagnosis"),
                management=fmt("management"),
                discussion=fmt("discussion"),
            )
            q2 = generate_question(ai, p2)

        except Exception as e:
            print(f"    ERROR: {e}")
            continue

        for step, q in [(1, q1), (2, q2)]:
            doc = {
                "case_question_id": f"cq_{cid}_s{step}",
                "case_id": cid,
                "step": step,
                "stem": q["stem"],
                "options": q["options"],
                "correct_option": int(q["correct_option"]),
                "explanation": q["explanation"],
            }
            if not db["case_questions"].find_one({"case_question_id": doc["case_question_id"]}):
                db["case_questions"].insert_one(doc)

    total_cq = db["case_questions"].count_documents({})
    total_cases = db["cases"].count_documents({})
    print(f"\nDone. {total_cases} cases, {total_cq} case_questions in DB.")
    mongo.close()


if __name__ == "__main__":
    main()
