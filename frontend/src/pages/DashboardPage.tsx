import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../components/StatCard";
import { getOverviewStats, type OverviewStats } from "../api/statsApi";

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOverviewStats()
      .then((res) => setStats(res.data))
      .catch(() => setError("Failed to load stats."))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <p>You are logged in 🎉</p>

      {error ? (
        <p style={{ color: "#dc2626" }}>{error}</p>
      ) : (
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
            value={loading ? "—" : stats?.total_questions_answered ?? "—"}
          />
          <StatCard
            label="Accuracy"
            value={
              loading
                ? "—"
                : stats != null
                ? `${stats.correct_percentage.toFixed(1)}%`
                : "—"
            }
          />
          <StatCard
            label="Chapters Covered"
            value={loading ? "—" : stats?.unique_chapters_covered ?? "—"}
          />
        </div>
      )}

      <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Link to="/chapters">Chapters</Link>
        <Link to="/questions">Question Bank</Link>
      </nav>

      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
