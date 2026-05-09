import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import {
  getCaseById,
  getCaseQuestions,
  submitCaseAttempt,
  type CaseFull,
  type CaseQuestion,
  type CaseAttemptResult,
} from "../api/casesApi";
import { addBookmark, removeBookmark, getBookmarks } from "../api/bookmarksApi";
import { getChapterById, type Chapter } from "../api/chaptersApi";
import { getSectionById, type SectionResponse } from "../api/sectionApi";
import DOMPurify from "dompurify";
import AnswerExplanationPanel from "../components/AnswerExplanationPanel";

// ── helpers ──────────────────────────────────────────────────────────────────

function caseNumber(id: string): string {
  const m = id.match(/(\d+)$/);
  return m ? String(parseInt(m[1], 10)).padStart(2, "0") : "–";
}

function optionClass(
  idx: number,
  selected: number | null,
  result: CaseAttemptResult | null
): string {
  const base =
    "w-full text-left px-3 py-2 rounded-lg border text-xs leading-relaxed transition-colors";
  if (!result) {
    return selected === idx
      ? `${base} border-blue-500 bg-blue-50 text-blue-900`
      : `${base} border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer`;
  }
  if (idx === result.correct_option)
    return `${base} border-emerald-500 bg-emerald-50 text-emerald-900`;
  if (idx === selected && !result.correct)
    return `${base} border-rose-500 bg-rose-50 text-rose-900`;
  return `${base} border-slate-100 bg-slate-50 text-slate-400`;
}

// ── QuestionCard ──────────────────────────────────────────────────────────────

interface StepState {
  selected: number | null;
  result: CaseAttemptResult | null;
  submitting: boolean;
}

interface QuestionCardProps {
  q: CaseQuestion;
  state: StepState;
  locked: boolean;
  caseId: string;
  onSelect: (opt: number) => void;
  onSubmit: () => void;
}

