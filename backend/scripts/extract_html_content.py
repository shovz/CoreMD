"""
extract_html_content.py — One-time script to populate the `section_html` collection.

For each chapter in MongoDB (sorted by part_number, chapter_number):
  - Extracts structured HTML from the Harrison PDF using extract_page_html()
  - Splits the HTML into per-section slices using section title heading markers
  - Upserts {section_id, chapter_id, html_content, updated_at} into `section_html`

Usage:
    python backend/scripts/extract_html_content.py [--dry-run]

Idempotent: safe to re-run.
"""

import argparse
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.operations import UpdateOne

# Load .env from backend/ (one level up from scripts/)
_ENV_PATH = Path(__file__).parent.parent / ".env"
load_dotenv(_ENV_PATH)

# Add backend/ to sys.path so we can import from app.services
_BACKEND_DIR = Path(__file__).parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.services.pdf_service import extract_page_html  # noqa: E402

# ---------------------------------------------------------------------------
# Config
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
IMAGES_DIR: Path = Path(__file__).parent.parent / "static" / "images"

# ---------------------------------------------------------------------------
# HTML section splitting
# ---------------------------------------------------------------------------

_HEADING_RE = re.compile(r"<h[23]>(.*?)</h[23]>", re.IGNORECASE | re.DOTALL)
_PARA_RE = re.compile(r"<p>(.*?)</p>", re.IGNORECASE | re.DOTALL)
_TAG_RE = re.compile(r"<[^>]+>")
_BULLET_RE = re.compile(r"^[■•▪▸→\-–—\s]+")
_WS_RE = re.compile(r"\s+")


def _strip_tags(text: str) -> str:
    return _TAG_RE.sub("", text).strip()


def _normalize_title(text: str) -> str:
    """Normalize a section title or heading for comparison.

    Strips leading bullet/dash chars (■ • ▪ ▸ → - – —), collapses whitespace,
    and uppercases. Applied to both stored titles and extracted heading text so
    that mismatches caused by bullets or extra spaces don't break the split.
    """
    text = _BULLET_RE.sub("", _strip_tags(text)).strip()
    return _WS_RE.sub(" ", text).upper()


def split_html_into_sections(
    html_content: str,
    sections: list[dict[str, str]],
) -> dict[str, str]:
    """Split chapter HTML into per-section HTML using section titles as boundaries.

    Matches <h2>/<h3> OR <p> line text against stored section titles (normalized:
    bullets stripped, whitespace collapsed, uppercased). Falls back to <p> matching
    because pdf_service.py often renders section headings as <p> tags when the
    font-size heuristic doesn't trigger.
    """
    if not sections:
        return {}

    if len(sections) == 1:
        return {sections[0]["id"]: html_content}

    # normalized title → section_id
    title_map: dict[str, str] = {
        _normalize_title(sec["title"]): sec["id"]
        for sec in sections
    }

    lines = html_content.splitlines()
    current_id = sections[0]["id"]
    buffers: dict[str, list[str]] = {sec["id"]: [] for sec in sections}

    for line in lines:
        stripped = line.strip()
        # Try heading tags first, then plain <p> blocks as fallback
        heading_match = _HEADING_RE.fullmatch(stripped)
        match = heading_match or _PARA_RE.fullmatch(stripped)
        if match:
            heading_text = _normalize_title(match.group(1))
            if heading_text in title_map:
                current_id = title_map[heading_text]
            elif heading_match:
                # Endswith fallback: stored title may be a suffix of the full
                # heading (e.g. stored "PATIENT SAFETY ISSUE" vs extracted
                # "EMERGENCE OF DIAGNOSIS ERROR AS AN IMPORTANT PATIENT SAFETY ISSUE")
                for stored_norm, sec_id in title_map.items():
                    if len(stored_norm.split()) >= 2 and heading_text.endswith(stored_norm):
                        current_id = sec_id
                        break

        buffers[current_id].append(line)

    return {sec_id: "\n".join(buf) for sec_id, buf in buffers.items()}


