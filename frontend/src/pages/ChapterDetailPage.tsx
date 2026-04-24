import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getChapterById, getChapters, type Chapter } from "../api/chaptersApi";

const LEFT_ARROW = "<";
const RIGHT_ARROW = ">";

export default function ChapterDetailPage() {
  const { chapterId } = useParams();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chapterId) return;

    Promise.all([getChapterById(chapterId), getChapters()])
      .then(([chapterRes, chaptersRes]) => {
        setChapter(chapterRes.data);
        setAllChapters(chaptersRes.data);
      })
      .catch(() => setError("Failed to load chapter"))
      .finally(() => setLoading(false));
  }, [chapterId]);

  const sortedChapters = useMemo(() => {
    return [...allChapters].sort((a, b) => {
      const aNum = a.chapter_number ?? Number.MAX_SAFE_INTEGER;
      const bNum = b.chapter_number ?? Number.MAX_SAFE_INTEGER;
      if (aNum !== bNum) return aNum - bNum;
      return a.title.localeCompare(b.title);
    });
  }, [allChapters]);

  const chapterIndex = sortedChapters.findIndex((c) => c.id === chapterId);
  const prevChapter = chapterIndex > 0 ? sortedChapters[chapterIndex - 1] : null;
  const nextChapter =
    chapterIndex >= 0 && chapterIndex < sortedChapters.length - 1
      ? sortedChapters[chapterIndex + 1]
      : null;

  if (loading) return <p className="p-6">Loading chapter...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!chapter) return null;

  return (
    <div className="relative mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {prevChapter && (
        <Link
          to={`/chapters/${prevChapter.id}`}
          title={prevChapter.title}
          className="fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-slate-300 bg-white p-3 text-slate-700 shadow-lg hover:border-blue-300 hover:text-blue-700 xl:block"
        >
          {LEFT_ARROW}
        </Link>
      )}

      {nextChapter && (
        <Link
          to={`/chapters/${nextChapter.id}`}
          title={nextChapter.title}
          className="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-slate-300 bg-white p-3 text-slate-700 shadow-lg hover:border-blue-300 hover:text-blue-700 xl:block"
        >
          {RIGHT_ARROW}
        </Link>
      )}

      <Link to="/chapters" className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
        {LEFT_ARROW} Back to Chapters
      </Link>

      <div className="mt-3 text-xs text-slate-500">
        <Link to="/chapters" className="hover:text-slate-700">Chapters</Link>
        {chapter.part_title && (
          <>
            <span className="mx-2">/</span>
            <span>
              {chapter.part_number != null ? `Part ${chapter.part_number}: ` : ""}
              {chapter.part_title}
            </span>
          </>
        )}
      </div>

      {chapter.chapter_number != null && (
        <div className="mt-4 text-sm text-slate-500">Chapter {chapter.chapter_number}</div>
      )}

      <h1 className="mt-1 text-3xl font-bold text-slate-900">{chapter.title}</h1>

      {chapter.specialty && (
        <span className="mt-3 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          {chapter.specialty}
        </span>
      )}

      {(prevChapter || nextChapter) && (
        <div className="mt-6 flex items-center justify-between gap-3 border-y border-slate-200 py-4 xl:hidden">
          {prevChapter ? (
            <Link
              to={`/chapters/${prevChapter.id}`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
              title={prevChapter.title}
            >
              {LEFT_ARROW} Previous Chapter
            </Link>
          ) : (
            <span />
          )}

          {nextChapter ? (
            <Link
              to={`/chapters/${nextChapter.id}`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
              title={nextChapter.title}
            >
              Next Chapter {RIGHT_ARROW}
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Sections</h2>

      {chapter.sections.length === 0 ? (
        <p className="mt-3 text-slate-500">No sections available.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {chapter.sections.map((section, idx) => (
            <Link
              key={section.id}
              to={`/chapters/${chapter.id}/sections/${section.id}`}
              className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-blue-700 hover:border-blue-200 hover:bg-blue-50"
            >
              <span className="mr-3 min-w-6 text-xs text-slate-500">{idx + 1}</span>
              <span>{section.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
