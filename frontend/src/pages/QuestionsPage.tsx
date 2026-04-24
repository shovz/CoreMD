import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  getQuestions,
  getQuestionTopics,
  type Difficulty,
  type QuestionOut,
} from "../api/questionsApi";
import { getQuestionStats } from "../api/statsApi";

interface TopicStat {
  name: string;
  total: number;
  accuracy: number | null;
}

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

function topicCardBorder(accuracy: number | null): string {
  if (accuracy === null) return "border-slate-200 bg-white";
  if (accuracy >= 70) return "border-emerald-400 bg-emerald-50";
  if (accuracy >= 40) return "border-amber-400 bg-amber-50";
  return "border-rose-400 bg-rose-50";
}

export default function QuestionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [topicStats, setTopicStats] = useState<TopicStat[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(
    searchParams.get("topic"),
  );
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      getQuestionTopics(),
      getQuestionStats(),
      getQuestions({ limit: 500 }),
    ])
      .then(([topicsRes, statsRes, allQRes]) => {
        const names = topicsRes.data;
        const statsMap = new Map(
          statsRes.data.by_topic.map((t) => [t.topic, t]),
        );
        const countMap = new Map<string, number>();
        allQRes.data.forEach((q) => {
          countMap.set(q.topic, (countMap.get(q.topic) ?? 0) + 1);
        });

        setTopicStats(
          names.map((name) => {
            const s = statsMap.get(name);
            return {
              name,
              total: countMap.get(name) ?? 0,
              accuracy: s && s.attempted > 0 ? s.accuracy : null,
            };
          }),
        );
        setError(null);
      })
      .catch(() => setError("Failed to load topics"))
      .finally(() => setLoadingData(false));

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingQuestions(true);

    const load = async () => {
      try {
        const collected: QuestionOut[] = [];
        let offset = 0;
        const LIMIT = 100;

        while (true) {
          const res = await getQuestions({
            topic: selectedTopic ?? undefined,
            difficulty: difficulty || undefined,
            search: debouncedSearch || undefined,
            limit: LIMIT,
            offset,
          });
          collected.push(...res.data);
          if (res.data.length < LIMIT) break;
          offset += LIMIT;
        }

        if (!cancelled) {
          setQuestions(collected);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setQuestions([]);
          setError("Failed to load questions");
        }
      } finally {
        if (!cancelled) setLoadingQuestions(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedTopic, difficulty, debouncedSearch]);

  const handleTopicClick = (topic: string) => {
    const next = selectedTopic === topic ? null : topic;
    setSelectedTopic(next);
    if (next) {
      setSearchParams({ topic: next });
    } else {
      setSearchParams({});
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value.trim());
    }, 300);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="m-0 text-3xl font-bold text-slate-900">Question Bank</h1>
        <p className="mt-1 text-sm text-slate-600">
          Select a topic to filter questions. Green = strong, yellow = improving, red = needs work.
        </p>
      </div>

      <div className="sticky top-20 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}
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

          {selectedTopic && (
            <button
              onClick={() => handleTopicClick(selectedTopic)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Clear: {selectedTopic} ×
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Topics</h2>
        {loadingData ? (
          <p className="text-slate-600">Loading topics...</p>
        ) : topicStats.length === 0 ? (
          <p className="text-slate-600">No topics available.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topicStats.map((t) => (
              <button
                key={t.name}
                onClick={() => handleTopicClick(t.name)}
                className={`rounded-xl border-2 p-4 text-left shadow-sm transition hover:shadow-md ${topicCardBorder(t.accuracy)} ${
                  selectedTopic === t.name
                    ? "ring-2 ring-blue-500 ring-offset-1"
                    : ""
                }`}
              >
                <p className="text-sm font-semibold leading-snug text-slate-900">
                  {t.name}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span>{t.total} questions</span>
                  <span
                    className={`font-semibold ${
                      t.accuracy === null
                        ? "text-slate-400"
                        : t.accuracy >= 70
                          ? "text-emerald-600"
                          : t.accuracy >= 40
                            ? "text-amber-600"
                            : "text-rose-600"
                    }`}
                  >
                    {t.accuracy === null ? "—" : `${Math.round(t.accuracy)}%`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {selectedTopic ? `${selectedTopic} — Questions` : "All Questions"}
          </h2>
          {!loadingQuestions && (
            <span className="text-sm text-slate-500">
              {questions.length} question{questions.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loadingQuestions ? (
          <p className="text-slate-600">Loading questions...</p>
        ) : questions.length === 0 ? (
          <p className="text-slate-600">No questions match current filters.</p>
        ) : (
          <div className="space-y-2">
            {questions.map((q) => (
              <Link
                key={q.question_id}
                to={`/questions/${q.question_id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <p className="text-sm text-slate-800">
                  {q.stem.length > 100 ? `${q.stem.slice(0, 100)}…` : q.stem}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {q.topic}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${DIFFICULTY_COLORS[q.difficulty]}`}
                  >
                    {q.difficulty}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
