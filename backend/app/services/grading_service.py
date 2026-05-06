import json
from typing import TypedDict
from fastapi import HTTPException
from openai import OpenAI


class GradingResult(TypedDict):
    score: int
    passed: bool
    feedback: str
    key_points_covered: list[str]
    key_points_missed: list[str]


_SYSTEM_PROMPT = (
    "You are a senior internal medicine examiner grading a resident's oral answer. "
    "Evaluate the student's answer against the model answer and key points. "
    "Return ONLY valid JSON (no markdown fences) with exactly these fields: "
    "score (integer 0-10), passed (boolean, true if score >= 6), "
    "feedback (string with constructive examiner comments), "
    "key_points_covered (array of strings), key_points_missed (array of strings)."
)


def _build_user_prompt(question_text: str, model_answer: str, key_points: list[str], student_answer: str) -> str:
    kp_formatted = "\n".join(f"- {kp}" for kp in key_points)
    return (
        f"Question: {question_text}\n\n"
        f"Model Answer: {model_answer}\n\n"
        f"Key Points:\n{kp_formatted}\n\n"
        f"Student Answer: {student_answer}"
    )


def _call_and_parse(client: OpenAI, user_prompt: str) -> GradingResult:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0,
    )
    raw = response.choices[0].message.content.strip()
    data = json.loads(raw)
    return GradingResult(
        score=int(data["score"]),
        passed=bool(data["passed"]),
        feedback=str(data["feedback"]),
        key_points_covered=list(data["key_points_covered"]),
        key_points_missed=list(data["key_points_missed"]),
    )


def grade_oral_answer(
    client: OpenAI,
    question_text: str,
    model_answer: str,
    key_points: list[str],
    student_answer: str,
) -> GradingResult:
    user_prompt = _build_user_prompt(question_text, model_answer, key_points, student_answer)
    try:
        return _call_and_parse(client, user_prompt)
    except (json.JSONDecodeError, KeyError, ValueError):
        pass
    try:
        return _call_and_parse(client, user_prompt)
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Grading service parse failure: {exc}")
