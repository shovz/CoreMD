import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getCases, type CaseListItem } from "../api/casesApi";

// ── Specialty colors ──────────────────────────────────────────────────────────

const SPECIALTY_COLORS: Record<string, { bg: string; text: string }> = {
  cardiology:       { bg: "bg-red-100",    text: "text-red-800" },
  pulmonology:      { bg: "bg-blue-100",   text: "text-blue-800" },
  gastroenterology: { bg: "bg-green-100",  text: "text-green-800" },
  nephrology:       { bg: "bg-purple-100", text: "text-purple-800" },
  endocrinology:    { bg: "bg-orange-100", text: "text-orange-800" },
  hematology:       { bg: "bg-pink-100",   text: "text-pink-800" },
  infectious:       { bg: "bg-teal-100",   text: "text-teal-800" },
  neurology:        { bg: "bg-violet-100", text: "text-violet-800" },
};

function getSpecialtyClasses(specialty: string): { bg: string; text: string } {
  const key = specialty.toLowerCase();
  for (const [prefix, classes] of Object.entries(SPECIALTY_COLORS)) {
    if (key.includes(prefix)) return classes;
  }
  return { bg: "bg-slate-100", text: "text-slate-700" };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ── Constants ─────────────────────────────────────────────────────────────────

type CaseMode = "topic" | "random";

const SESSION_LENGTH_OPTIONS = [
  { value: 5,  label: "5" },
  { value: 10, label: "10" },
  { value: 20, label: "20" },
  { value: 0,  label: "∞" },
];

const TIMER_OPTIONS = [
  { value: 0,   label: "No timer" },
  { value: 30,  label: "30 s" },
  { value: 60,  label: "60 s" },
  { value: 120, label: "120 s" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const navigate = useNavigate();

  // Data
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Launcher state
  const [launcherMode, setLauncherMode] = useState<CaseMode>("topic");
  const [launcherSpecialties, setLauncherSpecialties] = useState<string[]>([]);
  const [launcherSessionLength, setLauncherSessionLength] = useState(10);
  const [launcherTimer, setLauncherTimer] = useState(0);
  const [sessionLengthCustom, setSessionLengthCustom] = useState("");
  const [timerCustom, setTimerCustom] = useState("");

  // Active session (null = browse mode)
  const [sessionPool, setSessionPool] = useState<CaseListItem[] | null>(null);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual browse state
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("All");

  useEffect(() => {
    getCases()
      .then((res) => { setCases(res.data); setLoading(false); })
      .catch(() => { setError("Failed to load cases"); setLoading(false); });
  }, []);

  // Specialty data (for launcher chips + browse pills)
  const allSpecialties = useMemo(
    () => Array.from(new Set(cases.map((c) => c.specialty))).sort(),
    [cases]
  );

  // Manual browse filtered list
  const browseFiltered = useMemo(() => {
    if (selectedSpecialty === "All") return cases;
    return cases.filter((c) => c.specialty === selectedSpecialty);
  }, [cases, selectedSpecialty]);

  // ── Launcher handlers ──────────────────────────────────────────────────────

  const isSessionLengthPreset =
    sessionLengthCustom === "" && SESSION_LENGTH_OPTIONS.some((o) => o.value === launcherSessionLength);
  const isTimerPreset =
    timerCustom === "" && TIMER_OPTIONS.some((o) => o.value === launcherTimer);

  const handleSessionLengthPreset = (v: number) => { setLauncherSessionLength(v); setSessionLengthCustom(""); };
  const handleTimerPreset = (v: number) => { setLauncherTimer(v); setTimerCustom(""); };

  const handleSessionLengthCustom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setSessionLengthCustom(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) setLauncherSessionLength(n);
  };

  const handleTimerCustom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTimerCustom(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0) setLauncherTimer(n);
  };

  const toggleSpecialty = (s: string) =>
    setLauncherSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const handleStartSession = () => {
    let base = cases;
    if (launcherMode === "topic" && launcherSpecialties.length > 0) {
      base = cases.filter((c) => launcherSpecialties.includes(c.specialty));
    }
    let pool = shuffle(base);
    if (launcherSessionLength > 0) pool = pool.slice(0, launcherSessionLength);
    setSessionPool(pool);
    setSessionIndex(0);
  };

  const handleEndSession = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSessionPool(null);
  };

  // ── Session timer ──────────────────────────────────────────────────────────

  const currentCase = sessionPool?.[sessionIndex] ?? null;

  useEffect(() => {
    if (!sessionPool || launcherTimer === 0 || !currentCase) return;

    setTimeLeft(launcherTimer);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setSessionIndex((idx) => Math.min((sessionPool?.length ?? 1) - 1, idx + 1));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [currentCase?.case_id, launcherTimer, sessionPool]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const timerWarning = launcherTimer > 0 && timeLeft <= 10 && timeLeft > 0;
  const timerPct = launcherTimer > 0 ? (timeLeft / launcherTimer) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Case Studies</h1>

      {/* ── Session launcher ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        {/* Mode toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Session Mode</span>
          <div className="flex gap-2">
            {(["topic", "random"] as CaseMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setLauncherMode(m)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                  launcherMode === m
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {m === "topic" ? "By Topic" : "Random"}
              </button>
            ))}
          </div>
        </div>

        {/* Specialty chips — By Topic only */}
        {launcherMode === "topic" && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600">Specialties</span>
              <button
                onClick={() => setLauncherSpecialties([...allSpecialties])}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => setLauncherSpecialties([])}
                className="text-xs font-medium text-slate-500 hover:underline"
              >
                Clear
              </button>
              {launcherSpecialties.length > 0 && (
                <span className="text-xs text-slate-400">{launcherSpecialties.length} selected</span>
              )}
              {launcherSpecialties.length === 0 && (
                <span className="text-xs text-slate-400">all specialties</span>
              )}
            </div>
            <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap gap-2">
                {allSpecialties.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSpecialty(s)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      launcherSpecialties.includes(s)
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-700 border border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Session length + timer in one row */}
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-600">Session Length (num of cases)</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {SESSION_LENGTH_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleSessionLengthPreset(value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    isSessionLengthPreset && launcherSessionLength === value
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={sessionLengthCustom}
                onChange={handleSessionLengthCustom}
                placeholder="Custom"
                className="w-30 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-600">Timer per Case</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {TIMER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleTimerPreset(value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    isTimerPreset && launcherTimer === value
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
              <input
                type="number"
                min={0}
                value={timerCustom}
                onChange={handleTimerCustom}
                placeholder="Custom (s)"
                className="w-30 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleStartSession}
          disabled={loading || cases.length === 0}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start Session →
        </button>
      </div>

      {/* ── Active session view ───────────────────────────────────────────── */}
      {sessionPool !== null && (
        <div className="space-y-4">
          {/* Session header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleEndSession}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                ← End Session
              </button>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                Case {sessionIndex + 1} / {sessionPool.length}
              </span>
              <span className="text-xs text-slate-400">
                {launcherMode === "topic" && launcherSpecialties.length > 0
                  ? `${launcherSpecialties.length} specialt${launcherSpecialties.length === 1 ? "y" : "ies"}`
                  : "Random"}
              </span>
            </div>
          </div>

          {/* Timer bar */}
          {launcherTimer > 0 && currentCase && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className={timerWarning ? "text-rose-600" : "text-slate-500"}>Time left</span>
                <span className={timerWarning ? "text-rose-600 tabular-nums" : "text-slate-500 tabular-nums"}>
                  {timeLeft}s
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${timerWarning ? "bg-rose-500" : "bg-blue-500"}`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Current case card */}
          {currentCase ? (
            (() => {
              const { bg, text } = getSpecialtyClasses(currentCase.specialty);
              return (
                <div
                  onClick={() => navigate(`/cases/${currentCase.case_id}`)}
                  className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${bg} ${text}`}>
                      {currentCase.specialty}
                    </span>
                    <span className="text-sm text-slate-400 group-hover:text-blue-600 transition-colors">
                      → Open case
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{currentCase.title}</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">{currentCase.presentation}</p>
                </div>
              );
            })()
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-700">Session complete!</p>
              <p className="text-xs text-slate-500">You've reviewed all {sessionPool.length} cases.</p>
              <button
                onClick={handleEndSession}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Back to browse
              </button>
            </div>
          )}

          {/* Session complete banner */}
          {currentCase && sessionIndex >= sessionPool.length - 1 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-emerald-700">
                Last case — session complete after this one.
              </p>
            </div>
          )}

          {/* Prev / Next */}
          {currentCase && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                onClick={() => setSessionIndex((i) => Math.max(0, i - 1))}
                disabled={sessionIndex === 0}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                onClick={() => setSessionIndex((i) => Math.min(sessionPool.length - 1, i + 1))}
                disabled={sessionIndex >= sessionPool.length - 1}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Manual browse (always visible) ───────────────────────────────── */}
      <div>
        {/* Specialty filter pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          {["All", ...allSpecialties].map((s) => (
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

        {!loading && !error && browseFiltered.length === 0 && (
          <p className="text-slate-500">No cases found for this specialty.</p>
        )}

        {!loading && !error && browseFiltered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {browseFiltered.map((c) => {
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
    </div>
  );
}
