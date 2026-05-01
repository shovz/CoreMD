import html
import re
from collections import Counter
from pathlib import Path
from typing import Any, List, Optional, Tuple
import fitz  # PyMuPDF

_BULLET_STRIP_RE = re.compile(r"^[■•▪▸→\-–—\s]+")


def _dominant_body_size(doc: fitz.Document, page_start: int, page_end: int) -> float:
    """Return the most common (body text) font size across the given page range."""
    sizes: Counter = Counter()
    for page_num in range(page_start, min(page_end + 1, len(doc))):
        for block in doc[page_num].get_text("dict").get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    sz = round(span.get("size", 0), 1)
                    if sz > 5:
                        sizes[sz] += 1
    return sizes.most_common(1)[0][0] if sizes else 11.0


def _render_table_html(table: Any) -> str:
    """Render a PyMuPDF table object as a styled HTML <table> element.

    Returns empty string for tables that look like false positives (< 3 rows).
    """
    try:
        rows = table.extract()
    except Exception:
        return ""
    # Require at least 3 rows (header + 2 data) to filter out layout artifacts
    # like chapter/section headers that PyMuPDF may interpret as 2-row tables
    if not rows or len(rows) < 3:
        return ""

    parts = [
        '<div class="table-wrapper" style="overflow-x:auto;margin:20px 0;">',
        '<table style="border-collapse:collapse;width:100%;font-size:0.875rem;line-height:1.5;">',
    ]
    for row_idx, row in enumerate(rows):
        parts.append("<tr>")
        for cell in row:
            cell_text = html.escape(str(cell).strip()) if cell else ""
            if row_idx == 0:
                parts.append(
                    f'<th style="border:1px solid #cbd5e1;padding:8px 12px;'
                    f'background:#f1f5f9;font-weight:600;text-align:left;">{cell_text}</th>'
                )
            else:
                bg = "background:#f8fafc;" if row_idx % 2 == 0 else ""
                parts.append(
                    f'<td style="border:1px solid #cbd5e1;padding:6px 12px;{bg}">{cell_text}</td>'
                )
        parts.append("</tr>")
    parts += ["</table>", "</div>"]
    return "\n".join(parts)


