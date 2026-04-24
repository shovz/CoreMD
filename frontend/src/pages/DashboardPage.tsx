import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDashboardStats, type DashboardStats } from "../api/statsApi";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getDashboardStats()
      .then((res) => setStats(res.data))
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const isEmpty = !loading && !error && (stats?.questions_answered ?? 0) === 0;
  const hasLastActivity = stats?.last_chapter != null || stats?.last_question != null;
  const hasFocusTopics = (stats?.weak_topics?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Study Deck</h1>

      {error && <p className="text-red-600">{error}</p>}

      {!error && (
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
      )}
    </div>
  );
}
