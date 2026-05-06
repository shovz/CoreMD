const STRUCTURAL_TAGS = new Set([
  "H1",
  "H2",
  "H3",
  "H4",
  "TABLE",
  "IMG",
  "UL",
  "OL",
  "BLOCKQUOTE",
]);

const MAX_PARAGRAPH_CHARS = 720;
const MIN_PARAGRAPH_CHARS = 260;
const HEADING_SELECTOR = "h1,h2,h3,h4,p";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHeadingLike(value: string): boolean {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < 4 || text.length > 90) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  if (/[.!?]$/.test(text)) return false;
  if (/^\d+(\.\d+)*\s+[\w(]/.test(text)) return true;
  if (/^(table|figure|case|approach|diagnosis|treatment|management)\b/i.test(text)) return true;

  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 4 && letters === letters.toUpperCase()) return true;

  const words = text.split(/\s+/);
  const titleWords = words.filter((word) => /^[A-Z][A-Za-z0-9(/-]*$/.test(word));
  return words.length <= 8 && titleWords.length >= Math.max(2, Math.ceil(words.length * 0.7));
}

function normalizeHeading(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function splitLongText(value: string): string[] {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return [];
  if (text.length <= MAX_PARAGRAPH_CHARS) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) ?? [text];
  const paragraphs: string[] = [];
  let current = "";

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    const next = current ? `${current} ${sentence}` : sentence;
    if (current.length >= MIN_PARAGRAPH_CHARS && next.length > MAX_PARAGRAPH_CHARS) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) paragraphs.push(current);
  return paragraphs.flatMap((paragraph) => {
    if (paragraph.length <= MAX_PARAGRAPH_CHARS * 1.25) return [paragraph];
    return paragraph.match(new RegExp(`.{1,${MAX_PARAGRAPH_CHARS}}(?:\\s|$)`, "g")) ?? [paragraph];
  }).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function textToReaderBlocks(value: string): string {
  const chunks = value
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks
    .flatMap((chunk) => {
      const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length > 1) {
        return lines.flatMap((line) =>
          isHeadingLike(line)
            ? [`<h3>${escapeHtml(line)}</h3>`]
            : splitLongText(line).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        );
      }

      const [line] = lines;
      if (!line) return [];
      if (isHeadingLike(line)) return [`<h3>${escapeHtml(line)}</h3>`];
      return splitLongText(line).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`);
    })
    .join("\n");
}

function formatElement(element: Element): string {
  const tag = element.tagName;
  if (tag === "SCRIPT" || tag === "STYLE") return "";
  if (tag === "P") {
    const text = element.textContent?.trim() ?? "";
    if (isHeadingLike(text)) return `<h3>${escapeHtml(text)}</h3>`;
    if (text.length <= MAX_PARAGRAPH_CHARS && !text.includes("\n")) return element.outerHTML;
    return textToReaderBlocks(text);
  }
  if (STRUCTURAL_TAGS.has(tag)) return element.outerHTML;
  if (element.children.length === 0) return textToReaderBlocks(element.textContent ?? "");

  const children = Array.from(element.childNodes)
    .map((node) => {
      if (node.nodeType === Node.TEXT_NODE) return textToReaderBlocks(node.textContent ?? "");
      if (node.nodeType === Node.ELEMENT_NODE) return formatElement(node as Element);
      return "";
    })
    .filter(Boolean);

  return children.join("\n");
}

export function formatReaderHtml(
  htmlContent?: string | null,
  plainContent?: string | null
): string | null {
  const html = htmlContent?.trim();
  if (!html) {
    const fallback = plainContent?.trim();
    return fallback ? textToReaderBlocks(fallback) : null;
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  const formatted = Array.from(template.content.childNodes)
    .map((node) => {
      if (node.nodeType === Node.TEXT_NODE) return textToReaderBlocks(node.textContent ?? "");
      if (node.nodeType === Node.ELEMENT_NODE) return formatElement(node as Element);
      return "";
    })
    .filter(Boolean)
    .join("\n");

  return formatted || null;
}

export function stripLeadingDuplicateHeading(html: string, title: string): string {
  const normalizedTitle = normalizeHeading(title);
  if (!html.trim() || !normalizedTitle) return html;

  const template = document.createElement("template");
  template.innerHTML = html;
  const firstElement = Array.from(template.content.children).find((element) =>
    element.matches(HEADING_SELECTOR)
  );

  if (firstElement && normalizeHeading(firstElement.textContent ?? "") === normalizedTitle) {
    firstElement.remove();
  }

  return template.innerHTML;
}
