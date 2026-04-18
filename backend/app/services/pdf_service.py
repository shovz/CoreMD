import html
from pathlib import Path
from typing import List, Optional
import fitz  # PyMuPDF


def extract_page_html(
    pdf_path: str,
    page_start: int,
    page_end: int,
    chapter_id: str = "",
    images_dir: Optional[Path] = None,
) -> str:
    """Extract structured HTML from a page range in a PDF."""
    doc = fitz.open(pdf_path)
    blocks_html: List[str] = []

    for page_num in range(page_start, min(page_end + 1, len(doc))):
        page = doc[page_num]
        page_dict = page.get_text("dict")

        for block in page_dict.get("blocks", []):
            if block.get("type") == 1:  # image block
                if images_dir is None or not chapter_id:
                    continue
                xref = block.get("xref", 0)
                w = block.get("width", 0)
                h = block.get("height", 0)
                if xref <= 0 or w < 100 or h < 100:
                    continue
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n - pix.alpha > 3:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    filename = f"{chapter_id}_p{page_num}_{xref}.webp"
                    (images_dir / filename).write_bytes(pix.tobytes("webp"))
                    blocks_html.append(
                        f'<img src="/static/images/{filename}" style="max-width:100%;margin:16px 0;" alt="" />'
                    )
                except Exception:
                    pass
                continue

            if block.get("type") != 0:
                continue

            lines = block.get("lines", [])
            if not lines:
                continue

            # Collect line texts with their dominant style
            line_items: List[tuple[str, float, int]] = []
            for line in lines:
                spans = line.get("spans", [])
                if not spans:
                    continue

                parts: List[str] = []
                dominant_size = 0.0
                dominant_flags = 0
                for span in spans:
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    size = span.get("size", 10.0)
                    flags = span.get("flags", 0)
                    is_bold = bool(flags & 16)
                    is_italic = bool(flags & 2)

                    # Track dominant (largest) span style for the line
                    if size > dominant_size:
                        dominant_size = size
                        dominant_flags = flags

                    escaped = html.escape(text)
                    if is_bold and is_italic:
                        escaped = f"<strong><em>{escaped}</em></strong>"
                    elif is_bold:
                        escaped = f"<strong>{escaped}</strong>"
                    elif is_italic:
                        escaped = f"<em>{escaped}</em>"
                    parts.append(escaped)

                if parts:
                    line_text = " ".join(parts)
                    line_items.append((line_text, dominant_size, dominant_flags))

            if not line_items:
                continue

            # Determine block-level tag from first/dominant line style
            # Use the max size seen in the block
            max_size = max(size for _, size, _ in line_items)
            first_text_plain = "".join(
                span.get("text", "") for line in lines for span in line.get("spans", [])
            ).strip()
            is_all_caps_short = (
                first_text_plain == first_text_plain.upper()
                and len(first_text_plain) <= 80
                and len(first_text_plain) > 0
            )

            # Join all lines in the block into a single content string
            content = " ".join(text for text, _, _ in line_items).strip()
            if not content:
                continue

            if max_size >= 14 or is_all_caps_short:
                blocks_html.append(f"<h2>{content}</h2>")
            elif max_size >= 12:
                blocks_html.append(f"<h3>{content}</h3>")
            else:
                blocks_html.append(f"<p>{content}</p>")

    doc.close()
    return "\n".join(blocks_html)
