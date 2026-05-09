import { useNavigate } from "react-router-dom";

function StageAIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6m-7 4h8m-9 4h10m-8 4h6m-7 6h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function StageBIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}

export default function ExamsLandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--paper)] px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Exams</h1>
        <p className="mt-1 text-sm text-[var(--ink-dim)]">Select an exam format to begin.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={() => navigate("/exams/stage-a")}
            className="group flex flex-col items-start gap-4 rounded-xl border border-black/8 bg-[var(--paper-2)] p-6 text-left transition hover:border-blue-500 hover:shadow-md"
          >
            <div className="text-blue-600">
              <StageAIcon />
            </div>
            <div>
              <div className="text-base font-semibold text-[var(--ink)] group-hover:text-blue-600">
                Stage A
              </div>
              <div className="mt-1 text-sm text-[var(--ink-dim)]">
                150-question MCQ exam. Timed, weighted by topic and difficulty.
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/exams/stage-b")}
            className="group flex flex-col items-start gap-4 rounded-xl border border-black/8 bg-[var(--paper-2)] p-6 text-left transition hover:border-blue-500 hover:shadow-md"
          >
            <div className="text-blue-600">
              <StageBIcon />
            </div>
            <div>
              <div className="text-base font-semibold text-[var(--ink)] group-hover:text-blue-600">
                Stage B — Oral Simulator
              </div>
              <div className="mt-1 text-sm text-[var(--ink-dim)]">
                AI-generated rolling case scenarios. Answer by voice or text.
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
