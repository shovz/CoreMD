import { wrapAcrossBlocks } from "../annotationHtml";

const mark = (seg: string) => `<mark>${seg}</mark>`;
const markFirst = (seg: string, isFirst: boolean) =>
  isFirst ? `<mark class="first">${seg}</mark>` : `<mark>${seg}</mark>`;

describe("wrapAcrossBlocks", () => {
  it("returns source unchanged when selectedText is empty", () => {
    const src = "<p>Hello world</p>";
    expect(wrapAcrossBlocks(src, "", mark)).toBe(src);
  });

  it("returns source unchanged when selectedText not found in source", () => {
    const src = "<p>Hello world</p>";
    expect(wrapAcrossBlocks(src, "missing phrase", mark)).toBe(src);
  });

  it("wraps single-word selection via tier-1 exact match", () => {
    const src = "<p>Hello world</p>";
    const result = wrapAcrossBlocks(src, "world", mark);
    expect(result).toBe("<p>Hello <mark>world</mark></p>");
  });

  it("wraps multi-word phrase within single paragraph", () => {
    const src = "<p>The mitral valve controls blood flow.</p>";
    const result = wrapAcrossBlocks(src, "mitral valve controls", mark);
    expect(result).toContain("<mark>mitral valve controls</mark>");
  });

  it("wraps across two paragraphs when selectedText has newline", () => {
    const src =
      "<p>First paragraph text here.</p><p>Second paragraph text here.</p>";
    const selected = "First paragraph text here.\nSecond paragraph text here.";
    const result = wrapAcrossBlocks(src, selected, mark);
    expect(result).toContain("<mark>First paragraph text here.</mark>");
    expect(result).toContain("<mark>Second paragraph text here.</mark>");
  });

  it("uses tier-2 per-word fallback when text straddles existing <mark> tags", () => {
    // First highlight wraps 'world' → second selection 'Hello world' straddles the <mark>
    const src = "<p>Hello <mark>world</mark> today</p>";
    const result = wrapAcrossBlocks(src, "Hello world", mark);
    // Tier-1 won't match because 'Hello world' is split by <mark>; tier-2 wraps each word
    expect(result).toContain("<mark>Hello</mark>");
    expect(result).toContain("<mark>world</mark>");
  });

  it("isFirst flag true only for first segment in multi-segment selection", () => {
    const src = "<p>Alpha text.</p><p>Beta text.</p>";
    const selected = "Alpha text.\nBeta text.";
    const result = wrapAcrossBlocks(src, selected, markFirst);
    expect(result).toContain('<mark class="first">Alpha text.</mark>');
    expect(result).toContain("<mark>Beta text.</mark>");
  });

  it("escapes regex special characters in selectedText", () => {
    const src = "<p>Price: $5.00 (sale)</p>";
    const result = wrapAcrossBlocks(src, "$5.00 (sale)", mark);
    expect(result).toContain("<mark>$5.00 (sale)</mark>");
  });

  it("wraps all occurrences when same text appears multiple times", () => {
    const src = "<p>aspirin aspirin aspirin</p>";
    const result = wrapAcrossBlocks(src, "aspirin", mark);
    expect((result.match(/<mark>/g) ?? []).length).toBe(3);
  });
});
