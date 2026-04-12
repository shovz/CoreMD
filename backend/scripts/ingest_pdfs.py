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
import re
import sys
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from dotenv import load_dotenv

# Load .env from backend/ (one level up from scripts/)
_ENV_PATH = Path(__file__).parent.parent / ".env"
load_dotenv(_ENV_PATH)

# ---------------------------------------------------------------------------
# Config constants
# ---------------------------------------------------------------------------

PDF_FULL_PATH: str = os.getenv(
    "PDF_FULL_PATH",
    str(
        Path(__file__).parents[2]
        / "Harrison Book"
        / "Harrison's_Principles_of_Internal_Medicine,_Twenty_First_Edition.pdf"
    ),
)
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
# Text extraction
# ---------------------------------------------------------------------------

# Matches lines that are purely a page number (optional whitespace around digits)
_PAGE_NUMBER_RE = re.compile(r"^\s*\d+\s*$")

# Matches hyphenated line breaks where the word continues on the next line
_HYPHEN_BREAK_RE = re.compile(r"-\n(\S)")

# Collapses 3+ consecutive newlines into two
_EXCESS_NEWLINES_RE = re.compile(r"\n{3,}")

# Collapses runs of spaces/tabs (but not newlines) into a single space
_EXCESS_SPACES_RE = re.compile(r"[ \t]+")


def extract_text(doc: fitz.Document, page_start: int, page_end: int) -> str:
    """Extract and clean plain text from a page range of a PDF document.

    Page numbers are 1-based (matching PyMuPDF ``get_toc()`` output).

    Cleaning steps applied in order:
    1. Re-join words hyphenated across line breaks (e.g. ``hyper-\\ntension`` → ``hypertension``).
    2. Drop lines that consist solely of a page number (bare integers).
    3. Collapse runs of spaces/tabs to a single space per line.
    4. Collapse 3+ consecutive blank lines to two.

    Args:
        doc: An open ``fitz.Document`` instance.
        page_start: First page to extract (1-based, inclusive).
        page_end: Last page to extract (1-based, inclusive).

    Returns:
        A single cleaned string with all extracted text.
    """
    parts: list[str] = []

    # PyMuPDF uses 0-based indexing internally
    first = max(page_start - 1, 0)
    last = min(page_end - 1, doc.page_count - 1)

    for page_idx in range(first, last + 1):
        page: fitz.Page = doc[page_idx]
        raw: str = page.get_text()  # type: ignore[attr-defined]
        parts.append(raw)

    text = "\n".join(parts)

    # 1. Re-join hyphenated line breaks ("hyper-\ntension" → "hypertension")
    text = _HYPHEN_BREAK_RE.sub(r"\1", text)

    # 2. Strip bare page-number lines
    cleaned_lines: list[str] = [
        line for line in text.splitlines() if not _PAGE_NUMBER_RE.match(line)
    ]
    text = "\n".join(cleaned_lines)

    # 3. Collapse multiple spaces/tabs per line
    text = _EXCESS_SPACES_RE.sub(" ", text)

    # 4. Collapse excess blank lines
    text = _EXCESS_NEWLINES_RE.sub("\n\n", text)

    return text.strip()


# ---------------------------------------------------------------------------
# Specialty derivation
# ---------------------------------------------------------------------------

# Ordered keyword mapping: first match wins
_SPECIALTY_RULES: list[tuple[list[str], str]] = [
    (["cardiovascular", "cardiac", "heart"], "Cardiology"),
    (["respiratory", "pulmon", "lung"], "Pulmonology"),
    (["kidney", "renal", "urinary"], "Nephrology"),
    (["hepat", "biliary", "liver", "pancrea"], "Hepatology"),
    (["gastrointestinal", "digestive", "bowel", "colon", "gastro"], "Gastroenterology"),
    (["rheumat", "connective tissue", "joint", "arthrit"], "Rheumatology"),
    (["immune", "immunol", "allerg"], "Immunology"),
    (["endocrin", "metabol", "diabetes", "thyroid"], "Endocrinology"),
    (["neurol", "nervous", "brain", "spine"], "Neurology"),
    (["psychiatr", "mental", "behav"], "Psychiatry"),
    (["oncol", "cancer", "tumor", "neoplas"], "Oncology"),
    (["hematol", "blood", "coagulat"], "Hematology"),
    (["infectious", "infect", "microbiol", "parasit", "virus", "bacteri"], "Infectious Disease"),
    (["critical care", "intensive"], "Critical Care"),
    (["dermatol", "skin"], "Dermatology"),
    (["musculoskel", "orthop", "bone", "fracture"], "Orthopedics"),
    (["ophthal", "eye", "vision"], "Ophthalmology"),
    (["ent", "otolaryngol", "ear", "nose", "throat"], "ENT"),
    (["geneti", "heredit", "heritable", "chromosom"], "Genetics"),
    (["toxicol", "poison", "environmental hazard"], "Toxicology"),
    (["alcohol", "substance", "drug depend", "addiction"], "Addiction Medicine"),
]


