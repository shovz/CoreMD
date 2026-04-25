import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import {
  getQuestionById,
  submitAttempt,
  getQuestions,
  type QuestionFull,
  type AttemptResult,
} from "../api/questionsApi";

interface LocationState {
  questionIds?: string[];
  currentIndex?: number;
  topic?: string | null;
}

const DIFF_BADGE: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as LocationState;

  const [question, setQuestion] = useState<QuestionFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setQuestion(null);
    setSelected(null);
    setResult(null);
    setError(null);
    setLoading(true);
    getQuestionById(id)
      .then((res) => {
        setQuestion(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load question.");
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async () => {
    if (selected === null || result || submitting || !id) return;
    setSubmitting(true);
    try {
      const res = await submitAttempt(id, selected);
      setResult(res.data);
    } catch {
      setError("Failed to submit attempt.");
    } finally {
      setSubmitting(false);
    }
  };

  const goToNext = async () => {
    const { questionIds, currentIndex } = state;
    if (
      questionIds &&
      currentIndex !== undefined &&
      currentIndex + 1 < questionIds.length
    ) {
      const nextId = questionIds[currentIndex + 1];
      navigate(`/questions/${nextId}`, {
        state: {
          questionIds,
          currentIndex: currentIndex + 1,
          topic: state.topic,
        },
      });
      return;
    }
    // Fallback: random question in the same topic
    try {
      const res = await getQuestions({
        topic: state.topic ?? undefined,
        limit: 50,
      });
      const others = res.data.filter((q) => q.question_id !== id);
      if (others.length > 0) {
        const next = others[Math.floor(Math.random() * others.length)];
        navigate(`/questions/${next.question_id}`, {
          state: { topic: state.topic },
        });
      } else {
        navigate("/questions");
      }
    } catch {
      navigate("/questions");
    }
  };

  const optionClass = (index: number) => {
    const base =
      "w-full text-left px-4 py-3 rounded-xl border-2 transition-colors text-sm leading-relaxed";

    if (!result) {
      if (selected === index) {
        return `${base} border-blue-500 bg-blue-50 text-blue-900`;
      }
      return `${base} border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer`;
    }

    if (index === result.correct_option) {
      return `${base} border-emerald-500 bg-emerald-50 text-emerald-900`;
    }
    if (index === selected && !result.correct) {
      return `${base} border-rose-500 bg-rose-50 text-rose-900`;
    }
    return `${base} border-slate-100 bg-slate-50 text-slate-400`;
  };

  if (loading) return <p className="p-6 text-slate-600">Loading question...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!question) return null;

  const { questionIds, currentIndex } = state;
  const hasNext =
    questionIds !== undefined &&
    currentIndex !== undefined &&
    currentIndex + 1 < questionIds.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/questions"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to Questions
      </Link>

      {/* Topic chip + difficulty badge */}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700">
          {question.topic}
        </span>
        <span className="rounded-full bg-violet-100 px-3 py-0.5 text-xs font-semibold text-violet-700">
          {question.chapter_ref}
        </span>
        <span
          className={`rounded-full px-3 py-0.5 text-xs font-semibold capitalize ${DIFF_BADGE[question.difficulty]}`}
        >
          {question.difficulty}
        </span>
      </div>

      {/* Question stem */}
      <p className="text-base leading-relaxed text-slate-800">{question.stem}</p>

      {/* Option cards */}
      <div className="space-y-3">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => {
              if (!result && !submitting) setSelected(index);
            }}
            disabled={!!result || submitting}
            className={optionClass(index)}
          >
            <span className="mr-2 font-bold">{String.fromCharCode(65 + index)}.</span>
            {option}
          </button>
        ))}
      </div>

      {/* Submit button — visible only before submission */}
      {!result && (
        <button
          onClick={handleSubmit}
          disabled={selected === null || submitting}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "Submit Answer"}
        </button>
      )}

      {/* Explanation panel */}
      {result && (
        <div
          className={`rounded-xl border-l-4 p-5 ${
            result.correct
              ? "border-emerald-500 bg-emerald-50"
              : "border-rose-500 bg-rose-50"
          }`}
        >
          <p
            className={`mb-2 font-semibold ${
              result.correct ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {result.correct ? "Correct!" : "Incorrect"}
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            {result.explanation}
          </p>
        </div>
      )}

      {/* Next question button — visible only after submission */}
      {result && (
        <button
          onClick={goToNext}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {hasNext ? "Next Question →" : "Random Question →"}
        </button>
      )}
    </div>
  );
}
