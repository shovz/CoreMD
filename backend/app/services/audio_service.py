import base64
import io
from fastapi import HTTPException
from openai import OpenAI


def get_or_generate_tts(client: OpenAI, redis, cache_key: str, text: str, voice: str = "alloy") -> bytes:
    cached = redis.get(cache_key)
    if cached:
        return base64.b64decode(cached)

    response = client.audio.speech.create(
        model="tts-1",
        voice=voice,
        input=text,
    )
    audio_bytes = response.content
    redis.setex(cache_key, 86400, base64.b64encode(audio_bytes).decode("utf-8"))
    return audio_bytes


def transcribe_audio(client: OpenAI, audio_bytes: bytes, filename: str) -> str:
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="Audio file exceeds 25 MB limit")

    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename

    result = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
    )
    transcript = result.text.strip()
    if not transcript:
        raise HTTPException(status_code=422, detail="Empty transcript returned")
    return transcript


def build_stage_tts_text(stage_num: int, title: str, revelation: str, questions: list) -> str:
    parts = [
        f"Stage {stage_num}: {title}.",
        revelation,
    ]
    for i, q in enumerate(questions, start=1):
        q_text = q.get("text") if isinstance(q, dict) else getattr(q, "text", str(q))
        parts.append(f"Question {i}: {q_text}")
    return " ".join(parts)
