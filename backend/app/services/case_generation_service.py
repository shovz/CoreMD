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
      "revelation": "<clinical information revealed at this stage — the narrative the student reads>",
      "available_data": {
        "vitals": "<specific vital signs with numbers, e.g. T 38.9C, HR 105, BP 115/75, RR 22, O2 sat 91% RA>",
        "physical_exam": "<key physical examination findings with detail>",
        "labs": "<relevant lab results with values, e.g. WBC 15,500, CRP 85 mg/L>",
        "imaging": "<state explicitly whether each study was done and what it shows, e.g. 'CXR performed: right lower lobe consolidation. CT chest: not yet ordered.'>",
        "history": "<additional patient history not in the revelation — PMH, social hx, medications, allergies>"
      },
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
- available_data must be stage-appropriate: only include data that would realistically be available at that point in the encounter (e.g. Stage 1 = basic workup; later stages = follow-up results, advanced imaging, specialist findings).
- available_data values must be specific with realistic clinical numbers — not vague.
- available_data must be internally consistent with the case diagnosis and progression across all 5 stages.
- For imaging: explicitly state if a study was NOT yet ordered (e.g. "CT chest: not yet ordered at this stage").
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
