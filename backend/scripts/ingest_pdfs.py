"""
ingest_pdfs.py — One-time ingestion script for Harrison's Principles of Internal Medicine.

Extracts chapter/section structure from the 20 Part PDFs, chunks text, generates
OpenAI embeddings, and stores everything in MongoDB.

Usage:
    python backend/scripts/ingest_pdfs.py [--help]
"""

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF

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

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# TOC extraction
# ---------------------------------------------------------------------------


def extract_chapters_from_pdf(pdf_path: str) -> list[dict[str, Any]]:
    """Extract chapter metadata from a Part PDF using its embedded TOC.

    Uses PyMuPDF's ``doc.get_toc()`` which returns entries as::

        [level, title, page, ...]

    Level 1 entries are treated as chapter boundaries.  ``page_end`` for each
    chapter is set to one page before the next chapter starts, or to the last
    page of the document for the final chapter.

    Args:
        pdf_path: Absolute or relative path to the PDF file.

    Returns:
        A list of dicts, each with keys:
        ``title``, ``page_start``, ``page_end``, ``chapter_number``.
        Returns an empty list when the TOC is absent or unreadable.
    """
    try:
        doc: fitz.Document = fitz.open(pdf_path)
    except Exception as exc:
        logger.warning("Could not open PDF %s: %s — skipping.", pdf_path, exc)
        return []

    try:
        toc: list[list[Any]] = doc.get_toc()
    except Exception as exc:
        logger.warning("Could not read TOC from %s: %s — skipping.", pdf_path, exc)
        doc.close()
        return []

    if not toc:
        logger.warning("TOC is empty in %s — skipping.", pdf_path)
        doc.close()
        return []

    # Collect level-1 entries (chapter boundaries)
    level1_entries: list[tuple[str, int]] = [
        (entry[1], entry[2]) for entry in toc if entry[0] == 1
    ]

    if not level1_entries:
        logger.warning("No level-1 TOC entries found in %s — skipping.", pdf_path)
        doc.close()
        return []

    total_pages: int = doc.page_count
    doc.close()

    chapters: list[dict[str, Any]] = []
    for idx, (title, page_start) in enumerate(level1_entries):
        # page values from get_toc() are 1-based
        if idx + 1 < len(level1_entries):
            page_end = level1_entries[idx + 1][1] - 1
        else:
            page_end = total_pages  # last chapter runs to end of document

        chapters.append(
            {
                "title": title,
                "page_start": page_start,
                "page_end": page_end,
                "chapter_number": idx + 1,
            }
        )

    return chapters


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


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
    parser.add_argument(
        "--test-pdf",
        metavar="PDF_PATH",
        help="Run extract_chapters_from_pdf on a single PDF and print results.",
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Create a synthetic PDF with a known TOC and verify extraction.",
    )
    args = parser.parse_args()

    print(f"PDF_DIR           : {args.pdf_dir}")
    print(f"MONGO_URI         : {MONGO_URI}")
    print(f"CHUNK_MAX_TOKENS  : {CHUNK_MAX_TOKENS}")
    print(f"CHUNK_OVERLAP_TOKENS: {CHUNK_OVERLAP_TOKENS}")
    print(f"Dry run           : {args.dry_run}")
    print()

    if args.self_test:
        import tempfile

        # Build a minimal 3-page PDF with a level-1 TOC so we can exercise the
        # extraction logic end-to-end without needing the Harrison PDFs.
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name

        doc: fitz.Document = fitz.open()
        for _ in range(3):
            doc.new_page()
        doc.set_toc(
            [
                [1, "Chapter 1: Introduction", 1],
                [1, "Chapter 2: Background", 2],
                [1, "Chapter 3: Conclusion", 3],
            ]
        )
        doc.save(tmp_path)
        doc.close()

        chapters = extract_chapters_from_pdf(tmp_path)
        Path(tmp_path).unlink(missing_ok=True)

        assert len(chapters) == 3, f"Expected 3 chapters, got {len(chapters)}"
        assert chapters[0] == {"title": "Chapter 1: Introduction", "page_start": 1, "page_end": 1, "chapter_number": 1}
        assert chapters[1] == {"title": "Chapter 2: Background", "page_start": 2, "page_end": 2, "chapter_number": 2}
        assert chapters[2] == {"title": "Chapter 3: Conclusion", "page_start": 3, "page_end": 3, "chapter_number": 3}

        print("Self-test PASSED — chapter titles extracted:")
        for ch in chapters:
            print(f"  [{ch['chapter_number']}] {ch['title']}  (pages {ch['page_start']}–{ch['page_end']})")
        return

    if args.test_pdf:
        chapters = extract_chapters_from_pdf(args.test_pdf)
        if not chapters:
            print("No chapters extracted.")
            sys.exit(1)
        print(f"Extracted {len(chapters)} chapter(s) from {args.test_pdf}:")
        for ch in chapters:
            print(
                f"  [{ch['chapter_number']:>3}] {ch['title']}"
                f"  (pages {ch['page_start']}–{ch['page_end']})"
            )
        return

    print("Ingestion pipeline not yet fully implemented — run individual US steps.")


if __name__ == "__main__":
    main()
