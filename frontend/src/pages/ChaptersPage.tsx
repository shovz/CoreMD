import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { useLocation, useParams } from "react-router-dom";
import { wrapAcrossBlocks } from "../utils/annotationHtml";
import { formatReaderHtml, stripLeadingDuplicateHeading } from "../utils/readerFormatting";
import {
  READER_UNIT_MAX_SECTIONS,
  READER_UNIT_MIN_CHARS,
  getPreviousReaderUnitStart,
} from "../utils/readerUnits";
import { getChapters, getChapterById, type Chapter } from "../api/chaptersApi";
import { getSectionById, type SectionResponse } from "../api/sectionApi";
import { useAiContext } from "../context/AiContext";
import {
  createAnnotation,
  getAnnotationsByChapter,
  deleteAnnotation,
  type Annotation,
} from "../api/annotationsApi";

interface Popover {
  x: number;
  y: number;
  text: string;
  sectionId: string;
  mode: "buttons" | "note";
}

function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-semibold text-slate-900">{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Left pane
  const [selectedPart, setSelectedPart] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Right pane / book reader
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [readerSections, setReaderSections] = useState<SectionResponse[]>([]);
  const [sectionLoading, setSectionLoading] = useState(false);

  // Text-selection popover
  const [popover, setPopover] = useState<Popover | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionCacheRef = useRef<Map<string, SectionResponse>>(new Map());
  const lastRouteLoadRef = useRef<string | null>(null);

  // Annotations
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [noteText, setNoteText] = useState("");
  const [showNotesPanel, setShowNotesPanel] = useState(false);

  const { openWithContext } = useAiContext();
  const location = useLocation();
  const routeParams = useParams<{ chapterId?: string; sectionId?: string }>();
  const navState = (location.state ?? {}) as { chapterId?: string; sectionId?: string };
  const initialChapterId = routeParams.chapterId ?? navState.chapterId;
  const initialSectionId = routeParams.sectionId ?? navState.sectionId;

  useEffect(() => {
    getChapters()
      .then((res) => {
        setChapters(res.data);
        setLoading(false);
        const sorted = [...res.data].sort((a, b) => {
          const pd = (a.part_number ?? 0) - (b.part_number ?? 0);
          return pd !== 0 ? pd : (a.chapter_number ?? 0) - (b.chapter_number ?? 0);
        });
        const first = !initialChapterId ? sorted[0] : null;
        if (first) {
          setSelectedPart(first.part_number ?? null);
          handleChapterClick(first.id);
        }
      })
      .catch(() => {
        setError("Failed to load chapters");
        setLoading(false);
      });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!initialChapterId || chapters.length === 0) return;
    const routeLoadKey = `${initialChapterId}:${initialSectionId ?? ""}`;
    if (lastRouteLoadRef.current === routeLoadKey) return;
    const target = chapters.find((ch) => ch.id === initialChapterId);
    if (!target) return;
    lastRouteLoadRef.current = routeLoadKey;
    setSelectedPart(target.part_number ?? null);
    handleChapterClick(initialChapterId, initialSectionId);
  }, [chapters, initialChapterId, initialSectionId]);

  const sortedParts = useMemo(() => {
    const partsMap = new Map<number, { title: string; chapters: Chapter[] }>();
    for (const ch of chapters) {
      const partNum = ch.part_number ?? 0;
      const partTitle = ch.part_title ?? "Other";
      if (!partsMap.has(partNum)) partsMap.set(partNum, { title: partTitle, chapters: [] });
      partsMap.get(partNum)?.chapters.push(ch);
    }
    return [...partsMap.entries()].sort(([a], [b]) => a - b);
  }, [chapters]);

  const visibleParts = useMemo(() => {
    if (!searchQuery) return sortedParts;
    const q = searchQuery.toLowerCase();
    return sortedParts
      .map(([partNum, part]): [number, { title: string; chapters: Chapter[] }] | null => {
        const partMatches =
          part.title.toLowerCase().includes(q) || `part ${partNum}`.includes(q);
        if (partMatches) return [partNum, part];
        const matchingChapters = part.chapters.filter(
          (ch) =>
            ch.title.toLowerCase().includes(q) ||
            (ch.chapter_number != null && String(ch.chapter_number).includes(q))
        );
        if (matchingChapters.length > 0) return [partNum, { ...part, chapters: matchingChapters }];
        return null;
      })
      .filter((x): x is [number, { title: string; chapters: Chapter[] }] => x !== null);
  }, [sortedParts, searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value.trim()), 300);
  };


  async function fetchSection(chapterId: string, sectionId: string) {
    const cacheKey = `${chapterId}:${sectionId}`;
    const cached = sectionCacheRef.current.get(cacheKey);
    if (cached) return cached;
    const res = await getSectionById(chapterId, sectionId);
    sectionCacheRef.current.set(cacheKey, res.data);
    return res.data;
  }

  async function buildReaderUnit(chapter: Chapter, startIndex: number) {
    const start = Math.min(Math.max(startIndex, 0), Math.max(chapter.sections.length - 1, 0));
    const loaded: SectionResponse[] = [];
    let cursor = start;

    while (cursor < chapter.sections.length) {
      const section = chapter.sections[cursor];
      const sectionRes = await fetchSection(chapter.id, section.id);
      loaded.push(sectionRes);
      const totalChars = loaded
        .map((item) => item.content.replace(/\s+/g, " ").trim().length)
        .reduce((sum, len) => sum + len, 0);
      if (totalChars >= READER_UNIT_MIN_CHARS || loaded.length >= READER_UNIT_MAX_SECTIONS) break;
      cursor += 1;
    }

    return loaded;
  }

  async function loadReaderUnit(chapter: Chapter, startIndex: number) {
    setSectionLoading(true);
    setReaderSections([]);
    setPopover(null);
    try {
      const unit = await buildReaderUnit(chapter, startIndex);
      setCurrentSectionIndex(startIndex);
      setReaderSections(unit);
    } finally {
      setSectionLoading(false);
    }
  }

  async function handleChapterClick(chapterId: string, targetSectionId?: string) {
    setSectionLoading(true);
    setReaderSections([]);
    setNoteText("");
    setPopover(null);
    getAnnotationsByChapter(chapterId)
      .then((r) => setAnnotations(r.data))
      .catch(() => setAnnotations([]));
    try {
      const chapterRes = await getChapterById(chapterId);
      const fullChapter = chapterRes.data;
      setCurrentChapter(fullChapter);
      setSelectedPart(fullChapter.part_number ?? null);
      const sectionIndex = targetSectionId
        ? Math.max(0, fullChapter.sections.findIndex((s) => s.id === targetSectionId))
        : 0;
      if (fullChapter.sections.length > 0) {
        const unit = await buildReaderUnit(fullChapter, sectionIndex);
        setCurrentSectionIndex(sectionIndex);
        setReaderSections(unit);
      }
    } finally {
      setSectionLoading(false);
    }
  }

  async function goToReaderUnit(index: number) {
    if (!currentChapter) return;
    const section = currentChapter.sections[index];
    if (!section) return;
    await loadReaderUnit(currentChapter, index);
  }

  async function goToPreviousReaderUnit() {
    if (!currentChapter || currentSectionIndex === 0) return;
    const previousSections = await Promise.all(
      currentChapter.sections
        .slice(0, currentSectionIndex)
        .map((section) => fetchSection(currentChapter.id, section.id))
    );
    const previousStart = getPreviousReaderUnitStart(previousSections, currentSectionIndex);
    await loadReaderUnit(currentChapter, previousStart);
  }

  useEffect(() => {
    function getSectionIdFromNode(node: Node) {
      const element =
        node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      return element?.closest<HTMLElement>("[data-section-id]")?.dataset.sectionId ?? null;
    }

    function handleMouseUp(e: MouseEvent) {
      // Ignore mouseup originating from inside the popover toolbar itself
      if (popoverRef.current?.contains(e.target as Node)) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !contentRef.current) {
        setPopover(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!contentRef.current.contains(range.commonAncestorContainer)) {
        setPopover(null);
        return;
      }
      const startSectionId = getSectionIdFromNode(range.startContainer);
      const endSectionId = getSectionIdFromNode(range.endContainer);
      if (!startSectionId || startSectionId !== endSectionId) {
        setPopover(null);
        return;
      }
      const text = selection.toString().trim();
      if (!text) {
        setPopover(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setPopover({
        x: rect.left + rect.width / 2,
        y: rect.top,
        text,
        sectionId: startSectionId,
        mode: "buttons",
      });
    }

    function handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // Preserve the popover while the note textarea has focus
        setPopover((prev) => (prev?.mode === "note" ? prev : null));
      }
    }

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  function handleAskAi() {
    if (!popover || !currentChapter) return;
    const selectedSection = readerSections.find((section) => section.section_id === popover.sectionId);
    setPopover(null);
    window.getSelection()?.removeAllRanges();
    openWithContext({
      selected_text: popover.text,
      chapter_id: currentChapter.id,
      section_id: popover.sectionId,
      chapter_title: currentChapter.title,
      section_title: selectedSection?.section_title,
    });
  }

  async function handleSaveNote() {
    if (!popover || !currentChapter) return;
    try {
      const res = await createAnnotation({
        chapter_id: currentChapter.id,
        section_id: popover.sectionId,
        selected_text: popover.text,
        note_text: noteText,
      });
      setAnnotations((prev) => [...prev, res.data]);
      setPopover(null);
      setNoteText("");
    } catch {
      // ignore
    }
  }

  async function handleDeleteAnnotation(id: string) {
    try {
      await deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // ignore
    }
  }

  const readerSectionIds = useMemo(
    () => new Set(readerSections.map((section) => section.section_id)),
    [readerSections]
  );

  const sectionNotes = useMemo(
    () =>
      annotations.filter(
        (a) => a.note_text !== "" && readerSectionIds.has(a.section_id)
      ),
    [annotations, readerSectionIds]
  );

  const apiBase = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(
    "/api/v1",
    ""
  );

  const displaySections = useMemo(() => {
    return readerSections.map((section) => {
      const readerHtml = formatReaderHtml(
        section.html_content?.replace(/src="\/static\//g, `src="${apiBase}/static/`),
        section.content
      );
      let html = readerHtml
        ? DOMPurify.sanitize(stripLeadingDuplicateHeading(readerHtml, section.section_title))
        : "";
      const highlights = annotations.filter(
        (a) => a.note_text === "" && a.section_id === section.section_id
      );
      const notes = annotations.filter(
        (a) => a.note_text !== "" && a.section_id === section.section_id
      );
      for (const ann of highlights) {
        html = wrapAcrossBlocks(
          html,
          ann.selected_text,
          (seg) => `<mark class="annotation-highlight">${seg}</mark>`
        );
      }
      notes.forEach((ann) => {
        const noteIndex = sectionNotes.indexOf(ann);
        html = wrapAcrossBlocks(
          html,
          ann.selected_text,
          (seg, isFirst) =>
            isFirst
              ? `<span class="annotation-note" data-note-id="${ann.id}" data-note-num="${noteIndex + 1}">${seg}</span>`
              : `<span class="annotation-note" data-note-id="${ann.id}">${seg}</span>`
        );
      });
      return { section, html };
    });
  }, [annotations, apiBase, readerSections, sectionNotes]);

  if (loading) return <p className="p-6 text-slate-600">Loading chapters...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  const totalSections = currentChapter?.sections.length ?? 0;
  const readerUnitEndIndex = Math.min(currentSectionIndex + readerSections.length, totalSections);
  const readerUnitLabel =
    readerSections.length > 1
      ? `Sections ${currentSectionIndex + 1}-${readerUnitEndIndex} of ${totalSections}`
      : `Section ${currentSectionIndex + 1} of ${totalSections}`;
  const nextReaderUnitIndex = readerUnitEndIndex;
  const isGroupedReaderUnit = readerSections.length > 1;

  return (
    <div className="flex h-full">
      {/* Floating selection popover */}
      {popover && (
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            left: popover.x,
            top: popover.y,
            transform: "translate(-50%, calc(-100% - 8px))",
            zIndex: 60,
          }}
          onPointerDown={(e) => e.preventDefault()}
        >
          {popover.mode === "buttons" ? (
            <div className="flex gap-1 rounded-lg bg-slate-800 px-1 py-1 shadow-lg">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAskAi}
                className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                Ask AI
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPopover((prev) => prev ? { ...prev, mode: "note" } : null)}
                className="whitespace-nowrap rounded-md bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-500"
              >
                Add Note
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                disabled={!currentChapter}
                onClick={async () => {
                  if (!popover || !currentChapter) return;
                  try {
                    const res = await createAnnotation({
                      chapter_id: currentChapter.id,
                      section_id: popover.sectionId,
                      selected_text: popover.text,
                      note_text: "",
                    });
                    setAnnotations((prev) => [...prev, res.data]);
                    setPopover(null);
                    window.getSelection()?.removeAllRanges();
                  } catch {
                    // ignore
                  }
                }}
                className="whitespace-nowrap rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
              >
                Highlight
              </button>
            </div>
          ) : (
            <div className="w-64 rounded-lg bg-slate-800 p-2 shadow-lg">
              <textarea
                autoFocus
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Your note…"
                className="w-full resize-none rounded-md border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white placeholder-slate-400 outline-none focus:border-blue-400"
              />
              <div className="mt-1.5 flex gap-1.5">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleSaveNote}
                  disabled={!noteText.trim()}
                  className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setPopover((prev) => prev ? { ...prev, mode: "buttons" } : null); setNoteText(""); }}
                  className="rounded-md border border-slate-600 px-3 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Left pane: two-column secondary sidebar */}
      <aside className="chapters-shell">
        <div className="chapters-searchbar">
          <div className="relative">
            <input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search chapters..."
              className="chapters-search-input pr-9"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-sm text-[var(--ink-dim)] transition hover:bg-[var(--ink-4)] hover:text-[var(--ink)]"
                aria-label="Clear chapter search"
              >
                x
              </button>
            )}
          </div>
        </div>

        {searchQuery ? (
          <nav className="modern-scrollbar flex-1 overflow-y-auto" aria-label="Chapter search results">
            {visibleParts.length === 0 ? (
              <p className="p-4 text-sm text-[var(--ink-dim)]">
                No results for &ldquo;{searchQuery}&rdquo;
              </p>
            ) : (
              visibleParts.map(([partNum, part]) => (
                <div key={partNum} className="chapter-search-group">
                  <div className="chapter-search-heading">Part {partNum}</div>
                  {[...part.chapters]
                    .sort((a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0))
                    .map((ch) => {
                      const isActive = currentChapter?.id === ch.id;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => handleChapterClick(ch.id)}
                          className={`chapter-row ${isActive ? "chapter-row-active" : ""}`}
                        >
                          {ch.chapter_number != null && (
                            <span className="chapter-number">Ch. {ch.chapter_number}</span>
                          )}
                          <span className="chapter-title">
                            {highlight(ch.title, searchQuery)}
                          </span>
                        </button>
                      );
                    })}
                </div>
              ))
            )}
          </nav>
        ) : (
          <div className="chapter-browser">
            <div className="parts-rail modern-scrollbar">
              {sortedParts.map(([partNum, part]) => (
                <button
                  key={partNum}
                  onClick={() => setSelectedPart(partNum)}
                  className={`part-button ${selectedPart === partNum ? "part-button-active" : ""}`}
                >
                  <span className="part-kicker">
                    <span>Part {partNum}</span>
                    <span>{part.chapters.length}</span>
                  </span>
                  <span className="part-title">{part.title}</span>
                </button>
              ))}
            </div>

            <nav className="chapters-rail modern-scrollbar" aria-label="Chapters">
              {(() => {
                const entry = sortedParts.find(([n]) => n === selectedPart);
                if (!entry) return null;
                const [partNum, part] = entry;
                return (
                  <>
                    <div className="chapters-rail-header">
                      <div className="chapters-rail-eyebrow">
                        Part {partNum}, {part.chapters.length} chapters
                      </div>
                      <div className="chapters-rail-title">{part.title}</div>
                    </div>
                    {[...part.chapters]
                      .sort((a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0))
                      .map((ch) => {
                        const isActive = currentChapter?.id === ch.id;
                        return (
                          <button
                            key={ch.id}
                            onClick={() => handleChapterClick(ch.id)}
                            className={`chapter-row ${isActive ? "chapter-row-active" : ""}`}
                          >
                            {ch.chapter_number != null && (
                              <span className="chapter-number">Ch. {ch.chapter_number}</span>
                            )}
                            <span className="chapter-title">{ch.title}</span>
                          </button>
                        );
                      })}
                  </>
                );
              })()}
            </nav>
          </div>
        )}
      </aside>
      {/* Right pane: book reader */}
      <main className="min-w-0 flex-1 flex overflow-hidden">
        {sectionLoading ? (
          <div className="flex flex-1 items-center justify-center text-slate-500">
            <p>Loading section…</p>
          </div>
        ) : !currentChapter ? (
          <div className="flex flex-1 items-center justify-center p-12 text-center">
            <p className="text-lg font-medium text-slate-500">
              Select a chapter from the left to start reading
            </p>
          </div>
        ) : (
          <>
            {/* Content area */}
            <div className="flex flex-1 flex-col overflow-hidden px-8 py-6 min-w-0">
              {/* Heading row */}
              <div className="flex-shrink-0 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold leading-tight text-slate-900">
                    {readerSections[0]?.chapter_title ?? currentChapter.title}
                    {readerSections[0] && (
                      <>
                        <span className="mx-2 font-normal text-slate-400">›</span>
                        <span className="text-slate-700">{readerSections[0].section_title}</span>
                      </>
                    )}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>{readerUnitLabel}</span>
                    {isGroupedReaderUnit && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        Grouped for readability
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowNotesPanel((v) => !v)}
                  className={`flex-shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    showNotesPanel
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>Notes</span>
                  {annotations.length > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                        showNotesPanel ? "bg-amber-200 text-amber-800" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {annotations.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Scrollable section content */}
              <div className="modern-scrollbar mt-6 flex-1 overflow-y-auto" ref={contentRef}>
                {displaySections.length > 0 ? (
                  <div className="section-content space-y-8">
                    {displaySections.map(({ section, html }, index) => (
                      <section
                        key={section.section_id}
                        data-section-id={section.section_id}
                        className={index > 0 ? "border-t border-slate-200 pt-6" : undefined}
                      >
                        {isGroupedReaderUnit && (
                          <h2 className="reader-subsection-title">{section.section_title}</h2>
                        )}
                        <div dangerouslySetInnerHTML={{ __html: html }} />
                      </section>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Prev / Next */}
              <div className=" mr-20 mt-4 flex-shrink-0 flex items-center justify-between border-t border-slate-200 pt-4">
                <button
                  onClick={goToPreviousReaderUnit}
                  disabled={currentSectionIndex === 0}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-sm text-slate-500">
                  {readerUnitLabel}
                </span>
                <button
                  onClick={() => goToReaderUnit(nextReaderUnitIndex)}
                  disabled={nextReaderUnitIndex >= totalSections}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Notes sidebar panel */}
            {showNotesPanel && (
              <div className="w-[280px] flex-shrink-0 border-l border-slate-200 flex flex-col overflow-hidden bg-slate-50">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-800">
                    Notes ({annotations.length})
                  </h2>
                  <button
                    onClick={() => setShowNotesPanel(false)}
                    className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                    aria-label="Close notes panel"
                  >
                    ×
                  </button>
                </div>
                <div className="modern-scrollbar flex-1 overflow-y-auto p-3 space-y-3">
                  {annotations.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center mt-4">
                      No notes yet. Select text and click "Add Note".
                    </p>
                  ) : (
                    annotations.map((ann) => {
                      const noteIndex = sectionNotes.indexOf(ann);
                      const isCurrentSectionNote = noteIndex !== -1;
                      return (
                        <div
                          key={ann.id}
                          onClick={
                            isCurrentSectionNote
                              ? () =>
                                  document
                                    .querySelector(`[data-note-id="${ann.id}"]`)
                                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                              : undefined
                          }
                          className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${
                            isCurrentSectionNote
                              ? "cursor-pointer hover:border-amber-300 hover:shadow-md transition-shadow"
                              : ""
                          }`}
                        >
                          <div className="mb-1.5 flex items-center gap-1.5">
                            {isCurrentSectionNote && (
                              <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                                {noteIndex + 1}
                              </span>
                            )}
                            <p className="text-xs italic text-slate-500 line-clamp-2">
                              &ldquo;{ann.selected_text.slice(0, 60)}{ann.selected_text.length > 60 ? "…" : ""}&rdquo;
                            </p>
                          </div>
                          {ann.note_text === "" ? (
                            <p className="text-sm font-medium text-amber-600">🔖 Highlight</p>
                          ) : (
                            <p className="text-sm text-slate-800">{ann.note_text}</p>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAnnotation(ann.id);
                            }}
                            className="mt-2 text-xs text-red-500 hover:text-red-700 transition"
                          >
                            Delete
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
