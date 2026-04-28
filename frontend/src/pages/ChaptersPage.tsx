import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
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
  const [expandedPart, setExpandedPart] = useState<number | null>(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Right pane / book reader
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [sectionContent, setSectionContent] = useState<SectionResponse | null>(null);
  const [sectionLoading, setSectionLoading] = useState(false);

  // Text-selection popover
  const [popover, setPopover] = useState<Popover | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Annotations
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [noteText, setNoteText] = useState("");
  const [showNotesPanel, setShowNotesPanel] = useState(false);

  const { openWithText } = useAiContext();

  useEffect(() => {
    getChapters()
      .then((res) => {
        setChapters(res.data);
        setLoading(false);
        const sorted = [...res.data].sort((a, b) => {
          const pd = (a.part_number ?? 0) - (b.part_number ?? 0);
          return pd !== 0 ? pd : (a.chapter_number ?? 0) - (b.chapter_number ?? 0);
        });
        const first = sorted[0];
        if (first) {
          setExpandedPart(first.part_number ?? 1);
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

  function togglePart(partNum: number) {
    if (searchQuery) return;
    setExpandedPart((prev) => (prev === partNum ? null : partNum));
  }

  async function handleChapterClick(chapterId: string) {
    setSectionLoading(true);
    setSectionContent(null);
    setNoteText("");
    getAnnotationsByChapter(chapterId)
      .then((r) => setAnnotations(r.data))
      .catch(() => setAnnotations([]));
    try {
      const chapterRes = await getChapterById(chapterId);
      const fullChapter = chapterRes.data;
      setCurrentChapter(fullChapter);
      setCurrentSectionIndex(0);
      if (fullChapter.sections.length > 0) {
        const sectionRes = await getSectionById(chapterId, fullChapter.sections[0].id);
        setSectionContent(sectionRes.data);
      }
    } finally {
      setSectionLoading(false);
    }
  }

  async function goToSection(index: number) {
    if (!currentChapter) return;
    const section = currentChapter.sections[index];
    if (!section) return;
    setSectionLoading(true);
    setSectionContent(null);
    try {
      const sectionRes = await getSectionById(currentChapter.id, section.id);
      setCurrentSectionIndex(index);
      setSectionContent(sectionRes.data);
    } finally {
      setSectionLoading(false);
    }
  }

  useEffect(() => {
    function handleMouseUp() {
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
      const text = selection.toString().trim();
      if (!text) {
        setPopover(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setPopover({ x: rect.left + rect.width / 2, y: rect.top, text, mode: "buttons" });
    }

    function handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) setPopover(null);
    }

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  function handleAskAi() {
    if (!popover) return;
    const context = sectionContent
      ? `In "${sectionContent.chapter_title} › ${sectionContent.section_title}", the following text appears: `
      : "";
    const text = popover.text;
    setPopover(null);
    window.getSelection()?.removeAllRanges();
    openWithText(`${context}"${text}"`);
  }

  async function handleSaveNote() {
    if (!popover || !currentChapter || !sectionContent) return;
    try {
      const res = await createAnnotation({
        chapter_id: currentChapter.id,
        section_id: sectionContent.section_id,
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

  const apiBase = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(
    "/api/v1",
    ""
  );

  const sanitizedHtml = sectionContent?.html_content
    ? DOMPurify.sanitize(
        sectionContent.html_content.replace(/src="\/static\//g, `src="${apiBase}/static/`)
      )
    : null;

  if (loading) return <p className="p-6 text-slate-600">Loading chapters...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  const totalSections = currentChapter?.sections.length ?? 0;

  return (
    <div className="flex h-full">
      {/* Floating selection popover */}
      {popover && (
        <div
          style={{
            position: "fixed",
            left: popover.x,
            top: popover.y,
            transform: "translate(-50%, calc(-100% - 8px))",
            zIndex: 60,
          }}
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

      {/* Left pane: ~260px sticky full-height */}
      <aside className="w-[260px] flex-shrink-0 border-r border-slate-200 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex-shrink-0">
          <input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search chapters…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <nav className="flex-1 overflow-y-auto">
          {visibleParts.length === 0 && searchQuery && (
            <p className="p-4 text-sm text-slate-500">
              No results for &ldquo;{searchQuery}&rdquo;
            </p>
          )}
          {visibleParts.map(([partNum, part]) => {
            const isOpen = !!searchQuery || expandedPart === partNum;
            const sorted = [...part.chapters].sort(
              (a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0)
            );
            return (
              <div key={partNum} className="border-b border-slate-100">
                <button
                  onClick={() => togglePart(partNum)}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold transition ${
                    isOpen
                      ? "bg-blue-600 text-white"
                      : "bg-slate-50 text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <span className="min-w-0 truncate leading-snug">
                    <span
                      className={`block text-xs font-normal ${isOpen ? "text-blue-200" : "text-slate-400"}`}
                    >
                      Part {partNum}
                    </span>
                    {searchQuery ? highlight(part.title, searchQuery) : part.title}
                  </span>
                  <span
                    className={`ml-2 shrink-0 text-xs ${isOpen ? "text-blue-100" : "text-slate-400"}`}
                  >
                    {isOpen ? "▾" : "▸"}
                  </span>
                </button>

                {isOpen && (
                  <div className="divide-y divide-slate-100 bg-white">
                    {sorted.map((ch) => {
                      const isActive = currentChapter?.id === ch.id;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => handleChapterClick(ch.id)}
                          className={`block w-full px-4 py-2 text-left text-sm transition ${
                            isActive
                              ? "bg-blue-50 font-semibold text-blue-700"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          {ch.chapter_number != null && (
                            <span className="mr-1.5 text-xs text-slate-400">
                              Ch. {ch.chapter_number}
                            </span>
                          )}
                          {searchQuery ? highlight(ch.title, searchQuery) : ch.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
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
                    {sectionContent?.chapter_title ?? currentChapter.title}
                    {sectionContent && (
                      <>
                        <span className="mx-2 font-normal text-slate-400">›</span>
                        <span className="text-slate-700">{sectionContent.section_title}</span>
                      </>
                    )}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Section {currentSectionIndex + 1} of {totalSections}
                  </p>
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
              <div className="mt-6 flex-1 overflow-y-auto" ref={contentRef}>
                {sanitizedHtml ? (
                  <div
                    className="section-content"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                ) : sectionContent ? (
                  <div className="space-y-4 text-[15px] leading-7 text-slate-800">
                    {sectionContent.content.split("\n\n").map((para, i) => (
                      <p key={i} className="m-0">
                        {para.trim()}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Prev / Next */}
              <div className="mt-4 flex-shrink-0 flex items-center justify-between border-t border-slate-200 pt-4">
                <button
                  onClick={() => goToSection(currentSectionIndex - 1)}
                  disabled={currentSectionIndex === 0}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-sm text-slate-500">
                  Section {currentSectionIndex + 1} of {totalSections}
                </span>
                <button
                  onClick={() => goToSection(currentSectionIndex + 1)}
                  disabled={currentSectionIndex >= totalSections - 1}
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
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {annotations.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center mt-4">
                      No notes yet. Select text and click "Add Note".
                    </p>
                  ) : (
                    annotations.map((ann) => (
                      <div
                        key={ann.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <p className="mb-1.5 text-xs italic text-slate-500 line-clamp-2">
                          &ldquo;{ann.selected_text.slice(0, 60)}{ann.selected_text.length > 60 ? "…" : ""}&rdquo;
                        </p>
                        <p className="text-sm text-slate-800">{ann.note_text}</p>
                        <button
                          onClick={() => handleDeleteAnnotation(ann.id)}
                          className="mt-2 text-xs text-red-500 hover:text-red-700 transition"
                        >
                          Delete
                        </button>
                      </div>
                    ))
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
