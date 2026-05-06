export const READER_UNIT_MIN_CHARS = 900;
export const READER_UNIT_MAX_SECTIONS = 3;

export interface ReaderSectionLike {
  content: string;
}

export function sectionReadableLength(section: ReaderSectionLike): number {
  return section.content.replace(/\s+/g, " ").trim().length;
}

export function getReaderUnitEndIndex(
  sections: ReaderSectionLike[],
  startIndex: number,
  minChars = READER_UNIT_MIN_CHARS,
  maxSections = READER_UNIT_MAX_SECTIONS
): number {
  if (sections.length === 0) return 0;

  const safeStart = Math.min(Math.max(startIndex, 0), sections.length - 1);
  let totalChars = 0;
  let endIndex = safeStart;

  while (endIndex < sections.length && endIndex < safeStart + maxSections) {
    totalChars += sectionReadableLength(sections[endIndex]);
    endIndex += 1;
    if (totalChars >= minChars) break;
  }

  return endIndex;
}

export function getPreviousReaderUnitStart(
  sections: ReaderSectionLike[],
  currentStartIndex: number,
  minChars = READER_UNIT_MIN_CHARS,
  maxSections = READER_UNIT_MAX_SECTIONS
): number {
  if (currentStartIndex <= 0 || sections.length === 0) return 0;

  let cursor = 0;
  let previousStart = 0;

  while (cursor < currentStartIndex) {
    previousStart = cursor;
    const nextCursor = getReaderUnitEndIndex(sections, cursor, minChars, maxSections);
    if (nextCursor >= currentStartIndex) break;
    cursor = nextCursor;
  }

  return previousStart;
}
