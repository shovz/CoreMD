import { useParams, Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { getSectionById, type SectionResponse } from "../api/sectionApi";
import { getChapterById, type Chapter } from "../api/chaptersApi";
import { useAiContext } from "../context/AiContext";

interface Popover {
  x: number;
  y: number;
  text: string;
}

export default function SectionDetailPage() {
  const { chapterId, sectionId } = useParams();
  const [section, setSection] = useState<SectionResponse | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [popover, setPopover] = useState<Popover | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { openWithText } = useAiContext();

  useEffect(() => {
    if (!chapterId || !sectionId) return;
    Promise.all([getSectionById(chapterId, sectionId), getChapterById(chapterId)]).then(
      ([sectionRes, chapterRes]) => {
        setSection(sectionRes.data);
        setChapter(chapterRes.data);
      }
    );
  }, [chapterId, sectionId]);

  useEffect(() => {
    if (!tocOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTocOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [tocOpen]);

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
      setPopover({ x: rect.left + rect.width / 2, y: rect.top, text });
    }

    function handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPopover(null);
      }
    }

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  if (!section) return <p className="p-6">Loading section...</p>;

  const sections = chapter?.sections ?? [];

  const apiBase = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(
    "/api/v1",
    ""
  );

  const sanitizedHtml = section.html_content
    ? DOMPurify.sanitize(
        section.html_content.replace(/src="\/static\//g, `src="${apiBase}/static/`)
      )
    : null;

  const tocItems = (
    <ul className="space-y-0.5">
      {sections.map((s) => {
        const isCurrent = s.id === sectionId;
        return (
          <li key={s.id}>
            <Link
              to={`/chapters/${chapterId}/sections/${s.id}`}
              onClick={() => setTocOpen(false)}
              className={`block rounded px-3 py-1.5 text-sm leading-snug transition-colors ${
                isCurrent
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {s.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  function handleAskAi() {
    if (!popover) return;
    const text = popover.text;
    setPopover(null);
    window.getSelection()?.removeAllRanges();
    openWithText(text);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
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
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleAskAi}
            className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-blue-700"
          >
            Ask AI about this
          </button>
        </div>
      )}

      {/* Left TOC pane — desktop (≥768px) */}
      <aside className="hidden w-[260px] shrink-0 md:block">
        <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto border-r border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Sections
          </p>
          {tocItems}
        </div>
      </aside>

      {/* Right content pane */}
      <main className="min-w-0 flex-1 px-6 py-6 sm:px-10 sm:py-8">
        {/* Mobile sticky TOC dropdown — hidden on ≥768px */}
        <div className="sticky top-16 z-20 mb-5 md:hidden" ref={dropdownRef}>
          <button
            onClick={() => setTocOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
          >
            <span>Sections</span>
            <span className="ml-2 text-slate-400">{tocOpen ? "▴" : "▾"}</span>
          </button>
          {tocOpen && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              {tocItems}
            </div>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="mb-2 text-xs text-slate-500">
          <Link to="/chapters" className="hover:text-slate-700">
            Chapters
          </Link>
          <span className="mx-1">/</span>
          <Link to={`/chapters/${chapterId}`} className="hover:text-slate-700">
            {section.chapter_title}
          </Link>
        </div>

        {/* Heading: chapter_title › section_title */}
        <h1 className="text-2xl font-bold leading-tight text-slate-900">
          {section.chapter_title}
          <span className="mx-2 font-normal text-slate-400">›</span>
          <span className="text-slate-700">{section.section_title}</span>
        </h1>

        {/* Section content */}
        <div className="mt-6" ref={contentRef}>
          {sanitizedHtml ? (
            <div className="section-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
          ) : (
            <div className="space-y-4 text-[15px] leading-7 text-slate-800">
              {section.content.split("\n\n").map((para, i) => (
                <p key={i} className="m-0">
                  {para.trim()}
                </p>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