def _derive_specialty(part_title: str) -> str:
    """Map a Harrison's Part title to a clinical specialty string.

    Uses keyword matching (case-insensitive, first match wins).
    Falls back to ``"General Medicine"`` when no keyword matches.

    Args:
        part_title: The full Part title (e.g. ``"Disorders of the Cardiovascular System"``).

    Returns:
        A specialty label string (e.g. ``"Cardiology"``).
    """
    lower = part_title.lower()
    for keywords, specialty in _SPECIALTY_RULES:
        if any(kw in lower for kw in keywords):
            return specialty
    return "General Medicine"


# ---------------------------------------------------------------------------
# MongoDB storage
# ---------------------------------------------------------------------------


def store_chapter(db: Database, chapter_data: dict[str, Any]) -> str:  # type: ignore[type-arg]
    """Upsert a chapter document into the ``chapters`` MongoDB collection.

    Constructs a deterministic ``chapter_id`` from ``part_num`` and
    ``chapter_num``, derives ``specialty`` from ``part_title``, and sets
    ``sections`` to an empty list.  If a document with that ``chapter_id``
    already exists the function is a no-op (idempotent).

    Args:
        db: An active ``pymongo.database.Database`` instance.
        chapter_data: Dict containing at minimum:
            ``part_num`` (int), ``chapter_num`` (int), ``part_title`` (str),
            ``title`` (str), ``page_start`` (int), ``page_end`` (int),
            ``source_pdf`` (str).

    Returns:
        The ``chapter_id`` string for the (possibly newly inserted) document.
    """
    part_num: int = int(chapter_data["part_num"])
    chapter_num: int = int(chapter_data["chapter_num"])
    chapter_id: str = f"p{part_num:02d}_c{chapter_num:03d}"

    collection: Collection[dict[str, Any]] = db["chapters"]

    # Idempotency: skip if already stored
    if collection.find_one({"chapter_id": chapter_id}, {"_id": 1}):
        logger.info("Chapter %s already exists — skipping.", chapter_id)
        return chapter_id

    doc: dict[str, Any] = {
        "chapter_id": chapter_id,
        "part_number": part_num,
        "part_title": chapter_data.get("part_title", ""),
        "chapter_number": chapter_num,
        "title": chapter_data.get("title", ""),
        "specialty": _derive_specialty(chapter_data.get("part_title", "")),
        "page_start": chapter_data.get("page_start", 0),
        "page_end": chapter_data.get("page_end", 0),
        "source_pdf": chapter_data.get("source_pdf", ""),
        "sections": [],
    }

    collection.insert_one(doc)
    logger.info("Stored chapter %s: %s", chapter_id, doc["title"])
    return chapter_id


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest Harrison's PDF parts into MongoDB (chapters + text_chunks)."
    )
    parser.add_argument(
        "--pdf-path",
        default=PDF_FULL_PATH,
        help=f"Path to the full Harrison's PDF (default: {PDF_FULL_PATH})",
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

    print(f"PDF_FULL_PATH        : {args.pdf_path}")
    print(f"MONGO_URI            : {MONGO_URI}")
    print(f"CHUNK_MAX_TOKENS     : {CHUNK_MAX_TOKENS}")
    print(f"CHUNK_OVERLAP_TOKENS : {CHUNK_OVERLAP_TOKENS}")
    print(f"Dry run              : {args.dry_run}")
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
