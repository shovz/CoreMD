import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, status
from openai import OpenAI
from pymongo.database import Database
from redis import Redis

from app.core.auth import get_current_user
from app.core.config import settings
from app.db.deps import mongo_db, redis_client
from app.schemas.ai import AskRequest, AskResponse, Citation
from app.services.rag_service import build_context_prompt, get_relevant_chunks

router = APIRouter(
    prefix="/ai",
    tags=["ai"]
)

SYSTEM_PROMPT = (
    "You are a clinical education assistant for internal medicine residents. "
    "Answer questions ONLY using the provided context excerpts from Harrison's Principles of Internal Medicine. "
    "If the context does not contain sufficient information to answer the question, respond with: "
    "'I do not have enough information to answer that question based on the available content.' "
    "Do not use outside knowledge. Cite chapter and section names when relevant."
)


@router.post("/ask", response_model=AskResponse)
def ask_ai(
    body: AskRequest,
    db: Database = Depends(mongo_db),
    redis: Redis = Depends(redis_client),
    _user: dict = Depends(get_current_user),
):
    use_cache = len(body.history) == 0

    cache_key = f"ai_answer:{hashlib.sha256(body.question.encode()).hexdigest()}"

    if use_cache:
        cached = redis.get(cache_key)
        if cached:
            return AskResponse(**json.loads(cached))

    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured",
        )

    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    embedding_response = client.embeddings.create(
        model="text-embedding-3-small",
        input=body.question,
    )
    question_embedding = embedding_response.data[0].embedding

    chunks = get_relevant_chunks(db, question_embedding, top_k=5)
    context_block = build_context_prompt(chunks)

    history_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in body.history[-10:]
    ]

    messages = (
        [{"role": "system", "content": SYSTEM_PROMPT}]
        + [{"role": "user", "content": context_block}]
        + history_messages
        + [{"role": "user", "content": body.question}]
    )

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    )
    answer = completion.choices[0].message.content or ""

    seen: set[str] = set()
    citations: list[Citation] = []
    for chunk in chunks:
        cid = chunk["chapter_id"]
        if cid not in seen:
            seen.add(cid)
            citations.append(
                Citation(
                    chapter_id=cid,
                    chapter_title=chunk["chapter_title"],
                    section_title=chunk["section_title"],
                )
            )

    result = AskResponse(answer=answer, citations=citations)

    if use_cache:
        redis.setex(cache_key, 3600, json.dumps(result.model_dump()))

    return result
