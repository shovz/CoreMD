"""
ingest_pdfs.py — One-time ingestion script for Harrison's Principles of Internal Medicine.

Extracts chapter/section structure from the 20 Part PDFs, chunks text, generates
OpenAI embeddings, and stores everything in MongoDB.

Usage:
    python backend/scripts/ingest_pdfs.py [--help]
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend/ (one level up from scripts/)
_ENV_PATH = Path(__file__).parent.parent / ".env"
load_dotenv(_ENV_PATH)

# ---------------------------------------------------------------------------
# Config constants
# ---------------------------------------------------------------------------

PDF_DIR: str = os.getenv("PDF_DIR", str(Path(__file__).parents[2] / "Harrison Book" / "By Chapters"))
MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/CoreMD")
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

CHUNK_MAX_TOKENS: int = 800
CHUNK_OVERLAP_TOKENS: int = 100


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest Harrison's PDF parts into MongoDB (chapters + text_chunks)."
    )
    parser.add_argument(
        "--pdf-dir",
        default=PDF_DIR,
        help=f"Directory containing Part PDF files (default: {PDF_DIR})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Extract and print chapter titles without writing to MongoDB.",
    )
    args = parser.parse_args()

    print(f"PDF_DIR           : {args.pdf_dir}")
    print(f"MONGO_URI         : {MONGO_URI}")
    print(f"CHUNK_MAX_TOKENS  : {CHUNK_MAX_TOKENS}")
    print(f"CHUNK_OVERLAP_TOKENS: {CHUNK_OVERLAP_TOKENS}")
    print(f"Dry run           : {args.dry_run}")
    print()
    print("Ingestion pipeline not yet fully implemented — run individual US steps.")


if __name__ == "__main__":
    main()
