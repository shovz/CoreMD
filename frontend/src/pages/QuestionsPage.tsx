import { useEffect, useMemo, useRef, useState } from "react";
import {
  getQuestionTopics,
  getQuestions,
  submitAttempt,
  type AttemptResult,
  type Difficulty,
  type QuestionOut,
} from "../api/questionsApi";

type Mode = "topic" | "random";

const PAGE_LIMIT = 100;
const LEFT_ARROW = "<";
const RIGHT_ARROW = ">";

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

export default function QuestionsPage() {
  const [mode, setMode] = useState<Mode>("topic");
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [questionPool, setQuestionPool] = useState<QuestionOut[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);

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

  useEffect(() => {
    if (mode === "topic" && !selectedTopic) {
      return;
    }

    let cancelled = false;

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

    return () => {
      cancelled = true;
    };
  }, [mode, selectedTopic, difficulty, debouncedSearch]);

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

  const hasPlayer = mode === "random" || (mode === "topic" && Boolean(selectedTopic));

  const handleModeChange = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setLoadingPool(nextMode === "random");
    setPlayerIndex(0);
    setQuestionPool([]);
    if (nextMode === "random") {
      setSelectedTopic(null);
    }
  };

  const handleTopicPick = (topic: string) => {
    setSelectedTopic(topic);
    setLoadingPool(true);
    setPlayerIndex(0);
    setQuestionPool([]);
    setError(null);
  };

  const handleDifficultyChange = (value: Difficulty | "") => {
    setDifficulty(value);
    if (hasPlayer) setLoadingPool(true);
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value.trim());
      if (hasPlayer) setLoadingPool(true);
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

      {hasPlayer && (
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
    </div>
  );
}
