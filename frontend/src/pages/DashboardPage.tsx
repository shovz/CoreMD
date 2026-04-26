import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDashboardStats, getStats, type DashboardStats, type QuestionStats } from "../api/statsApi";
import { useAuthContext } from "../context/AuthContext";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}

export default function DashboardPage() {
  const { user } = useAuthContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [perfStats, setPerfStats] = useState<QuestionStats | null>(null);
  const [perfLoading, setPerfLoading] = useState(true);
  const navigate = useNavigate();

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const lastName = user?.full_name?.trim().split(/\s+/).at(-1) ?? "";
  const greeting = lastName ? `${timeOfDay}, Dr. ${lastName} ✦` : `${timeOfDay}, Doctor ✦`;

  useEffect(() => {
    getDashboardStats()
      .then((res) => setStats(res.data))
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
    getStats()
      .then((res) => setPerfStats(res.data))
      .catch(() => {})
      .finally(() => setPerfLoading(false));
  }, []);

  const isEmpty = !loading && !error && (stats?.questions_answered ?? 0) === 0;
  const hasLastActivity = stats?.last_chapter != null || stats?.last_question != null;
  const hasFocusTopics = (stats?.weak_topics?.length ?? 0) > 0;

  const DIFFICULTY_ORDER = ["easy", "medium", "hard"];
  const totalAttempted = perfStats
    ? Object.values(perfStats.by_difficulty).reduce((sum, d) => sum + d.attempted, 0)
    : 0;
  const hasPerfData = totalAttempted > 0;
  const sortedTopics = perfStats
    ? [...perfStats.by_topic].sort((a, b) => b.accuracy - a.accuracy).slice(0, 8)
    : [];

  return (
    <div className="space-y-6 px-6 py-8">
      <h1 className="text-3xl font-bold text-slate-900">{greeting}</h1>

      {error && <p className="text-red-600">{error}</p>}

      {!error && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: stats bar + continue card */}
          <div className="space-y-4">
            {/* Stats bar */}
            {loading ? (
              <SkeletonBlock className="h-16" />
            ) : (
              <div className="flex flex-row flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3">
                  <span className="text-2xl font-bold text-slate-900">
                    🔥 {stats?.streak_days ?? 0}
                  </span>
                  <span className="text-sm text-slate-500">days</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3">
                  <span className="text-2xl font-bold text-slate-900">
                    {stats?.questions_answered ?? 0}
                  </span>
                  <span className="text-sm text-slate-500">questions</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3">
                  <span className="text-2xl font-bold text-slate-900">
                    {stats?.accuracy_pct ?? 0}%
                  </span>
                  <span className="text-sm text-slate-500">accuracy</span>
                </div>
              </div>
            )}

            {/* Empty state */}
            {isEmpty && (
              <p className="italic text-slate-500">
                Start by reading a chapter or trying a question — your progress will appear here.
              </p>
            )}

            {/* Continue card */}
            {loading ? (
              <SkeletonBlock className="h-28" />
            ) : (
              hasLastActivity && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                  <h2 className="text-lg font-semibold text-slate-800">Continue</h2>
                  {stats?.last_chapter && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                        Last chapter
                      </p>
                      <Link
                        to={`/chapters/${stats.last_chapter.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {stats.last_chapter.title}
                      </Link>
                    </div>
                  )}
                  {stats?.last_question && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                        Last question
                      </p>
                      <Link
                        to={`/questions/${stats.last_question.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {stats.last_question.topic}
                      </Link>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {/* Right column: focus topics */}
          <div>
            {loading ? (
              <SkeletonBlock className="h-28" />
            ) : (
              hasFocusTopics && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-slate-800 mb-3">
                    Focus Topics
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {stats?.weak_topics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() =>
                          navigate(`/questions?topic=${encodeURIComponent(topic)}`)
                        }
                        className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Performance section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Performance</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Difficulty breakdown card */}
            {perfLoading ? (
              <SkeletonBlock className="h-40" />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">By Difficulty</h3>
                {!hasPerfData ? (
                  <p className="italic text-slate-500">
                    No data yet — start answering questions
                  </p>
                ) : (
                  <div className="space-y-3">
                    {DIFFICULTY_ORDER.map((diff) => {
                      const d = perfStats?.by_difficulty[diff];
                      if (!d) return null;
                      return (
                        <div key={diff}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-slate-700 capitalize">{diff}</span>
                            <span className="text-slate-500">
                              {d.attempted} attempts · {Math.round(d.accuracy)}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{ width: `${Math.round(d.accuracy)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Topics breakdown card */}
            {perfLoading ? (
              <SkeletonBlock className="h-40" />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">By Topic</h3>
                {!hasPerfData ? (
                  <p className="italic text-slate-500">
                    No data yet — start answering questions
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sortedTopics.map((t) => (
                      <div key={t.topic}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700 truncate max-w-[60%]">
                            {t.topic}
                          </span>
                          <span className="text-slate-500">
                            {t.attempted} · {Math.round(t.accuracy)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${Math.round(t.accuracy)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
