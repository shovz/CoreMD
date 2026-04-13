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

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  };

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
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>My Dashboard</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {error ? (
        <p style={{ color: "#dc2626" }}>{error}</p>
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
              value={loading ? "—" : overview?.total_questions_answered ?? "—"}
            />
            <StatCard
              label="Accuracy"
              value={
                loading
                  ? "—"
                  : overview != null
                  ? `${overview.correct_percentage.toFixed(1)}%`
                  : "—"
              }
            />
            <StatCard
              label="Chapters Covered"
              value={loading ? "—" : overview?.unique_chapters_covered ?? "—"}
            />
          </div>

          {isEmpty ? (
            <p style={{ color: "#6b7280", fontStyle: "italic" }}>
              No attempts yet — head to the{" "}
              <Link to="/questions">Question Bank</Link> to get started
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

      <nav style={{ display: "flex", gap: 16, marginTop: 24 }}>
        <Link to="/">Dashboard</Link>
        <Link to="/chapters">Chapters</Link>
        <Link to="/questions">Question Bank</Link>
      </nav>
    </div>
  );
}
