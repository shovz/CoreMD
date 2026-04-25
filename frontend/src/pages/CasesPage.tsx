import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getCases, type CaseListItem } from "../api/casesApi";

const SPECIALTY_COLORS: Record<string, { bg: string; text: string }> = {
  cardiology:      { bg: "bg-red-100",    text: "text-red-800" },
  pulmonology:     { bg: "bg-blue-100",   text: "text-blue-800" },
  gastroenterology:{ bg: "bg-green-100",  text: "text-green-800" },
  nephrology:      { bg: "bg-purple-100", text: "text-purple-800" },
  endocrinology:   { bg: "bg-orange-100", text: "text-orange-800" },
  hematology:      { bg: "bg-pink-100",   text: "text-pink-800" },
  infectious:      { bg: "bg-teal-100",   text: "text-teal-800" },
  neurology:       { bg: "bg-violet-100", text: "text-violet-800" },
};

function getSpecialtyClasses(specialty: string): { bg: string; text: string } {
  const key = specialty.toLowerCase();
  for (const [prefix, classes] of Object.entries(SPECIALTY_COLORS)) {
    if (key.includes(prefix)) return classes;
  }
  return { bg: "bg-slate-100", text: "text-slate-700" };
}

export default function CasesPage() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("All");
  const navigate = useNavigate();

  useEffect(() => {
    getCases()
      .then((res) => {
        setCases(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load cases");
        setLoading(false);
      });
  }, []);

  const specialties = useMemo(() => {
    const unique = Array.from(new Set(cases.map((c) => c.specialty))).sort();
    return ["All", ...unique];
  }, [cases]);

  const filtered = useMemo(() => {
    if (selectedSpecialty === "All") return cases;
    return cases.filter((c) => c.specialty === selectedSpecialty);
  }, [cases, selectedSpecialty]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-slate-900">Case Studies</h1>

      {/* Specialty filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {specialties.map((s) => (
          <button
            key={s}
            onClick={() => setSelectedSpecialty(s)}
            className={
              selectedSpecialty === s
                ? "rounded-full px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white shadow-sm"
                : "rounded-full px-4 py-1.5 text-sm font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            }
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 h-5 w-3/4 rounded bg-slate-200" />
              <div className="mb-3 h-4 w-1/4 rounded bg-slate-200" />
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="mt-1 h-3 w-5/6 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-slate-500">No cases found for this specialty.</p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const { bg, text } = getSpecialtyClasses(c.specialty);
            const preview = c.presentation.slice(0, 120) + (c.presentation.length > 120 ? "…" : "");
            return (
              <div
                key={c.case_id}
                onClick={() => navigate(`/cases/${c.case_id}`)}
                className="group flex cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${bg} ${text}`}>
                      {c.specialty}
                    </span>
                  </div>
                  <h2 className="mb-2 text-base font-bold text-slate-900 leading-snug">{c.title}</h2>
                  <p className="text-sm text-slate-500 leading-relaxed">{preview}</p>
                </div>
                <div className="mt-4 flex justify-end">
                  <span className="text-lg text-slate-400 transition-transform group-hover:translate-x-1">→</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
