import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getCaseById, type CaseFull } from "../api/casesApi";

const SECTIONS: { key: keyof CaseFull; label: string }[] = [
  { key: "presentation", label: "Presentation" },
  { key: "history", label: "History" },
  { key: "physical_exam", label: "Physical Exam" },
  { key: "labs", label: "Labs" },
  { key: "imaging", label: "Imaging" },
  { key: "discussion", label: "Discussion" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "management", label: "Management" },
];

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<CaseFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getCaseById(id)
      .then((res) => {
        setCaseData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load case. It may not exist.");
        setLoading(false);
      });
  }, [id]);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/cases" style={{ color: "#1565c0", textDecoration: "none" }}>
          ← Back to Cases
        </Link>
      </div>

      {loading && <p>Loading case...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && caseData && (
        <>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: "0 0 6px 0", fontSize: 24 }}>{caseData.title}</h1>
            <span
              style={{
                display: "inline-block",
                background: "#1565c0",
                color: "#fff",
                borderRadius: 4,
                padding: "2px 10px",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {caseData.specialty}
            </span>
          </div>

          {SECTIONS.map(({ key, label }) => {
            const text = caseData[key] as string;
            if (!text) return null;
            return (
              <div
                key={key}
                style={{
                  marginBottom: 20,
                  padding: "16px",
                  border: "1px solid #e0e0e0",
                  borderRadius: 6,
                  background: "#fafafa",
                }}
              >
                <p style={{ margin: "0 0 6px 0", fontWeight: 700, fontSize: 15 }}>
                  {label}
                </p>
                <p style={{ margin: 0, lineHeight: 1.6, color: "#333" }}>{text}</p>
              </div>
            );
          })}

          <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid #eee" }}>
            <button
              onClick={() => setShowHint((prev) => !prev)}
              style={{
                padding: "8px 18px",
                background: showHint ? "#455a64" : "#37474f",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {showHint ? "Hide Hint" : "Show Hint"}
            </button>

            {showHint && (
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 16px",
                  background: "#e8f5e9",
                  border: "1px solid #a5d6a7",
                  borderRadius: 6,
                  fontSize: 14,
                  color: "#1b5e20",
                }}
              >
                <strong>Reference:</strong>{" "}
                {caseData.chapter_title
                  ? `${caseData.chapter_title} — ${caseData.chapter_ref}`
                  : caseData.chapter_ref}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