# ---------------------------------------------------------------------------
# MongoDB upsert
# ---------------------------------------------------------------------------


def upsert_section_html(
    collection: Collection[dict[str, Any]],
    section_id: str,
    chapter_id: str,
    html_content: str,
) -> None:
    collection.update_one(
        {"section_id": section_id},
        {
            "$set": {
                "section_id": section_id,
                "chapter_id": chapter_id,
                "html_content": html_content,
                "updated_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]

    parser = argparse.ArgumentParser(
        description="Populate section_html collection from Harrison's PDF."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print progress without writing to MongoDB.",
    )
    parser.add_argument(
        "--pdf-path",
        default=PDF_FULL_PATH,
        help=f"Path to the full Harrison's PDF (default: {PDF_FULL_PATH})",
    )
    parser.add_argument(
        "--chapter-id",
        default=None,
        help="Process only this chapter_id (e.g. ch9). Omit to process all.",
    )
    args = parser.parse_args()

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    print(f"PDF path   : {args.pdf_path}")
    print(f"Mongo URI  : {MONGO_URI}")
    print(f"Images dir : {IMAGES_DIR}")
    print(f"Dry run    : {args.dry_run}")
    if args.chapter_id:
        print(f"Chapter    : {args.chapter_id} (single-chapter mode)")
    print()

    mongo_client: MongoClient[dict[str, Any]] = MongoClient(MONGO_URI)
    db_name: str = MONGO_URI.rsplit("/", 1)[-1].split("?")[0]
    db: Database[dict[str, Any]] = mongo_client[db_name]
    collection: Collection[dict[str, Any]] = db["section_html"]

    try:
        chapters = list(
            db["chapters"]
            .find(
                {},
                {
                    "chapter_id": 1,
                    "part_number": 1,
                    "chapter_number": 1,
                    "page_start": 1,
                    "page_end": 1,
                    "sections": 1,
                },
            )
            .sort([("part_number", 1), ("chapter_number", 1)])
        )

        if not chapters:
            print("No chapters found in MongoDB. Run ingest_pdfs.py first.")
            return

        print(f"Found {len(chapters)} chapters to process.\n")

        for chapter in chapters:
            chapter_id: str = chapter["chapter_id"]
            if args.chapter_id and chapter_id != args.chapter_id:
                continue
            part_num: int = chapter.get("part_number", 0)
            page_start: int = chapter.get("page_start", 0)
            page_end: int = chapter.get("page_end", 0)
            sections: list[dict[str, str]] = chapter.get("sections", [])

            if not sections:
                print(
                    f"Part {part_num} | Chapter {chapter_id} | 0 sections"
                    " (skipped — no sections metadata)"
                )
                continue

            # extract_page_html uses 0-based PyMuPDF page indices;
            # MongoDB stores 1-based page numbers from get_toc().
            imgs_before = len(list(IMAGES_DIR.glob(f"{chapter_id}_*.jpg")))
            html_content = extract_page_html(
                args.pdf_path,
                page_start - 1,
                page_end - 1,
                chapter_id=chapter_id,
                images_dir=IMAGES_DIR,
            )
            imgs_after = len(list(IMAGES_DIR.glob(f"{chapter_id}_*.jpg")))
            img_count = imgs_after - imgs_before

            section_html_map = split_html_into_sections(html_content, sections)

            if not args.dry_run:
                ops: list[UpdateOne] = [
                    UpdateOne(
                        {"section_id": sec["id"]},
                        {
                            "$set": {
                                "section_id": sec["id"],
                                "chapter_id": chapter_id,
                                "html_content": section_html_map.get(sec["id"], ""),
                                "updated_at": datetime.now(timezone.utc),
                            }
                        },
                        upsert=True,
                    )
                    for sec in sections
                ]
                if ops:
                    collection.bulk_write(ops, ordered=False)

            stored = len(sections)
            print(f"Part {part_num} | Chapter {chapter_id} | {stored} sections, {img_count} images")

    finally:
        mongo_client.close()


if __name__ == "__main__":
    main()