def extract_page_html(
    pdf_path: str,
    page_start: int,
    page_end: int,
    chapter_id: str = "",
    images_dir: Optional[Path] = None,
) -> str:
    """Extract structured HTML from a page range in a PDF.

    Text-based tables detected via find_tables() are rendered as <table> elements
    and merged into the output in reading order alongside regular paragraphs and images.
    """
    doc = fitz.open(pdf_path)

    body_size = _dominant_body_size(doc, page_start, page_end)
    h2_threshold = body_size * 1.25  # ≥25% larger than body = major heading
    h3_threshold = body_size * 1.10  # ≥10% larger than body = subheading

    blocks_html: List[str] = []

    for page_num in range(page_start, min(page_end + 1, len(doc))):
        page = doc[page_num]

        # ── Detect tables ──────────────────────────────────────────────────────
        table_rects: List[fitz.Rect] = []
        table_items: List[Tuple[float, Any]] = []
        try:
            finder = page.find_tables()
            for t in finder.tables:
                rect = fitz.Rect(t.bbox)
                table_rects.append(rect)
                table_items.append((t.bbox[1], t))
        except Exception:
            pass  # find_tables() unavailable or failed — fall back to text-only

        # ── Collect non-table blocks ───────────────────────────────────────────
        block_items: List[Tuple[float, dict]] = []
        page_dict = page.get_text("dict")
        for block in page_dict.get("blocks", []):
            bbox = block.get("bbox", (0, 0, 0, 0))
            block_rect = fitz.Rect(bbox)
            # Skip any block whose region overlaps with a detected table
            if any(tr.intersects(block_rect) for tr in table_rects):
                continue
            block_items.append((bbox[1], block))

        # ── Merge into reading order (top → bottom) ────────────────────────────
        all_items: List[Tuple[float, str, Any]] = (
            [(y, "table", t) for y, t in table_items]
            + [(y, "block", b) for y, b in block_items]
        )
        all_items.sort(key=lambda x: x[0])

        # ── Render ─────────────────────────────────────────────────────────────
        for _, item_type, data in all_items:
            if item_type == "table":
                table_html = _render_table_html(data)
                if table_html:
                    blocks_html.append(table_html)
                continue

            block = data

            if block.get("type") == 1:  # image block
                if images_dir is None or not chapter_id:
                    continue
                w = block.get("width", 0)
                h = block.get("height", 0)
                if w < 100 or h < 100:
                    continue
                img_bytes = block.get("image", b"")
                if not img_bytes:
                    continue
                try:
                    pix = fitz.Pixmap(img_bytes)
                    if pix.n - pix.alpha > 3:  # CMYK → RGB
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    bbox = block.get("bbox", (0, 0, 0, 0))
                    filename = (
                        f"{chapter_id}_p{page_num}_{int(bbox[0])}_{int(bbox[1])}.jpg"
                    )
                    (images_dir / filename).write_bytes(pix.tobytes("jpeg"))
                    blocks_html.append(
                        f'<img src="/static/images/{filename}"'
                        f' style="max-width:100%;margin:16px 0;" alt="" />'
                    )
                except Exception:
                    pass
                continue

            if block.get("type") != 0:
                continue

            lines = block.get("lines", [])
            if not lines:
                continue

            line_items: List[tuple[str, float, int]] = []
            for line in lines:
                spans = line.get("spans", [])
                if not spans:
                    continue

                parts: List[str] = []
                dominant_size = 0.0
                for span in spans:
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    size = span.get("size", 10.0)
                    if size > dominant_size:
                        dominant_size = size
                    parts.append(html.escape(text))

                if parts:
                    line_items.append((" ".join(parts), dominant_size, 0))

            if not line_items:
                continue

            max_size = max(size for _, size, _ in line_items)

            first_line_spans = lines[0].get("spans", []) if lines else []
            first_line_text = "".join(
                s.get("text", "") for s in first_line_spans
            ).strip()
            is_all_caps_short = (
                len(lines) <= 2
                and bool(first_line_text)
                and any(c.isalpha() for c in first_line_text)
                and first_line_text == first_line_text.upper()
                and len(first_line_text) <= 60
            )

            # Find the first line that is NOT an all-caps heading line.
            # Leading all-caps lines (e.g. "■ UNCERTAINTY IN DIAGNOSIS") are
            # split off as a separate <h2> so section-boundary detection works.
            split_at: Optional[int] = None
            for i, (_, _, _) in enumerate(line_items):
                raw = "".join(
                    s.get("text", "")
                    for s in (lines[i].get("spans", []) if i < len(lines) else [])
                ).strip()
                cleaned = _BULLET_STRIP_RE.sub("", raw).strip()
                if not (cleaned and any(c.isalpha() for c in cleaned) and cleaned == cleaned.upper()):
                    split_at = i
                    break

            if split_at and split_at > 0:
                heading_content = " ".join(t for t, _, _ in line_items[:split_at]).strip()
                body_content = " ".join(t for t, _, _ in line_items[split_at:]).strip()
                if heading_content:
                    blocks_html.append(f"<h2>{heading_content}</h2>")
                if body_content:
                    blocks_html.append(f"<p>{body_content}</p>")
                continue

            content = " ".join(text for text, _, _ in line_items).strip()
            if not content:
                continue

            if max_size >= h2_threshold or is_all_caps_short:
                blocks_html.append(f"<h2>{content}</h2>")
            elif max_size >= h3_threshold:
                blocks_html.append(f"<h3>{content}</h3>")
            else:
                blocks_html.append(f"<p>{content}</p>")

    doc.close()
    return "\n".join(blocks_html)
