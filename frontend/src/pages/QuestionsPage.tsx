import { useEffect, useMemo, useRef, useState } from "react";
import {
  getQuestionTopics,
  getQuestions,
  getQuestionById,
  getQuestionFollowUps,
  submitAttempt,
  type AttemptResult,
  type Difficulty,
  type QuestionFull,
  type QuestionOut,
} from "../api/questionsApi";

type Mode = "topic" | "random" | "multi-step";

const PAGE_LIMIT = 100;
const LEFT_ARROW = "<";
const RIGHT_ARROW = ">";
const MAX_CHAIN_FOLLOWUPS = 3;

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---- Chain card sub-component (used by multi-step mode) ----

interface ChainCardProps {
  question: QuestionFull;
  result: AttemptResult | null;
  onSubmit: (selectedIdx: number) => Promise<void>;
}

function ChainCard({ question, result, onSubmit }: ChainCardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelected(null);
    setSubmitting(false);
  }, [question.question_id]);

  const optionClass = (idx: number) => {
    const base =
      "w-full text-left px-4 py-3 rounded-xl border-2 transition-colors text-sm leading-relaxed";
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
  };

  const handleSubmit = async () => {
    if (selected === null || result || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(selected);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700">
          {question.topic}
        </span>
        <span
          className={`rounded-full px-3 py-0.5 text-xs font-semibold capitalize ${DIFFICULTY_COLORS[question.difficulty]}`}
        >
          {question.difficulty}
        </span>
      </div>

      <p className="text-base leading-relaxed text-slate-800">{question.stem}</p>

      <div className="space-y-3">
        {question.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => { if (!result && !submitting) setSelected(idx); }}
            disabled={!!result || submitting}
            className={optionClass(idx)}
          >
            <span className="mr-2 font-bold">{String.fromCharCode(65 + idx)}.</span>
            {opt}
          </button>
        ))}
      </div>

      {!result && (
        <button
          onClick={handleSubmit}
          disabled={selected === null || submitting}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Submitting..." : "Submit Answer"}
        </button>
      )}

      {result && (
        <div
          className={`rounded-xl border-l-4 p-5 ${
            result.correct ? "border-emerald-500 bg-emerald-50" : "border-rose-500 bg-rose-50"
          }`}
        >
          <p className={`mb-2 font-semibold ${result.correct ? "text-emerald-700" : "text-rose-700"}`}>
            {result.correct ? "Correct!" : "Incorrect"}
          </p>
          <p className="text-sm leading-relaxed text-slate-700">{result.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ---- Main page ----

export default function QuestionsPage() {
  const [mode, setMode] = useState<Mode>("topic");
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Standard (topic / random) player state
  const [questionPool, setQuestionPool] = useState<QuestionOut[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);

  // Multi-step chain state
  const [msPool, setMsPool] = useState<QuestionOut[]>([]);
  const [msUsed, setMsUsed] = useState<Set<string>>(new Set());
  const [msRootQ, setMsRootQ] = useState<QuestionFull | null>(null);
  const [msRootResult, setMsRootResult] = useState<AttemptResult | null>(null);
  const [msFollowUps, setMsFollowUps] = useState<Array<{ question: QuestionFull; result: AttemptResult | null }>>([]);
  const [msChainEnded, setMsChainEnded] = useState(false);
  const [msLoadingChain, setMsLoadingChain] = useState(false);

  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingPool, setLoadingPool] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getQuestionTopics()
      .then((res) => {
        setTopics(res.data);
        setError(null);
      })
      .catch(() => setError("Failed to load question topics"))
      .finally(() => setLoadingTopics(false));

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Load question pool for topic / random modes
  useEffect(() => {
    if (mode === "multi-step") return;
    if (mode === "topic" && !selectedTopic) return;

    let cancelled = false;
    setLoadingPool(true);

    const loadPool = async () => {
      try {
        const collected: QuestionOut[] = [];
        let offset = 0;

        while (true) {
          const response = await getQuestions({
            topic: mode === "topic" ? selectedTopic ?? undefined : undefined,
            difficulty: difficulty || undefined,
            search: debouncedSearch || undefined,
            limit: PAGE_LIMIT,
            offset,
          });

          const page = response.data;
          collected.push(...page);
          if (page.length < PAGE_LIMIT) break;
          offset += PAGE_LIMIT;
        }

        const pool = mode === "random" ? shuffle(collected) : collected;
        if (!cancelled) {
          setQuestionPool(pool);
          setPlayerIndex(0);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setQuestionPool([]);
          setPlayerIndex(0);
          setError("Failed to load questions");
        }
      } finally {
        if (!cancelled) setLoadingPool(false);
      }
    };

    loadPool();
    return () => { cancelled = true; };
  }, [mode, selectedTopic, difficulty, debouncedSearch]);

  // Load multi-step entry-point pool
  useEffect(() => {
    if (mode !== "multi-step") return;

    let cancelled = false;
    setMsPool([]);
    setMsUsed(new Set());
    setMsRootQ(null);
    setMsLoadingChain(true);

    const load = async () => {
      try {
        const res = await getQuestions({ has_followups: true, limit: PAGE_LIMIT });
        if (!cancelled) setMsPool(res.data);
      } catch {
        if (!cancelled) setError("Failed to load multi-step questions");
      } finally {
        if (!cancelled) setMsLoadingChain(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [mode]);

  // Start first chain once pool is ready
  useEffect(() => {
    if (mode === "multi-step" && msPool.length > 0 && !msRootQ && !msLoadingChain) {
      startNextChain(msPool, msUsed);
    }
  }, [msPool, msLoadingChain]);

  const startNextChain = async (pool: QuestionOut[], used: Set<string>) => {
    const available = pool.filter((q) => !used.has(q.question_id));
    if (available.length === 0) {
      setMsRootQ(null);
      return;
    }
    const pick = available[Math.floor(Math.random() * available.length)];
    setMsLoadingChain(true);
    setMsRootQ(null);
    setMsRootResult(null);
    setMsFollowUps([]);
    setMsChainEnded(false);
    try {
      const res = await getQuestionById(pick.question_id);
      setMsRootQ(res.data);
    } catch {
      setError("Failed to load question");
    } finally {
      setMsLoadingChain(false);
    }
  };

  const fetchMsFollowUp = async (parentId: string, currentCount: number): Promise<boolean> => {
    if (currentCount >= MAX_CHAIN_FOLLOWUPS) return false;
    try {
      const listRes = await getQuestionFollowUps(parentId, { trigger: "correct", limit: 1 });
      const next = listRes.data[0];
      if (!next) return false;
      const fullRes = await getQuestionById(next.question_id);
      setMsFollowUps((prev) => [...prev, { question: fullRes.data, result: null }]);
      return true;
    } catch {
      return false;
    }
  };

  const handleMsRootResult = async (attempt: AttemptResult) => {
    setMsRootResult(attempt);
    if (!attempt.correct) { setMsChainEnded(true); return; }
    setMsLoadingChain(true);
    const appended = await fetchMsFollowUp(msRootQ!.question_id, 0);
    setMsLoadingChain(false);
    setMsChainEnded(!appended);
  };

  const handleMsFollowUpResult = async (index: number, attempt: AttemptResult) => {
    const fu = msFollowUps[index];
    if (!fu) return;
    setMsFollowUps((prev) =>
      prev.map((item, i) => (i === index ? { ...item, result: attempt } : item))
    );
    if (!attempt.correct) { setMsChainEnded(true); return; }
    setMsLoadingChain(true);
    const appended = await fetchMsFollowUp(fu.question.question_id, msFollowUps.length);
    setMsLoadingChain(false);
    setMsChainEnded(!appended);
  };

  const handleMsRootSubmit = async (selectedIdx: number) => {
    if (!msRootQ) return;
    const res = await submitAttempt(msRootQ.question_id, selectedIdx);
    await handleMsRootResult(res.data);
  };

  const handleMsFollowUpSubmit = async (index: number, selectedIdx: number) => {
    const fu = msFollowUps[index];
    if (!fu) return;
    const res = await submitAttempt(fu.question.question_id, selectedIdx);
    await handleMsFollowUpResult(index, res.data);
  };

  const handleMsNext = () => {
    const nextUsed = new Set(msUsed);
    if (msRootQ) nextUsed.add(msRootQ.question_id);
    setMsUsed(nextUsed);
    startNextChain(msPool, nextUsed);
  };

  // ---- Standard player helpers ----

  const currentQuestion = questionPool[playerIndex] ?? null;

  useEffect(() => {
    setSelectedOption(null);
    setAttemptResult(null);
    setSubmittingAttempt(false);
  }, [currentQuestion?.question_id]);

  const playerLabel = useMemo(() => {
    if (mode === "random") return "Random Pool";
    return selectedTopic ? `${selectedTopic} Pool` : "Choose a topic";
  }, [mode, selectedTopic]);

  const hasStandardPlayer =
    mode === "random" || (mode === "topic" && Boolean(selectedTopic));

  const handleModeChange = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setPlayerIndex(0);
    setQuestionPool([]);
    if (nextMode !== "topic") setSelectedTopic(null);
    if (nextMode !== "multi-step") {
      setMsRootQ(null);
      setMsFollowUps([]);
    }
  };

  const handleTopicPick = (topic: string) => {
    setSelectedTopic(topic);
    setPlayerIndex(0);
    setQuestionPool([]);
    setError(null);
  };

  const handleDifficultyChange = (value: Difficulty | "") => {
    setDifficulty(value);
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value.trim());
    }, 300);
  };

  const handleOptionClick = async (optionIdx: number) => {
    if (!currentQuestion || submittingAttempt || attemptResult) return;
    setSelectedOption(optionIdx);
    setSubmittingAttempt(true);
    try {
      const res = await submitAttempt(currentQuestion.question_id, optionIdx);
      setAttemptResult(res.data);
      setError(null);
    } catch {
      setError("Failed to submit attempt");
    } finally {
      setSubmittingAttempt(false);
    }
  };

  const getOptionClassName = (optionIdx: number) => {
    const base =
      "rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed";

    if (!attemptResult) {
      return `${base} border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50`;
    }
    if (optionIdx === attemptResult.correct_option) {
      return `${base} border-emerald-500 bg-emerald-50 text-emerald-900`;
    }
    if (optionIdx === selectedOption && !attemptResult.correct) {
      return `${base} border-rose-500 bg-rose-50 text-rose-900`;
    }
    return `${base} border-slate-200 bg-slate-50 text-slate-500`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="m-0 text-3xl font-bold text-slate-900">Question Bank</h1>
        <p className="mt-1 text-sm text-slate-600">Study by specialty or run a random question stream.</p>
      </div>

      <div className="sticky top-20 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleModeChange("topic")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === "topic" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            By Topic
          </button>
          <button
            onClick={() => handleModeChange("random")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === "random" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Random
          </button>
          <button
            onClick={() => handleModeChange("multi-step")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === "multi-step"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Multi-steps
          </button>

          <select
            value={difficulty}
            onChange={(e) => handleDifficultyChange(e.target.value as Difficulty | "")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search stem/topic..."
            className="min-w-64 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Topic cards grid */}
      {mode === "topic" && !selectedTopic && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Choose a topic</h2>
          {loadingTopics ? (
            <p className="text-slate-600">Loading topics...</p>
          ) : topics.length === 0 ? (
            <p className="text-slate-600">No topics available.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => handleTopicPick(topic)}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-300 hover:bg-blue-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{topic}</p>
                  <p className="mt-1 text-xs text-slate-500">Open question stream</p>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Standard player (By Topic + Random) */}
      {hasStandardPlayer && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{playerLabel}</p>
              <p className="text-sm text-slate-600">
                {loadingPool ? "Loading..." : `${questionPool.length} questions in current pool`}
              </p>
            </div>

            {mode === "topic" && selectedTopic && (
              <button
                onClick={() => {
                  setSelectedTopic(null);
                  setQuestionPool([]);
                  setPlayerIndex(0);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Change Topic
              </button>
            )}
          </div>

          {loadingPool ? (
            <p className="text-slate-600">Loading questions...</p>
          ) : !currentQuestion ? (
            <p className="text-slate-600">No questions match current filters.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {currentQuestion.topic}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${DIFFICULTY_COLORS[currentQuestion.difficulty]}`}
                >
                  {currentQuestion.difficulty}
                </span>
                <span className="text-xs text-slate-500">
                  Question {playerIndex + 1} of {questionPool.length}
                </span>
              </div>

              <p className="text-lg font-medium leading-7 text-slate-900">{currentQuestion.stem}</p>

              <div className="grid gap-2 sm:grid-cols-2">
                {currentQuestion.options.map((opt, idx) => (
                  <button
                    key={`${currentQuestion.question_id}-${idx}`}
                    type="button"
                    onClick={() => handleOptionClick(idx)}
                    disabled={submittingAttempt || Boolean(attemptResult)}
                    className={getOptionClassName(idx)}
                  >
                    <span className="mr-2 font-semibold text-slate-500">{String.fromCharCode(65 + idx)}.</span>
                    {opt}
                  </button>
                ))}
              </div>

              {attemptResult && (
                <div
                  className={`rounded-lg border-l-4 px-4 py-3 ${
                    attemptResult.correct
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                      : "border-rose-600 bg-rose-50 text-rose-900"
                  }`}
                >
                  <p className="mb-1 text-sm font-semibold">
                    {attemptResult.correct ? "Correct" : "Incorrect"}
                  </p>
                  <p className="text-sm leading-6">{attemptResult.explanation}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button
                  onClick={() => setPlayerIndex((prev) => Math.max(0, prev - 1))}
                  disabled={playerIndex === 0}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {LEFT_ARROW} Previous
                </button>

                <span className="text-xs text-slate-500">
                  {attemptResult
                    ? "Review feedback, then continue"
                    : submittingAttempt
                      ? "Submitting answer..."
                      : "Choose an answer to reveal feedback"}
                </span>

                <button
                  onClick={() =>
                    setPlayerIndex((prev) => Math.min(questionPool.length - 1, prev + 1))
                  }
                  disabled={playerIndex >= questionPool.length - 1}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next {RIGHT_ARROW}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Multi-step chain view */}
      {mode === "multi-step" && (
        <div className="space-y-4">
          {msLoadingChain && !msRootQ && (
            <p className="text-slate-600">Loading question...</p>
          )}

          {!msLoadingChain && !msRootQ && (
            <p className="text-slate-600">No multi-step questions available.</p>
          )}

          {msRootQ && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <ChainCard
                question={msRootQ}
                result={msRootResult}
                onSubmit={handleMsRootSubmit}
              />
            </div>
          )}

          {msFollowUps.map((fu, index) => (
            <div
              key={fu.question.question_id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Follow-up {index + 1}
              </p>
              <ChainCard
                question={fu.question}
                result={fu.result}
                onSubmit={(idx) => handleMsFollowUpSubmit(index, idx)}
              />
            </div>
          ))}

          {msLoadingChain && msRootQ && (
            <p className="text-sm text-slate-500">Loading follow-up...</p>
          )}

          {msRootResult && msChainEnded && (
            <button
              onClick={handleMsNext}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Next Chain →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
