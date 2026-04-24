import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getCases, type CaseListItem } from "../api/casesApi";

const SPECIALTY_COLORS: Record<string, string> = {
  cardiology: "#c62828",
  pulmonology: "#1565c0",
  gastroenterology: "#2e7d32",
  nephrology: "#6a1b9a",
  endocrinology: "#e65100",
  hematology: "#ad1457",
  infectious: "#00695c",
  neurology: "#4527a0",
};

function getSpecialtyColor(specialty: string): string {
  const key = specialty.toLowerCase();
  for (const [prefix, color] of Object.entries(SPECIALTY_COLORS)) {
    if (key.includes(prefix)) return color;
  }
  return "#455a64";
}

export default function CasesPage() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");

  useEffect(() => {
    getCases()
      .then((res) => {
        setCases(res.data);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load cases");
        setLoading(false);
      });
  }, []);

  const specialties = useMemo(() => {
    const unique = Array.from(new Set(cases.map((c) => c.specialty))).sort();
    return unique;
  }, [cases]);

  const filtered = useMemo(() => {
    if (!selectedSpecialty) return cases;
    return cases.filter((c) => c.specialty === selectedSpecialty);
  }, [cases, selectedSpecialty]);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Clinical Cases</h1>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select
          value={selectedSpecialty}
          onChange={(e) => setSelectedSpecialty(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 200 }}
        >
          <option value="">All Specialties</option>
          {specialties.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading && <p>Loading cases...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p style={{ color: "#666" }}>No cases found for the selected specialty.</p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {filtered.map((c) => (
            <li
              key={c.case_id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 6,
                padding: "16px",
                marginBottom: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>{c.title}</h3>
                <span
                  style={{
                    background: getSpecialtyColor(c.specialty),
                    color: "#fff",
                    borderRadius: 4,
                    padding: "2px 10px",
                    fontSize: 12,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.specialty}
                </span>
              </div>
              <div>
                <Link
                  to={`/cases/${c.case_id}`}
                  style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    background: "#1565c0",
                    color: "#fff",
                    borderRadius: 4,
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                >
                  View Case
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
