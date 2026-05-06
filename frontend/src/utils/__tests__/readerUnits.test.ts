import { getPreviousReaderUnitStart, getReaderUnitEndIndex } from "../readerUnits";

const section = (length: number) => ({ content: "x".repeat(length) });

describe("reader unit grouping", () => {
  it("merges tiny adjacent sections until the minimum size is reached", () => {
    const sections = [section(250), section(300), section(400), section(500)];

    expect(getReaderUnitEndIndex(sections, 0, 900, 3)).toBe(3);
  });

  it("keeps a large section as a standalone unit", () => {
    const sections = [section(1200), section(200), section(200)];

    expect(getReaderUnitEndIndex(sections, 0, 900, 3)).toBe(1);
  });

  it("respects the max section cap", () => {
    const sections = [section(100), section(100), section(100), section(900)];

    expect(getReaderUnitEndIndex(sections, 0, 900, 3)).toBe(3);
  });

  it("allows the final short section to stand alone", () => {
    const sections = [section(1200), section(100)];

    expect(getReaderUnitEndIndex(sections, 1, 900, 3)).toBe(2);
  });

  it("finds the previous grouped unit start", () => {
    const sections = [section(250), section(300), section(400), section(1200)];

    expect(getPreviousReaderUnitStart(sections, 3, 900, 3)).toBe(0);
  });
});
