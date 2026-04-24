import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { getSectionById, type SectionResponse } from "../api/sectionApi";
import { getChapterById, type Chapter } from "../api/chaptersApi";

const LEFT_ARROW = "<";
const RIGHT_ARROW = ">";

export default function SectionDetailPage() {
  const { chapterId, sectionId } = useParams();
  const [section, setSection] = useState<SectionResponse | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);

  useEffect(() => {
    if (!chapterId || !sectionId) return;
    Promise.all([getSectionById(chapterId, sectionId), getChapterById(chapterId)]).then(
      ([sectionRes, chapterRes]) => {
        setSection(sectionRes.data);
        setChapter(chapterRes.data);
      }
    );
  }, [chapterId, sectionId]);

  if (!section) return <p className="p-6">Loading section...</p>;

  const sections = chapter?.sections ?? [];
  const currentIdx = sections.findIndex((s) => s.id === sectionId);
  const prevSection = currentIdx > 0 ? sections[currentIdx - 1] : null;
  const nextSection = currentIdx >= 0 && currentIdx < sections.length - 1 ? sections[currentIdx + 1] : null;

  const apiBase = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(
    "/api/v1",
    ""
  );

  const sanitizedHtml = section.html_content
    ? DOMPurify.sanitize(section.html_content.replace(/src="\/static\//g, `src="${apiBase}/static/`))
    : null;

  return (
    <div className="relative mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {prevSection && (
        <Link
          to={`/chapters/${chapterId}/sections/${prevSection.id}`}
          title={prevSection.title}
          className="fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-slate-300 bg-white p-3 text-slate-700 shadow-lg hover:border-blue-300 hover:text-blue-700 xl:block"
        >
          {LEFT_ARROW}
        </Link>
      )}

      {nextSection && (
        <Link
          to={`/chapters/${chapterId}/sections/${nextSection.id}`}
          title={nextSection.title}
          className="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-slate-300 bg-white p-3 text-slate-700 shadow-lg hover:border-blue-300 hover:text-blue-700 xl:block"
        >
          {RIGHT_ARROW}
        </Link>
      )}

      <Link
        to={`/chapters/${chapterId}`}
        className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        {LEFT_ARROW} Back to Chapter
      </Link>

      <div className="mt-3 text-xs text-slate-500">
        <Link to="/chapters" className="hover:text-slate-700">
          Chapters
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/chapters/${chapterId}`} className="hover:text-slate-700">
          {section.chapter_title}
        </Link>
        <span className="mx-2">/</span>
        <span>{section.section_title}</span>
      </div>

      <h1 className="mt-4 text-3xl font-bold text-slate-900">{section.chapter_title}</h1>
      <h2 className="mt-1 text-xl font-semibold text-slate-700">{section.section_title}</h2>

      {sections.length > 0 && currentIdx >= 0 && (
        <p className="mt-2 text-xs text-slate-500">Section {currentIdx + 1} of {sections.length}</p>
      )}

      <div className="mt-6">
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

      {(prevSection || nextSection) && (
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 xl:hidden">
          {prevSection ? (
            <Link
              to={`/chapters/${chapterId}/sections/${prevSection.id}`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700"
            >
              {LEFT_ARROW} Previous
            </Link>
          ) : (
            <span />
          )}

          {nextSection ? (
            <Link
              to={`/chapters/${chapterId}/sections/${nextSection.id}`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700"
            >
              Next {RIGHT_ARROW}
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
