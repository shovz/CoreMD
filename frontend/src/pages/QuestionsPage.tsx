import React, { useEffect, useRef, useState } from "react";
import {
  getQuestionTopics,
  getQuestions,
  getQuestionById,
  getQuestionFollowUps,
  getAnsweredCorrectly,
  submitAttempt,
  type AttemptResult,
  type Difficulty,
  type QuestionFull,
  type QuestionOut,
} from "../api/questionsApi";

type Mode = "topic" | "random" | "multi-step";
type Phase = "settings" | "playing";

interface SessionSettings {
  mode: Mode;
  difficulty: Difficulty | "";
  topics: string[];
  sessionLength: number;  // 0 = unlimited
  timerSeconds: number;   // 0 = no timer
  excludeAnswered: boolean;
}

const PAGE_LIMIT = 100;
const MAX_CHAIN_FOLLOWUPS = 3;

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

const SESSION_LENGTH_OPTIONS: { value: number; label: string }[] = [
  { value: 5,  label: "5 Qs" },
  { value: 10, label: "10 Qs" },
  { value: 20, label: "20 Qs" },
  { value: 50, label: "50 Qs" },
  { value: 0,  label: "∞" },
];

const TIMER_OPTIONS: { value: number; label: string }[] = [
  { value: 0,  label: "No timer" },
  { value: 30, label: "30 s" },
  { value: 60, label: "60 s" },
  { value: 90, label: "90 s" },
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ── ChainCard ─────────────────────────────────────────────────────────────────

interface ChainCardProps {
  question: QuestionFull;
  result: AttemptResult | null;
  onSubmit: (selectedIdx: number) => Promise<void>;
  timerSeconds?: number;
  onTimeUp?: () => void;
}

function ChainCard({ question, result, onSubmit, timerSeconds = 0, onTimeUp }: ChainCardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const chainTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSelected(null);
    setSubmitting(false);
  }, [question.question_id]);

  useEffect(() => {
    if (timerSeconds === 0 || result) {
      if (chainTimerRef.current) { clearInterval(chainTimerRef.current); chainTimerRef.current = null; }
      return;
    }
    setTimeLeft(timerSeconds);
    chainTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(chainTimerRef.current!);
          chainTimerRef.current = null;
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (chainTimerRef.current) { clearInterval(chainTimerRef.current); chainTimerRef.current = null; }
    };
  }, [question.question_id, timerSeconds, result]);

  const chainTimerWarning = timerSeconds > 0 && timeLeft <= 10 && timeLeft > 0;
  const chainTimerPct = timerSeconds > 0 ? (timeLeft / timerSeconds) * 100 : 0;

  const optionClass = (idx: number) => {
    const base =
      "w-full text-left px-4 py-3 rounded-xl border-2 transition-colors text-sm leading-relaxed";
    if (!result)
      return selected === idx
        ? `${base} border-blue-500 bg-blue-50 text-blue-900`
        : `${base} border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer`;
    if (idx === result.correct_option)
      return `${base} border-emerald-500 bg-emerald-50 text-emerald-900`;
    if (idx === selected && !result.correct)
      return `${base} border-rose-500 bg-rose-50 text-rose-900`;
    return `${base} border-slate-100 bg-slate-50 text-slate-400`;
  };

  const handleSubmit = async () => {
    if (selected === null || result || submitting) return;
    setSubmitting(true);
    try { await onSubmit(selected); } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      {timerSeconds > 0 && !result && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span className={chainTimerWarning ? "text-rose-600" : "text-slate-500"}>Time left</span>
            <span className={chainTimerWarning ? "text-rose-600 tabular-nums" : "text-slate-500 tabular-nums"}>{timeLeft}s</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${chainTimerWarning ? "bg-rose-500" : "bg-blue-500"}`}
              style={{ width: `${chainTimerPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700">
          {question.topic}
        </span>
        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold capitalize ${DIFFICULTY_COLORS[question.difficulty]}`}>
          {question.difficulty}
        </span>
      </div>

      <p className="text-base leading-relaxed text-slate-800">{question.stem}</p>

      <div className="space-y-3">
        {question.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => { if (!result && !submitting) setSelected(idx); }}
            disabled={!!result || submitting}
            className={optionClass(idx)}
          >
            <span className="mr-2 font-bold">{String.fromCharCode(65 + idx)}.</span>
            {opt}
          </button>
        ))}
      </div>

      {!result && (
        <button
          onClick={handleSubmit}
          disabled={selected === null || submitting}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Submitting..." : "Submit Answer"}
        </button>
      )}

      {result && (
        <div className={`rounded-xl border-l-4 p-5 ${result.correct ? "border-emerald-500 bg-emerald-50" : "border-rose-500 bg-rose-50"}`}>
          <p className={`mb-2 font-semibold ${result.correct ? "text-emerald-700" : "text-rose-700"}`}>
            {result.correct ? "Correct!" : "Incorrect"}
          </p>
          <p className="text-sm leading-relaxed text-slate-700">{result.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ── SettingsScreen ────────────────────────────────────────────────────────────

interface SettingsScreenProps {
  topics: string[];
  loadingTopics: boolean;
  initialSettings: SessionSettings;
  onStart: (settings: SessionSettings) => void;
}

function SettingsScreen({ topics, loadingTopics, initialSettings, onStart }: SettingsScreenProps) {
  const [mode, setMode] = useState<Mode>(initialSettings.mode);
  const [difficulty, setDifficulty] = useState<Difficulty | "">(initialSettings.difficulty);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialSettings.topics);
  const [sessionLength, setSessionLength] = useState(initialSettings.sessionLength);
  const [sessionLengthCustom, setSessionLengthCustom] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(initialSettings.timerSeconds);
  const [timerCustom, setTimerCustom] = useState("");
  const [excludeAnswered, setExcludeAnswered] = useState(initialSettings.excludeAnswered);

  const canStart = mode !== "topic" || selectedTopics.length > 0;

  const handleModeChange = (m: Mode) => {
    setMode(m);
    if (m !== "topic") setSelectedTopics([]);
  };

  const toggleTopic = (t: string) =>
    setSelectedTopics((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const handleSessionLengthPreset = (value: number) => {
    setSessionLength(value);
    setSessionLengthCustom("");
  };

  const handleSessionLengthCustom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setSessionLengthCustom(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) setSessionLength(n);
  };

  const handleTimerPreset = (value: number) => {
    setTimerSeconds(value);
    setTimerCustom("");
  };

  const handleTimerCustom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTimerCustom(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0) setTimerSeconds(n);
  };

  const isSessionLengthPreset = sessionLengthCustom === "" && SESSION_LENGTH_OPTIONS.some((o) => o.value === sessionLength);
  const isTimerPreset = timerCustom === "" && TIMER_OPTIONS.some((o) => o.value === timerSeconds);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Question Bank</h1>
        <p className="mt-1 text-sm text-slate-500">Configure your study session, then start when ready.</p>
      </div>

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Study Mode */}
        <SettingRow label="Study Mode">
          <div className="flex flex-wrap gap-2">
            {(["topic", "random", "multi-step"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  mode === m ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {m === "topic" ? "By Topic" : m === "random" ? "Random" : "Multi-step"}
              </button>
            ))}
          </div>
        </SettingRow>

        {/* Topics — only for "topic" mode */}
        {mode === "topic" && (
          <SettingRow label="Topics" required>
            {loadingTopics ? (
              <p className="text-sm text-slate-500">Loading topics...</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedTopics([...topics])}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => setSelectedTopics([])}
                    className="text-xs font-medium text-slate-500 hover:underline"
                  >
                    Clear
                  </button>
                  {selectedTopics.length > 0 && (
                    <span className="text-xs text-slate-400">{selectedTopics.length} selected</span>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap gap-2">
                    {topics.map((t) => (
                      <button
                        key={t}
                        onClick={() => toggleTopic(t)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          selectedTopics.includes(t)
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </SettingRow>
        )}

        {/* Difficulty */}
        <SettingRow label="Difficulty">
          <div className="flex flex-wrap gap-2">
            {([["", "Mixed"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]] as [Difficulty | "", string][]).map(
              ([val, label]) => (
                <button
                  key={val}
                  onClick={() => setDifficulty(val)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    difficulty === val ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </SettingRow>

        {/* Session Length */}
        <SettingRow label="Session Length">
          <div className="flex flex-wrap items-center gap-2">
            {SESSION_LENGTH_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleSessionLengthPreset(value)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isSessionLengthPreset && sessionLength === value
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
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Number of questions before the session ends. ∞ means no limit.
          </p>
        </SettingRow>

        {/* Timer */}
        <SettingRow label="Timer per Question">
          <div className="flex flex-wrap items-center gap-2">
            {TIMER_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleTimerPreset(value)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isTimerPreset && timerSeconds === value
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
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {timerSeconds > 0 && (
            <p className="mt-1.5 text-xs text-slate-400">
              Question auto-advances when time runs out.
            </p>
          )}
        </SettingRow>

        {/* Skip already correct */}
        <SettingRow label="Skip already correct">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={excludeAnswered}
              onChange={(e) => setExcludeAnswered(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-blue-600"
            />
            <span className="text-sm text-slate-700">
              Exclude questions you've already answered correctly
            </span>
          </label>
        </SettingRow>
      </div>

      <button
        onClick={() => canStart && onStart({ mode, difficulty, topics: selectedTopics, sessionLength, timerSeconds, excludeAnswered })}
        disabled={!canStart}
        className="w-full rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start Session →
      </button>
    </div>
  );
}

function SettingRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-sm font-semibold text-slate-700">
        {label}{required && <span className="ml-1 text-rose-500">*</span>}
      </p>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: SessionSettings = {
  mode: "random",
  difficulty: "",
  topics: [],
  sessionLength: 10,
  timerSeconds: 0,
  excludeAnswered: false,
};

export default function QuestionsPage() {
  // Phase & settings
  const [phase, setPhase] = useState<Phase>("settings");
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS);

  // Topics
  const [topics, setTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);

  // Standard player state
  const [questionPool, setQuestionPool] = useState<QuestionOut[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [loadingPool, setLoadingPool] = useState(false);

  // Multi-step state
  const [msPool, setMsPool] = useState<QuestionOut[]>([]);
  const [msUsed, setMsUsed] = useState<Set<string>>(new Set());
  const [msRootQ, setMsRootQ] = useState<QuestionFull | null>(null);
  const [msRootResult, setMsRootResult] = useState<AttemptResult | null>(null);
  const [msFollowUps, setMsFollowUps] = useState<Array<{ question: QuestionFull; result: AttemptResult | null }>>([]);
  const [msChainEnded, setMsChainEnded] = useState(false);
  const [msLoadingChain, setMsLoadingChain] = useState(false);
  const [msChainsAnswered, setMsChainsAnswered] = useState(0);

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session score
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionAnswered, setSessionAnswered] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [allFilteredByExclude, setAllFilteredByExclude] = useState(false);

  // Load topics once (needed for settings screen)
  useEffect(() => {
    getQuestionTopics()
      .then((res) => { setTopics(res.data); setError(null); })
      .catch(() => setError("Failed to load topics"))
      .finally(() => setLoadingTopics(false));
  }, []);

  // Load standard pool when session starts (topic/random)
  useEffect(() => {
    if (phase !== "playing") return;
    if (settings.mode === "multi-step") return;
    if (settings.mode === "topic" && settings.topics.length === 0) return;

    let cancelled = false;
    setLoadingPool(true);

    const load = async () => {
      try {
        let collected: QuestionOut[] = [];

        if (settings.mode === "topic" && settings.topics.length > 1) {
          const seen = new Set<string>();
          for (const topic of settings.topics) {
            let offset = 0;
            while (true) {
              const res = await getQuestions({
                topic,
                difficulty: settings.difficulty || undefined,
                limit: PAGE_LIMIT,
                offset,
              });
              for (const q of res.data) {
                if (!seen.has(q.question_id)) { seen.add(q.question_id); collected.push(q); }
              }
              if (res.data.length < PAGE_LIMIT) break;
              offset += PAGE_LIMIT;
            }
            if (cancelled) return;
          }
          collected = shuffle(collected);
        } else {
          let offset = 0;
          while (true) {
            const res = await getQuestions({
              topic: settings.mode === "topic" ? settings.topics[0] : undefined,
              difficulty: settings.difficulty || undefined,
              limit: PAGE_LIMIT,
              offset,
            });
            collected.push(...res.data);
            if (res.data.length < PAGE_LIMIT) break;
            offset += PAGE_LIMIT;
          }
          if (settings.mode === "random") collected = shuffle(collected);
        }

        if (settings.excludeAnswered) {
          try {
            const answeredRes = await getAnsweredCorrectly();
            const answeredIds = new Set(answeredRes.data.question_ids);
            collected = collected.filter((q) => !answeredIds.has(q.question_id));
          } catch {
            // fall through with unfiltered pool if request fails
          }
        }

        const pool =
          settings.sessionLength > 0 ? collected.slice(0, settings.sessionLength) : collected;
        if (!cancelled) {
          setAllFilteredByExclude(settings.excludeAnswered && collected.length === 0);
          setQuestionPool(pool);
          setPlayerIndex(0);
          setError(null);
        }
      } catch {
        if (!cancelled) { setQuestionPool([]); setError("Failed to load questions"); }
      } finally {
        if (!cancelled) setLoadingPool(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [phase, settings]);

  // Load multi-step pool when session starts
  useEffect(() => {
    if (phase !== "playing" || settings.mode !== "multi-step") return;

    let cancelled = false;
    setMsPool([]);
    setMsUsed(new Set());
    setMsRootQ(null);
    setMsLoadingChain(true);
    setMsChainsAnswered(0);

    getQuestions({ has_followups: true, limit: PAGE_LIMIT })
      .then((res) => { if (!cancelled) setMsPool(res.data); })
      .catch(() => { if (!cancelled) setError("Failed to load multi-step questions"); })
      .finally(() => { if (!cancelled) setMsLoadingChain(false); });

    return () => { cancelled = true; };
  }, [phase, settings]);

  // Auto-start first chain once pool ready
  useEffect(() => {
    if (settings.mode === "multi-step" && msPool.length > 0 && !msRootQ && !msLoadingChain) {
      startNextChain(msPool, msUsed);
    }
  }, [msPool, msLoadingChain]);

  // Reset per-question state when question changes
  const currentQuestion = questionPool[playerIndex] ?? null;
  useEffect(() => {
    setSelectedOption(null);
    setAttemptResult(null);
    setSubmittingAttempt(false);
  }, [currentQuestion?.question_id]);

  // Timer countdown
  useEffect(() => {
    if (phase !== "playing" || settings.timerSeconds === 0 || settings.mode === "multi-step") return;
    if (!currentQuestion || attemptResult) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    setTimeLeft(settings.timerSeconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          // Auto-advance on timeout (no answer submitted)
          setPlayerIndex((idx) => Math.min(questionPool.length - 1, idx + 1));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [currentQuestion?.question_id, phase, attemptResult]);

  // ── Multi-step handlers ────────────────────────────────────────────────────

  const startNextChain = async (pool: QuestionOut[], used: Set<string>) => {
    const limit = settings.sessionLength;
    if (limit > 0 && msChainsAnswered >= limit) {
      setMsRootQ(null);
      return;
    }
    const available = pool.filter((q) => !used.has(q.question_id));
    if (available.length === 0) { setMsRootQ(null); return; }
    const pick = available[Math.floor(Math.random() * available.length)];
    setMsLoadingChain(true);
    setMsRootQ(null);
    setMsRootResult(null);
    setMsFollowUps([]);
    setMsChainEnded(false);
    try {
      const res = await getQuestionById(pick.question_id);
      setMsRootQ(res.data);
    } catch {
      setError("Failed to load question");
    } finally {
      setMsLoadingChain(false);
    }
  };

  const fetchMsFollowUp = async (parentId: string, currentCount: number): Promise<boolean> => {
    if (currentCount >= MAX_CHAIN_FOLLOWUPS) return false;
    try {
      const listRes = await getQuestionFollowUps(parentId, { trigger: "correct", limit: 1 });
      const next = listRes.data[0];
      if (!next) return false;
      const fullRes = await getQuestionById(next.question_id);
      setMsFollowUps((prev) => [...prev, { question: fullRes.data, result: null }]);
      return true;
    } catch {
      return false;
    }
  };

  const handleMsRootResult = async (attempt: AttemptResult) => {
    setMsRootResult(attempt);
    if (!attempt.correct) { setMsChainEnded(true); return; }
    setMsLoadingChain(true);
    const appended = await fetchMsFollowUp(msRootQ!.question_id, 0);
    setMsLoadingChain(false);
    setMsChainEnded(!appended);
  };

  const handleMsFollowUpResult = async (index: number, attempt: AttemptResult) => {
    const fu = msFollowUps[index];
    if (!fu) return;
    setMsFollowUps((prev) =>
      prev.map((item, i) => (i === index ? { ...item, result: attempt } : item))
    );
    if (!attempt.correct) { setMsChainEnded(true); return; }
    setMsLoadingChain(true);
    const appended = await fetchMsFollowUp(fu.question.question_id, msFollowUps.length);
    setMsLoadingChain(false);
    setMsChainEnded(!appended);
  };

  const handleMsRootSubmit = async (selectedIdx: number) => {
    if (!msRootQ) return;
    const res = await submitAttempt(msRootQ.question_id, selectedIdx);
    await handleMsRootResult(res.data);
  };

  const handleMsFollowUpSubmit = async (index: number, selectedIdx: number) => {
    const fu = msFollowUps[index];
    if (!fu) return;
    const res = await submitAttempt(fu.question.question_id, selectedIdx);
    await handleMsFollowUpResult(index, res.data);
  };

  const handleMsNext = () => {
    const nextUsed = new Set(msUsed);
    if (msRootQ) nextUsed.add(msRootQ.question_id);
    setMsUsed(nextUsed);
    setMsChainsAnswered((n) => n + 1);
    startNextChain(msPool, nextUsed);
  };

  // ── Standard player handlers ───────────────────────────────────────────────

  const handleOptionClick = async (optionIdx: number) => {
    if (!currentQuestion || submittingAttempt || attemptResult) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSelectedOption(optionIdx);
    setSubmittingAttempt(true);
    try {
      const res = await submitAttempt(currentQuestion.question_id, optionIdx);
      setAttemptResult(res.data);
      setSessionAnswered((n) => n + 1);
      if (res.data.correct) setSessionCorrect((n) => n + 1);
      setError(null);
    } catch {
      setError("Failed to submit attempt");
    } finally {
      setSubmittingAttempt(false);
    }
  };

  const getOptionClassName = (optionIdx: number) => {
    const base = "rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed";
    if (!attemptResult)
      return `${base} border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50`;
    if (optionIdx === attemptResult.correct_option)
      return `${base} border-emerald-500 bg-emerald-50 text-emerald-900`;
    if (optionIdx === selectedOption && !attemptResult.correct)
      return `${base} border-rose-500 bg-rose-50 text-rose-900`;
    return `${base} border-slate-200 bg-slate-50 text-slate-500`;
  };

  const handleStart = (s: SessionSettings) => {
    setSettings(s);
    setPhase("playing");
    setQuestionPool([]);
    setPlayerIndex(0);
    setSessionCorrect(0);
    setSessionAnswered(0);
    setMsRootQ(null);
    setMsFollowUps([]);
    setMsUsed(new Set());
    setAllFilteredByExclude(false);
    setError(null);
  };

  const handleChangeSettings = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setPhase("settings");
  };

  const sessionComplete =
    settings.sessionLength > 0 &&
    settings.mode !== "multi-step" &&
    !loadingPool &&
    questionPool.length > 0 &&
    playerIndex >= questionPool.length - 1 &&
    Boolean(attemptResult);

  const hasStandardPlayer =
    phase === "playing" &&
    (settings.mode === "random" ||
      (settings.mode === "topic" && settings.topics.length > 0));

  // Timer color
  const timerWarning = settings.timerSeconds > 0 && timeLeft <= 10 && timeLeft > 0;
  const timerPct = settings.timerSeconds > 0 ? (timeLeft / settings.timerSeconds) * 100 : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === "settings") {
    return (
      <SettingsScreen
        topics={topics}
        loadingTopics={loadingTopics}
        initialSettings={settings}
        onStart={handleStart}
      />
    );
  }

  // Playing phase
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      {/* Session header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Question Bank</h1>
          <p className="text-sm text-slate-500">
            {settings.mode === "topic" && settings.topics.length > 0
              ? settings.topics.length === 1
                ? settings.topics[0]
                : `${settings.topics.length} topics`
              : ""}
            {settings.mode === "random" ? "Random mix" : ""}
            {settings.mode === "multi-step" ? "Multi-step chains" : ""}
            {settings.difficulty ? ` · ${settings.difficulty}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Score */}
          {sessionAnswered > 0 && settings.mode !== "multi-step" && (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              Score: {sessionCorrect}/{sessionAnswered}
            </span>
          )}
          {/* Session length progress */}
          {settings.sessionLength > 0 && settings.mode !== "multi-step" && !loadingPool && questionPool.length > 0 && (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              Q {playerIndex + 1} / {questionPool.length}
            </span>
          )}

          <button
            onClick={handleChangeSettings}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            ← Settings
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Standard player */}
      {hasStandardPlayer && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {loadingPool ? (
            <p className="text-slate-600">Loading questions…</p>
          ) : !currentQuestion ? (
            <p className="text-slate-600">
              {allFilteredByExclude
                ? "You've answered all questions in this topic correctly. Disable 'Skip already correct' to review them."
                : "No questions match the selected filters."}
            </p>
          ) : (
            <div className="space-y-4">
              {/* Timer bar */}
              {settings.timerSeconds > 0 && !attemptResult && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className={timerWarning ? "text-rose-600" : "text-slate-500"}>
                      Time left
                    </span>
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

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {currentQuestion.topic}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${DIFFICULTY_COLORS[currentQuestion.difficulty]}`}>
                  {currentQuestion.difficulty}
                </span>
              </div>

              <p className="text-lg font-medium leading-7 text-slate-900">{currentQuestion.stem}</p>

              <div className="grid gap-2 sm:grid-cols-2">
                {currentQuestion.options.map((opt, idx) => (
                  <button
                    key={`${currentQuestion.question_id}-${idx}`}
                    type="button"
                    onClick={() => handleOptionClick(idx)}
                    disabled={submittingAttempt || Boolean(attemptResult)}
                    className={getOptionClassName(idx)}
                  >
                    <span className="mr-2 font-semibold text-slate-500">{String.fromCharCode(65 + idx)}.</span>
                    {opt}
                  </button>
                ))}
              </div>

              {attemptResult && (
                <div className={`rounded-lg border-l-4 px-4 py-3 ${
                  attemptResult.correct
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                    : "border-rose-600 bg-rose-50 text-rose-900"
                }`}>
                  <p className="mb-1 text-sm font-semibold">
                    {attemptResult.correct ? "Correct" : "Incorrect"}
                  </p>
                  <p className="text-sm leading-6">{attemptResult.explanation}</p>
                </div>
              )}

              {/* Session complete */}
              {sessionComplete ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="mb-1 text-sm font-semibold text-slate-700">Session complete!</p>
                  <p className="mb-3 text-xs text-slate-500">
                    You answered {sessionCorrect} of {sessionAnswered} correctly.
                  </p>
                  <button
                    onClick={handleChangeSettings}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Start a new session
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <button
                    onClick={() => setPlayerIndex((prev) => Math.max(0, prev - 1))}
                    disabled={playerIndex === 0}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-slate-500">
                    {attemptResult
                      ? "Review feedback, then continue"
                      : submittingAttempt
                        ? "Submitting…"
                        : "Choose an answer to reveal feedback"}
                  </span>
                  <button
                    onClick={() => setPlayerIndex((prev) => Math.min(questionPool.length - 1, prev + 1))}
                    disabled={playerIndex >= questionPool.length - 1}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Multi-step player */}
      {settings.mode === "multi-step" && (
        <div className="space-y-4">
          {msLoadingChain && !msRootQ && <p className="text-slate-600">Loading question…</p>}

          {!msLoadingChain && !msRootQ && msChainsAnswered > 0 && settings.sessionLength > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="mb-1 text-sm font-semibold text-slate-700">Session complete!</p>
              <p className="mb-3 text-xs text-slate-500">
                {msChainsAnswered} chain{msChainsAnswered !== 1 ? "s" : ""} completed.
              </p>
              <button
                onClick={handleChangeSettings}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Start a new session
              </button>
            </div>
          )}

          {!msLoadingChain && !msRootQ && msChainsAnswered === 0 && (
            <p className="text-slate-600">No multi-step questions available.</p>
          )}

          {msRootQ && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <ChainCard
                question={msRootQ}
                result={msRootResult}
                onSubmit={handleMsRootSubmit}
                timerSeconds={settings.timerSeconds}
                onTimeUp={handleMsNext}
              />
            </div>
          )}

          {msFollowUps.map((fu, index) => (
            <div key={fu.question.question_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Follow-up {index + 1}
              </p>
              <ChainCard
                question={fu.question}
                result={fu.result}
                onSubmit={(idx) => handleMsFollowUpSubmit(index, idx)}
                timerSeconds={settings.timerSeconds}
                onTimeUp={handleMsNext}
              />
            </div>
          ))}

          {msLoadingChain && msRootQ && <p className="text-sm text-slate-500">Loading follow-up…</p>}

          {msRootResult && msChainEnded && (
            <button
              onClick={handleMsNext}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Next Chain →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
