import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../components/StatCard";
import AccuracyBarChart from "../components/AccuracyBarChart";
import {
  getOverviewStats,
  getQuestionStats,
  type OverviewStats,
  type QuestionStats,
} from "../api/statsApi";

const EM_DASH = "\u2014";

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getOverviewStats(), getQuestionStats()])
      .then(([overviewRes, questionRes]) => {
        setOverview(overviewRes.data);
        setQuestionStats(questionRes.data);
      })
      .catch(() => setError("Failed to load stats."))
      .finally(() => setLoading(false));
  }, []);

  const difficultyData = questionStats
    ? Object.entries(questionStats.by_difficulty).map(([key, val]) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      attempted: val.attempted,
      accuracy: val.accuracy,
    }))
    : [];

  const topicData = questionStats
    ? [...questionStats.by_topic]
      .sort((a, b) => b.attempted - a.attempted)
      .map((t) => ({ label: t.topic, attempted: t.attempted, accuracy: t.accuracy }))
    : [];

  const isEmpty = !loading && overview?.total_questions_answered === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="m-0 text-3xl font-bold text-slate-900">My Dashboard</h1>
      </div>

      {error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <StatCard
              label="Questions Answered"
              value={loading ? EM_DASH : overview?.total_questions_answered ?? EM_DASH}
            />
            <StatCard
              label="Accuracy"
              value={
                loading
                  ? EM_DASH
                  : overview != null
                    ? `${overview.correct_percentage.toFixed(1)}%`
                    : EM_DASH
              }
            />
            <StatCard
              label="Chapters Covered"
              value={loading ? EM_DASH : overview?.unique_chapters_covered ?? EM_DASH}
            />
          </div>

          {isEmpty ? (
            <p className="italic text-slate-500">
              No attempts yet {EM_DASH} head to the <Link to="/questions">Question Bank</Link> to get started
            </p>
          ) : (
            <>
              <AccuracyBarChart
                title="Performance by Difficulty"
                data={difficultyData}
              />
              <AccuracyBarChart
                title="Performance by Specialty"
                data={topicData}
              />
            </>
          )}
        </>
      )}

    </div>
  );
}
