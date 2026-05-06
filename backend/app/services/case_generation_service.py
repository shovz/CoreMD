import json
import uuid
from openai import OpenAI
from fastapi import HTTPException

SYSTEM_PROMPT = """You are a clinical case generator for internal medicine board exam preparation.
Generate a 5-stage rolling case scenario as valid JSON matching this exact schema:

{
  "case_id": "<uuid string>",
  "topic": "<topic string>",
  "patient_summary": "<2-3 sentence patient overview>",
  "stages": [
    {
      "stage_num": 1,
      "title": "<stage title>",
      "revelation": "<clinical information revealed at this stage>",
      "questions": [
        {
          "question_num": 1,
          "text": "<question text>",
          "type": "MCQ" | "open-ended",
          "model_answer": "<correct answer>",
          "key_points": ["<point1>", "<point2>"]
        }
      ]
    }
  ]
}

Rules:
- Exactly 5 stages. Each stage has 1-3 questions.
- Difficulty levels: easy (straightforward presentation), medium (atypical features), hard (diagnostic dilemma with comorbidities).
- Return ONLY valid JSON. No prose, no markdown fences."""


def generate_rolling_case(client: OpenAI, topic: str, difficulty: str) -> dict:
    user_prompt = f"Generate a {difficulty} rolling case on the topic: {topic}"

    def _attempt() -> dict:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)
        if "case_id" not in data:
            data["case_id"] = str(uuid.uuid4())
        return data

    try:
        return _attempt()
    except (json.JSONDecodeError, KeyError, ValueError):
        pass

    try:
        return _attempt()
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Case generation failed after 2 attempts: {exc}")
