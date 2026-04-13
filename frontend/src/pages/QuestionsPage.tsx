import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getQuestions,
  type QuestionOut,
  type Difficulty,
} from "../api/questionsApi";

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "#2e7d32",
  medium: "#e65100",
  hard: "#b71c1c",
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [topicFilter, setTopicFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    getQuestions({
      difficulty: difficulty || undefined,
      topic: topicFilter || undefined,
    })
      .then((res) => {
        setQuestions(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load questions");
        setLoading(false);
      });
  }, [difficulty, topicFilter]);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Question Bank</h1>
        <Link to="/">← Dashboard</Link>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}
          style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}
        >
          <option value="">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        <input
          type="text"
          placeholder="Filter by topic..."
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 200 }}
        />
      </div>

      {loading && <p>Loading questions...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && questions.length === 0 && (
        <p style={{ color: "#666" }}>No questions match the current filters.</p>
      )}

      {!loading && !error && questions.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {questions.map((q) => (
            <li
              key={q.question_id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 6,
                padding: "12px 16px",
                marginBottom: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span
                  style={{
                    background: "#e3f2fd",
                    color: "#0d47a1",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {q.topic}
                </span>
                <span
                  style={{
                    background: DIFFICULTY_COLORS[q.difficulty],
                    color: "#fff",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 12,
                    fontWeight: 500,
                    textTransform: "capitalize",
                  }}
                >
                  {q.difficulty}
                </span>
              </div>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{q.stem}</p>
              <div>
                <Link to={`/questions/${q.question_id}`} style={{ fontSize: 14 }}>
                  Attempt →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