function QuestionCard({ q, state, locked, onSelect, onSubmit }: QuestionCardProps) {
  if (locked) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 opacity-50">
        <p className="text-xs font-mono tracking-widest text-slate-400 uppercase mb-1">
          Step {q.step}
        </p>
        <p className="text-xs text-slate-400">Locked — answer previous question first.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <p className="text-xs font-mono tracking-widest text-slate-400 uppercase">
        Step {q.step}
      </p>
      <p className="text-xs leading-relaxed text-slate-800 font-medium">{q.stem}</p>

      <div className="space-y-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => { if (!state.result && !state.submitting) onSelect(i); }}
            disabled={!!state.result || state.submitting}
            className={optionClass(i, state.selected, state.result)}
          >
            <span className="mr-1 font-bold">{String.fromCharCode(65 + i)}.</span>
            {opt}
          </button>
        ))}
      </div>

      {!state.result && (
        <button
          onClick={onSubmit}
          disabled={state.selected === null || state.submitting}
          className="w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state.submitting ? "Submitting…" : "Submit"}
        </button>
      )}

      {state.result && (
        <AnswerExplanationPanel
          options={q.options}
          correctOption={state.result.correct_option}
          selectedOption={state.selected}
          explanations={state.result.option_explanations}
          summary={state.result.explanation}
          compact
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const fromBookmarks = (location.state as { from?: string } | null)?.from === "bookmarks";

  const [caseData, setCaseData] = useState<CaseFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<CaseQuestion[]>([]);
  const [stepStates, setStepStates] = useState<StepState[]>([]);
  const [unlocked, setUnlocked] = useState(0);

  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const [showRefModal, setShowRefModal] = useState(false);
  const [refChapter, setRefChapter] = useState<Chapter | null>(null);
  const [refSectionIdx, setRefSectionIdx] = useState(0);
  const [refSectionContent, setRefSectionContent] = useState<SectionResponse | null>(null);
  const [refLoading, setRefLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getCaseById(id), getCaseQuestions(id), getBookmarks("case")])
      .then(([caseRes, qRes, bmRes]) => {
        setCaseData(caseRes.data);
        setQuestions(qRes.data);
        setStepStates(qRes.data.map(() => ({ selected: null, result: null, submitting: false })));
        setBookmarked(bmRes.data.some((b) => b.item_id === id));
        setLoading(false);
      })
      .catch(() => { setError("Failed to load case."); setLoading(false); });
  }, [id]);

  const handleOpenRef = async () => {
    if (!caseData?.chapter_id) return;
    setShowRefModal(true);
    setRefLoading(true);
    try {
      const chRes = await getChapterById(caseData.chapter_id);
      const chapter = chRes.data;
      setRefChapter(chapter);
      setRefSectionIdx(0);
      if (chapter.sections.length > 0) {
        const secRes = await getSectionById(chapter.id, chapter.sections[0].id);
        setRefSectionContent(secRes.data);
      }
    } finally {
      setRefLoading(false);
    }
  };

  const handleRefSectionChange = async (idx: number) => {
    if (!refChapter) return;
    setRefSectionIdx(idx);
    setRefLoading(true);
    try {
      const secRes = await getSectionById(refChapter.id, refChapter.sections[idx].id);
      setRefSectionContent(secRes.data);
    } finally {
      setRefLoading(false);
    }
  };

  const handleBookmark = async () => {
    if (!id || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await removeBookmark(id);
        setBookmarked(false);
      } else {
        await addBookmark("case", id);
        setBookmarked(true);
      }
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleSelect = (stepIdx: number, opt: number) =>
    setStepStates((prev) =>
      prev.map((s, i) => (i === stepIdx ? { ...s, selected: opt } : s))
    );

  const handleSubmit = async (stepIdx: number) => {
    const step = stepStates[stepIdx];
    if (step.selected === null || step.result || step.submitting || !id) return;

    setStepStates((prev) =>
      prev.map((s, i) => (i === stepIdx ? { ...s, submitting: true } : s))
    );
    try {
      const res = await submitCaseAttempt(id, questions[stepIdx].case_question_id, step.selected);
      setStepStates((prev) =>
        prev.map((s, i) =>
          i === stepIdx ? { ...s, result: res.data, submitting: false } : s
        )
      );
      setUnlocked((prev) => Math.max(prev, stepIdx + 1));
    } catch {
      setStepStates((prev) =>
        prev.map((s, i) => (i === stepIdx ? { ...s, submitting: false } : s))
      );
    }
  };

  if (loading) return <p className="p-6 text-slate-500">Loading case…</p>;
  if (error)   return <p className="p-6 text-red-600">{error}</p>;
  if (!caseData) return null;

  const num = id ? caseNumber(id) : "–";

  return (
    <div className="px-6 pt-6 pb-16">
      {fromBookmarks ? (
        <Link to="/bookmarks" className="text-sm text-blue-600 hover:underline">
          ← Back to Bookmarks
        </Link>
      ) : (
        <Link to="/cases" className="text-sm text-blue-600 hover:underline">
          ← Back to Cases
        </Link>
      )}

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <div className="mt-4 flex gap-6 items-start">

        {/* ── Left: vignette ────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1 space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 font-mono text-xs tracking-widest text-slate-400 uppercase">
                Case #{num} · {caseData.specialty}
              </p>
              <h1 className="text-2xl font-bold text-slate-900">{caseData.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{caseData.specialty} · ~15 min</p>
            </div>
            <div className="mt-1 flex flex-shrink-0 items-center gap-2">
              <button
                onClick={handleBookmark}
                disabled={bookmarkLoading}
                title={bookmarked ? "Remove bookmark" : "Bookmark case"}
                className="text-xl leading-none text-amber-400 transition hover:scale-110 disabled:opacity-40"
              >
                {bookmarked ? "★" : "☆"}
              </button>
              {caseData.chapter_id && (
                <button
                  onClick={handleOpenRef}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  📖 {caseData.chapter_id}
                </button>
              )}
            </div>
          </div>

          {/* Presentation */}
          <div className="rounded-xl border border-slate-200 bg-[var(--paper-2)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Presentation</h3>
            <p className="text-sm leading-relaxed text-slate-800">{caseData.presentation}</p>
          </div>

          {/* History + Exam */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 font-mono text-xs tracking-widest text-slate-400 uppercase">History</p>
              <p className="text-sm leading-relaxed text-slate-800">{caseData.history}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 font-mono text-xs tracking-widest text-slate-400 uppercase">Exam</p>
              <p className="text-sm leading-relaxed text-slate-800">{caseData.physical_exam}</p>
            </div>
          </div>

          {/* Labs & Imaging */}
          {(caseData.labs || caseData.imaging) && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 font-mono text-xs tracking-widest text-slate-400 uppercase">
                Labs &amp; Imaging
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {caseData.labs && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="mb-2 font-mono text-xs tracking-widest text-slate-400 uppercase">Labs</p>
                    <p className="text-sm leading-relaxed text-slate-700">{caseData.labs}</p>
                  </div>
                )}
                {caseData.imaging && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="mb-2 font-mono text-xs tracking-widest text-slate-400 uppercase">Imaging</p>
                    <p className="text-sm leading-relaxed text-slate-700">{caseData.imaging}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Discussion */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                Discussion
              </span>
              <span className="font-mono text-xs text-slate-500">grounded in Harrison's</span>
            </div>

            {caseData.diagnosis && (
              <div>
                <p className="mb-1 font-mono text-xs tracking-widest text-blue-500 uppercase">Diagnosis</p>
                <p className="text-sm font-semibold leading-relaxed text-slate-900">{caseData.diagnosis}</p>
              </div>
            )}

            {caseData.discussion && (
              <p className="text-sm leading-relaxed text-slate-800">{caseData.discussion}</p>
            )}

            {caseData.management && (
              <div className="border-t border-blue-200 pt-4">
                <p className="mb-2 font-mono text-xs tracking-widest text-blue-500 uppercase">Management</p>
                <p className="text-sm leading-relaxed text-slate-800">{caseData.management}</p>
              </div>
            )}

            {caseData.chapter_id && (
              <div className="border-t border-blue-200 pt-4">
                <p className="mb-2 font-mono text-xs tracking-widest text-slate-400 uppercase">References</p>
                <button
                  onClick={handleOpenRef}
                  className="inline-flex items-center rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors cursor-pointer"
                >
                  📖{" "}
                  {caseData.chapter_title
                    ? `${caseData.chapter_title} — ${caseData.chapter_id}`
                    : caseData.chapter_id}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: questions ──────────────────────────────────────────── */}
        {questions.length > 0 && (
          <div className="w-72 flex-shrink-0 space-y-3 lg:w-80 xl:w-96" style={{ position: "sticky", top: "1.5rem" }}>
            <p className="font-mono text-xs tracking-widest text-slate-400 uppercase">
              Questions
            </p>
            {questions.map((q, i) => (
              <QuestionCard
                key={q.case_question_id}
                q={q}
                state={stepStates[i] ?? { selected: null, result: null, submitting: false }}
                locked={i > unlocked}
                caseId={id!}
                onSelect={(opt) => handleSelect(i, opt)}
                onSubmit={() => handleSubmit(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── References Modal ──────────────────────────────────────────────── */}
      {showRefModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowRefModal(false)}
        >
          <div
            className="relative flex w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl"
            style={{ height: "75vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {refChapter ? refChapter.title : "Loading…"}
              </p>
              <button
                onClick={() => setShowRefModal(false)}
                className="ml-4 flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1">
              {/* Section nav */}
              <div className="w-48 flex-shrink-0 overflow-y-auto border-r border-slate-200 py-2">
                {refChapter?.sections.map((sec, idx) => (
                  <button
                    key={sec.id}
                    onClick={() => handleRefSectionChange(idx)}
                    className={`w-full px-4 py-2 text-left text-xs leading-snug transition-colors ${
                      idx === refSectionIdx
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {sec.title}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {refLoading ? (
                  <p className="text-sm text-slate-400">Loading…</p>
                ) : refSectionContent?.html_content ? (
                  <div
                    className="section-content prose prose-sm max-w-none text-slate-800"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(refSectionContent.html_content),
                    }}
                  />
                ) : refSectionContent ? (
                  <p className="text-sm leading-relaxed text-slate-800">{refSectionContent.content}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
