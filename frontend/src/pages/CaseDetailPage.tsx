import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getCaseById,
  getCaseQuestions,
  submitCaseAttempt,
  type CaseFull,
  type CaseQuestion,
  type CaseAttemptResult,
} from "../api/casesApi";

const VIGNETTE_FIELDS: { key: keyof CaseFull; label: string }[] = [
  { key: "presentation", label: "Presentation" },
  { key: "history", label: "History" },
  { key: "physical_exam", label: "Physical Exam" },
  { key: "labs", label: "Labs" },
  { key: "imaging", label: "Imaging" },
  { key: "diagnosis", label: "Diagnosis" },
];

const DISCUSSION_FIELDS: { key: keyof CaseFull; label: string }[] = [
  { key: "management", label: "Management" },
  { key: "discussion", label: "Discussion" },
];

interface StepState {
  selected: number | null;
  result: CaseAttemptResult | null;
  submitting: boolean;
}

function optionClass(
  index: number,
  selected: number | null,
  result: CaseAttemptResult | null
): string {
  const base =
    "w-full text-left px-4 py-3 rounded-xl border-2 transition-colors text-sm leading-relaxed";

  if (!result) {
    if (selected === index)
      return `${base} border-blue-500 bg-blue-50 text-blue-900`;
    return `${base} border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer`;
  }

  if (index === result.correct_option)
    return `${base} border-emerald-500 bg-emerald-50 text-emerald-900`;
  if (index === selected && !result.correct)
    return `${base} border-rose-500 bg-rose-50 text-rose-900`;
  return `${base} border-slate-100 bg-slate-50 text-slate-400`;
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [caseData, setCaseData] = useState<CaseFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  const [questions, setQuestions] = useState<CaseQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [stepStates, setStepStates] = useState<StepState[]>([]);
  const [unlocked, setUnlocked] = useState(0);

  useEffect(() => {
    if (!id) return;

    getCaseById(id)
      .then((res) => {
        setCaseData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load case. It may not exist.");
        setLoading(false);
      });

    getCaseQuestions(id)
      .then((res) => {
        const qs = res.data;
        setQuestions(qs);
        setStepStates(qs.map(() => ({ selected: null, result: null, submitting: false })));
        setQuestionsLoading(false);
      })
      .catch(() => {
        setQuestionsLoading(false);
      });
  }, [id]);

  const handleSelect = (stepIndex: number, optionIndex: number) => {
    setStepStates((prev) =>
      prev.map((s, i) => (i === stepIndex ? { ...s, selected: optionIndex } : s))
    );
  };

  const handleSubmit = async (stepIndex: number) => {
    const step = stepStates[stepIndex];
    if (step.selected === null || step.result || step.submitting || !id) return;

    setStepStates((prev) =>
      prev.map((s, i) => (i === stepIndex ? { ...s, submitting: true } : s))
    );

    try {
      const res = await submitCaseAttempt(
        id,
        questions[stepIndex].case_question_id,
        step.selected
      );
      setStepStates((prev) =>
        prev.map((s, i) =>
          i === stepIndex ? { ...s, result: res.data, submitting: false } : s
        )
      );
      setUnlocked((prev) => Math.max(prev, stepIndex + 1));
    } catch {
      setStepStates((prev) =>
        prev.map((s, i) => (i === stepIndex ? { ...s, submitting: false } : s))
      );
    }
  };

  if (loading) return <p className="p-6 text-slate-600">Loading case...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!caseData) return null;

  const hasQuestions = !questionsLoading && questions.length > 0;
  const hasDiscussion = DISCUSSION_FIELDS.some(({ key }) => !!caseData[key]);

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-16">
      <Link to="/cases" className="text-sm text-blue-600 hover:underline">
        ← Back to Cases
      </Link>

      {/* Header */}
      <div>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">{caseData.title}</h1>
        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
          {caseData.specialty}
        </span>
      </div>

      {/* Vignette */}
      <section>
        <h2 className="mb-4 border-b border-slate-200 pb-2 text-lg font-semibold text-slate-700">
          Vignette
        </h2>
        <div className="space-y-4">
          {VIGNETTE_FIELDS.map(({ key, label }) => {
            const text = caseData[key] as string;
            if (!text) return null;
            return (
              <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                  {label}
                </p>
                <p className="text-sm leading-relaxed text-slate-800">{text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Discussion */}
      {hasDiscussion && (
        <section>
          <h2 className="mb-4 border-b border-slate-200 pb-2 text-lg font-semibold text-slate-700">
            Discussion
          </h2>
          <div className="space-y-4">
            {DISCUSSION_FIELDS.map(({ key, label }) => {
              const text = caseData[key] as string;
              if (!text) return null;
              return (
                <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                    {label}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-800">{text}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Questions */}
      {hasQuestions && (
        <section>
          <h2 className="mb-4 border-b border-slate-200 pb-2 text-lg font-semibold text-slate-700">
            Questions
          </h2>
          <div className="space-y-8">
            {questions.slice(0, unlocked + 1).map((q, stepIndex) => {
              const step = stepStates[stepIndex];
              if (!step) return null;
              return (
                <div
                  key={q.case_question_id}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Step {q.step}
                  </p>
                  <p className="text-base leading-relaxed text-slate-800">{q.stem}</p>

                  <div className="space-y-3">
                    {q.options.map((option, optIdx) => (
                      <button
                        key={optIdx}
                        onClick={() => {
                          if (!step.result && !step.submitting)
                            handleSelect(stepIndex, optIdx);
                        }}
                        disabled={!!step.result || step.submitting}
                        className={optionClass(optIdx, step.selected, step.result)}
                      >
                        <span className="mr-2 font-bold">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>

                  {!step.result && (
                    <button
                      onClick={() => handleSubmit(stepIndex)}
                      disabled={step.selected === null || step.submitting}
                      className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {step.submitting ? "Submitting…" : "Submit Answer"}
                    </button>
                  )}

                  {step.result && (
                    <div
                      className={`rounded-xl border-l-4 p-5 ${
                        step.result.correct
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-rose-500 bg-rose-50"
                      }`}
                    >
                      <p
                        className={`mb-2 font-semibold ${
                          step.result.correct ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {step.result.correct ? "Correct!" : "Incorrect"}
                      </p>
                      <p className="text-sm leading-relaxed text-slate-700">
                        {step.result.explanation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reference hint */}
      <div className="border-t border-slate-200 pt-6">
        <button
          onClick={() => setShowHint((prev) => !prev)}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
        >
          {showHint ? "Hide Reference" : "Show Reference"}
        </button>
        {showHint && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <strong>Reference:</strong>{" "}
            {caseData.chapter_title
              ? `${caseData.chapter_title} — ${caseData.chapter_ref}`
              : caseData.chapter_ref}
          </div>
        )}
      </div>
    </div>
  );
}
