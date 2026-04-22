import html
from collections import Counter
from pathlib import Path
from typing import List, Optional
import fitz  # PyMuPDF


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


def extract_page_html(
    pdf_path: str,
    page_start: int,
    page_end: int,
    chapter_id: str = "",
    images_dir: Optional[Path] = None,
) -> str:
    """Extract structured HTML from a page range in a PDF."""
    doc = fitz.open(pdf_path)

    body_size = _dominant_body_size(doc, page_start, page_end)
    h2_threshold = body_size * 1.25  # ≥25% larger than body = major heading
    h3_threshold = body_size * 1.10  # ≥10% larger than body = subheading

    blocks_html: List[str] = []

    for page_num in range(page_start, min(page_end + 1, len(doc))):
        page = doc[page_num]
        page_dict = page.get_text("dict")

        for block in page_dict.get("blocks", []):
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
                    filename = f"{chapter_id}_p{page_num}_{int(bbox[0])}_{int(bbox[1])}.jpg"
                    (images_dir / filename).write_bytes(pix.tobytes("jpeg"))
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
                for span in spans:
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    size = span.get("size", 10.0)
                    if size > dominant_size:
                        dominant_size = size
                    parts.append(html.escape(text))

                if parts:
                    line_text = " ".join(parts)
                    line_items.append((line_text, dominant_size, 0))

            if not line_items:
                continue

            max_size = max(size for _, size, _ in line_items)

            # All-caps short first line = heading even at body size
            first_line_spans = lines[0].get("spans", []) if lines else []
            first_line_text = "".join(s.get("text", "") for s in first_line_spans).strip()
            is_all_caps_short = (
                len(lines) <= 2
                and bool(first_line_text)
                and any(c.isalpha() for c in first_line_text)
                and first_line_text == first_line_text.upper()
                and len(first_line_text) <= 60
            )

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
