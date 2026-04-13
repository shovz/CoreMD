import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getQuestionById, submitAttempt, type QuestionFull, type AttemptResult } from "../api/questionsApi";

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [question, setQuestion] = useState<QuestionFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getQuestionById(id)
      .then((res) => {
        setQuestion(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load question.");
        setLoading(false);
      });
  }, [id]);

  const handleOptionClick = async (index: number) => {
    if (result || submitting || !id) return;
    setSelected(index);
    setSubmitting(true);
    try {
      const res = await submitAttempt(id, index);
      setResult(res.data);
    } catch {
      setError("Failed to submit attempt.");
    } finally {
      setSubmitting(false);
    }
  };

  const getOptionStyle = (index: number): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: "block",
      width: "100%",
      padding: "12px 16px",
      marginBottom: 10,
      textAlign: "left",
      border: "1px solid #ccc",
      borderRadius: 6,
      cursor: result ? "default" : "pointer",
      background: "#fff",
      fontSize: 15,
      lineHeight: 1.5,
    };

    if (!result) return base;

    if (index === result.correct_option) {
      return { ...base, background: "#e8f5e9", borderColor: "#2e7d32", color: "#1b5e20" };
    }
    if (index === selected && !result.correct) {
      return { ...base, background: "#ffebee", borderColor: "#c62828", color: "#b71c1c" };
    }
    return { ...base, background: "#fafafa", color: "#999" };
  };

  if (loading) return <p style={{ padding: 24 }}>Loading question...</p>;
  if (error) return <p style={{ padding: 24, color: "red" }}>{error}</p>;
  if (!question) return null;

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <Link to="/questions" style={{ fontSize: 14, display: "inline-block", marginBottom: 20 }}>
        ← Back to Questions
      </Link>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ background: "#e3f2fd", color: "#0d47a1", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 500 }}>
          {question.topic}
        </span>
        <span style={{ background: "#ede7f6", color: "#4527a0", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 500 }}>
          {question.chapter_ref}
        </span>
        <span style={{ background: "#fff3e0", color: "#e65100", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 500, textTransform: "capitalize" }}>
          {question.difficulty}
        </span>
      </div>

      <p style={{ fontSize: 17, lineHeight: 1.7, marginBottom: 24 }}>{question.stem}</p>

      <div>
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleOptionClick(index)}
            disabled={!!result || submitting}
            style={getOptionStyle(index)}
          >
            <strong style={{ marginRight: 8 }}>{String.fromCharCode(65 + index)}.</strong>
            {option}
          </button>
        ))}
      </div>

      {result && (
        <div
          style={{
            marginTop: 20,
            padding: "16px 20px",
            borderRadius: 6,
            background: result.correct ? "#e8f5e9" : "#ffebee",
            borderLeft: `4px solid ${result.correct ? "#2e7d32" : "#c62828"}`,
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600, color: result.correct ? "#1b5e20" : "#b71c1c" }}>
            {result.correct ? "Correct!" : "Incorrect"}
          </p>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{result.explanation}</p>
        </div>
      )}
    </div>
  );
}
