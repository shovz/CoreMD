import numpy as np
from pymongo.database import Database
from typing import List


def get_relevant_chunks(db: Database, question_embedding: List[float], top_k: int = 5) -> List[dict]:
    """
    Loads all chunk embeddings from the text_chunks collection and returns
    the top-k most relevant chunks by cosine similarity to the question embedding.
    """
    q_vec = np.array(question_embedding, dtype=np.float32)
    q_norm = q_vec / (np.linalg.norm(q_vec) + 1e-10)

    chunks = list(db.text_chunks.find({}, {"_id": 0, "chunk_id": 1, "chapter_id": 1, "section_title": 1, "text": 1, "embedding": 1}))

    if not chunks:
        return []

    embeddings = np.array([c["embedding"] for c in chunks], dtype=np.float32)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-10
    embeddings_norm = embeddings / norms

    similarities = embeddings_norm @ q_norm

    top_indices = np.argsort(similarities)[::-1][:top_k]
    top_chunks = [chunks[i] for i in top_indices]

    unique_chapter_ids = list({c["chapter_id"] for c in top_chunks})
    chapter_docs = list(db.chapters.find({"chapter_id": {"$in": unique_chapter_ids}}, {"_id": 0, "chapter_id": 1, "title": 1}))
    chapter_title_map = {doc["chapter_id"]: doc["title"] for doc in chapter_docs}

    results = []
    for chunk in top_chunks:
        results.append({
            "chunk_id": chunk["chunk_id"],
            "chapter_id": chunk["chapter_id"],
            "chapter_title": chapter_title_map.get(chunk["chapter_id"], ""),
            "section_title": chunk.get("section_title", ""),
            "text": chunk["text"],
        })

    return results


def build_context_prompt(chunks: List[dict]) -> str:
    """
    Formats retrieved chunks into a numbered context block for the LLM prompt.
    """
    lines = ["Context from Harrison Principles of Internal Medicine:"]
    for i, chunk in enumerate(chunks, start=1):
        lines.append(
            f"[{i}] Chapter: {chunk['chapter_title']} | Section: {chunk['section_title']}\n{chunk['text']}"
        )
    return "\n\n".join(lines)
