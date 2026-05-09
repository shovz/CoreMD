import hashlib
import json
import re

from fastapi import APIRouter, Depends, HTTPException, status
from openai import OpenAI
from pymongo.database import Database
from redis import Redis

from app.core.auth import get_current_user
from app.core.config import settings
from app.db.deps import mongo_db, redis_client
from app.schemas.ai import AskRequest, AskResponse, Citation
from app.services.rag_service import build_context_prompt, get_relevant_chunks, get_section_chunks

router = APIRouter(
    prefix="/ai",
    tags=["ai"]
)

SYSTEM_PROMPT = (
    "You are a clinical education assistant for internal medicine residents. "
    "Answer questions ONLY using the provided context excerpts from Harrison's Principles of Internal Medicine. "
    "When a selected passage is provided, use it as an anchor for the user's question, but answer from all provided excerpts. "
    "If the context does not contain sufficient information to answer the question, respond with: "
    "'I do not have enough information to answer that question based on the available content.' "
    "Do not use outside knowledge. Cite chapter and section names when relevant."
)


def _normalize_retrieval_query(text: str) -> str:
    normalized = re.sub(r"\bADRS\b", "ARDS", text, flags=re.IGNORECASE)
    if normalized != text:
        normalized = f"{normalized}\nOriginal user wording: {text}"
    return normalized


@router.post("/ask", response_model=AskResponse)
def ask_ai(
    body: AskRequest,
    db: Database = Depends(mongo_db),
    redis: Redis = Depends(redis_client),
    _user: dict = Depends(get_current_user),
):
    use_cache = len(body.history) == 0 and body.selected_context is None

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

    chunks = []
    selected_context_block = ""
    if body.selected_context:
        selected_section_chunks = get_section_chunks(
            db,
            body.selected_context.chapter_id,
            body.selected_context.section_id,
            limit=5,
        )
        selected_query = "\n".join(
            part
            for part in [
                body.question,
                body.selected_context.selected_text,
                body.selected_context.chapter_title,
                body.selected_context.section_title,
            ]
            if part
        )
        embedding_response = client.embeddings.create(
            model="text-embedding-3-small",
            input=_normalize_retrieval_query(selected_query),
        )
        question_embedding = embedding_response.data[0].embedding
        chapter_chunks = get_relevant_chunks(
            db,
            question_embedding,
            top_k=8,
            chapter_id=body.selected_context.chapter_id,
        )
        selected_chunk_ids = {chunk.get("chunk_id") for chunk in selected_section_chunks}
        chunks = selected_section_chunks + [
            chunk for chunk in chapter_chunks if chunk.get("chunk_id") not in selected_chunk_ids
        ]
        selected_context_block = (
            "Selected passage from the reader:\n"
            f"Chapter: {body.selected_context.chapter_title or body.selected_context.chapter_id}\n"
            f"Section: {body.selected_context.section_title or body.selected_context.section_id}\n"
            f"{body.selected_context.selected_text}"
        )

    if not chunks:
        embedding_response = client.embeddings.create(
            model="text-embedding-3-small",
            input=_normalize_retrieval_query(body.question),
        )
        question_embedding = embedding_response.data[0].embedding
        chunks = get_relevant_chunks(db, question_embedding, top_k=5)
    context_block = build_context_prompt(chunks)
    if selected_context_block:
        context_block = f"{selected_context_block}\n\n{context_block}"

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

    seen: set[tuple[str, str | None]] = set()
    citations: list[Citation] = []
    for chunk in chunks:
        cid = chunk["chapter_id"]
        citation_key = (cid, chunk.get("section_id"))
        if citation_key not in seen:
            seen.add(citation_key)
            citations.append(
                Citation(
                    chapter_id=cid,
                    chapter_title=chunk["chapter_title"],
                    section_id=chunk.get("section_id"),
                    section_title=chunk["section_title"],
                )
            )

    result = AskResponse(answer=answer, citations=citations)

    if use_cache:
        redis.setex(cache_key, 3600, json.dumps(result.model_dump()))

    return result
