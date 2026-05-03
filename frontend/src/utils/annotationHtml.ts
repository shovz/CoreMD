export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const BLOCK_SEPARATOR = "(?:<[^>]+>|\\s)*?";

export function replaceByGroups(
  source: string,
  pattern: string,
  groupCount: number,
  wrap: (segment: string, isFirst: boolean) => string
): string {
  try {
    const regex = new RegExp(pattern, "g");
    return source.replace(regex, (...args) => {
      const fullMatch: string = args[0];
      const groups = args.slice(1, 1 + groupCount) as string[];
      let cursor = 0;
      let out = "";
      groups.forEach((seg, i) => {
        const idx = fullMatch.indexOf(seg, cursor);
        if (idx > cursor) out += fullMatch.slice(cursor, idx);
        out += wrap(seg, i === 0);
        cursor = idx + seg.length;
      });
      if (cursor < fullMatch.length) out += fullMatch.slice(cursor);
      return out;
    });
  } catch {
    return source;
  }
}

/**
 * Injects `wrap` around occurrences of `selectedText` in `source` HTML.
 *
 * Tier 1: match the exact text (or per-line segments separated by HTML tags).
 * Tier 2: per-word permissive fallback for cases where prior wraps have inserted
 *          tags inside the target text, breaking exact-string matching.
 */
export function wrapAcrossBlocks(
  source: string,
  selectedText: string,
  wrap: (segment: string, isFirst: boolean) => string
): string {
  const segments = selectedText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length === 0) return source;

  // Tier 1: per-block segment matching
  try {
    if (segments.length === 1) {
      const simple = new RegExp(escapeRegex(segments[0]));
      if (simple.test(source)) {
        return source.replace(new RegExp(escapeRegex(segments[0]), "g"), (m) => wrap(m, true));
      }
    } else {
      const segPattern = segments.map((s) => `(${escapeRegex(s)})`).join(BLOCK_SEPARATOR);
      if (new RegExp(segPattern).test(source)) {
        return replaceByGroups(source, segPattern, segments.length, wrap);
      }
    }
  } catch {
    /* fall through to per-word */
  }

  // Tier 2: per-word permissive fallback
  const tokens = selectedText.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return source;
  const wordPattern = tokens.map((t) => `(${escapeRegex(t)})`).join(BLOCK_SEPARATOR);
  return replaceByGroups(source, wordPattern, tokens.length, wrap);
}
