import { useEffect, useMemo, useState } from "react";
import { getQuestionTopics } from "../api/questionsApi";
import {
  getActiveStageBSession,
  startStageBSession,
  type Difficulty,
  type StageBSession,
  type StageBStartPayload,
} from "../api/stageBApi";

type Phase = "settings" | "running" | "review";

interface StageBSettings {
  topics: string[];
  case_count: number;
  duration_minutes: number;
  difficulty: Difficulty;
  voice: string;
}

const DEFAULT_SETTINGS: StageBSettings = {
  topics: [],
  case_count: 2,
  duration_minutes: 45,
  difficulty: "medium",
  voice: "alloy",
};

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
const CASE_COUNTS = [1, 2, 3] as const;
const DURATIONS = [30, 45, 60, 90] as const;
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export default function StageBExamPage() {
  const [phase, setPhase] = useState<Phase>("settings");
  const [settings, setSettings] = useState<StageBSettings>(DEFAULT_SETTINGS);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicSearch, setTopicSearch] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [activeSession, setActiveSession] = useState<StageBSession | null>(null);
  const [session, setSession] = useState<StageBSession | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingSettings(true);
      try {
        const [topicsRes, activeRes] = await Promise.allSettled([
          getQuestionTopics(),
          getActiveStageBSession(),
        ]);
        if (topicsRes.status === "fulfilled") setTopics(topicsRes.value.data);
        if (activeRes.status === "fulfilled") setActiveSession(activeRes.value.data);
      } catch {
        // ignore
      } finally {
        setLoadingSettings(false);
      }
    })();
  }, []);

  const query = normalizeSearch(topicSearch);

  const visibleTopics = useMemo(() => {
    const sorted = topics.slice().sort((a, b) => a.localeCompare(b));
    if (!query) return sorted;
    const terms = query.split(" ").filter(Boolean);
    return sorted.filter((t) => {
      const text = normalizeSearch(t);
      return terms.every((term) => text.includes(term));
    });
  }, [topics, query]);

  const toggleTopic = (topic: string) => {
    setSettings((prev) => {
      const set = new Set(prev.topics);
      if (set.has(topic)) set.delete(topic);
      else set.add(topic);
      return { ...prev, topics: Array.from(set) };
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const payload: StageBStartPayload = {
        topics: settings.topics.length > 0 ? settings.topics : undefined,
        case_count: settings.case_count,
        duration_minutes: settings.duration_minutes,
        difficulty: settings.difficulty,
        voice: settings.voice,
      };
      const res = await startStageBSession(payload);
      setSession(res.data);
      setPhase("running");
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "detail" in err.response.data &&
        typeof err.response.data.detail === "string"
          ? err.response.data.detail
          : "Failed to start session. Please try again.";
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleResume = () => {
    if (!activeSession) return;
    setSession(activeSession);
    setPhase("running");
  };

  if (phase === "running") {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Stage B — Oral Exam</h1>
        <p className="text-gray-500">
          Session <span className="font-mono text-sm">{session?.session_id}</span> started.
          Running phase coming in a future update.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Stage B — Oral Exam Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure a case-based oral exam session.
        </p>
      </div>

      {activeSession && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-800">Active session found</p>
            <p className="text-sm text-amber-700">
              {activeSession.case_count} case{activeSession.case_count !== 1 ? "s" : ""} ·{" "}
              {activeSession.difficulty} · {activeSession.duration_minutes} min ·{" "}
              voice: {activeSession.voice}
            </p>
          </div>
          <button
            onClick={handleResume}
            className="shrink-0 px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            Resume Active Session
          </button>
        </div>
      )}

      {loadingSettings ? (
        <p className="text-gray-400 text-sm">Loading topics…</p>
      ) : (
        <div className="space-y-6">
          {/* Topics */}
          <section>
            <h2 className="text-base font-semibold mb-2">Topics</h2>
            <p className="text-xs text-gray-500 mb-2">
              Leave empty to include all topics.
            </p>
            <input
              type="text"
              placeholder="Search topics…"
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              className="w-full border rounded-md px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
              {visibleTopics.length === 0 ? (
                <p className="text-xs text-gray-400 p-3">No topics match.</p>
              ) : (
                visibleTopics.map((topic) => (
                  <label
                    key={topic}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={settings.topics.includes(topic)}
                      onChange={() => toggleTopic(topic)}
                      className="rounded"
                    />
                    {topic}
                  </label>
                ))
              )}
            </div>
            {settings.topics.length > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                {settings.topics.length} topic{settings.topics.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </section>

          {/* Case Count */}
          <section>
            <h2 className="text-base font-semibold mb-2">Number of Cases</h2>
            <div className="flex gap-3">
              {CASE_COUNTS.map((count) => (
                <label
                  key={count}
                  className={`flex items-center justify-center w-14 h-10 rounded-md border cursor-pointer text-sm font-medium transition-colors ${
                    settings.case_count === count
                      ? "bg-blue-600 text-white border-blue-600"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="case_count"
                    value={count}
                    checked={settings.case_count === count}
                    onChange={() => setSettings((prev) => ({ ...prev, case_count: count }))}
                    className="sr-only"
                  />
                  {count}
                </label>
              ))}
            </div>
          </section>

          {/* Duration */}
          <section>
            <h2 className="text-base font-semibold mb-2">Duration</h2>
            <div className="flex gap-3 flex-wrap">
              {DURATIONS.map((min) => (
                <label
                  key={min}
                  className={`flex items-center justify-center w-20 h-10 rounded-md border cursor-pointer text-sm font-medium transition-colors ${
                    settings.duration_minutes === min
                      ? "bg-blue-600 text-white border-blue-600"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="duration_minutes"
                    value={min}
                    checked={settings.duration_minutes === min}
                    onChange={() => setSettings((prev) => ({ ...prev, duration_minutes: min }))}
                    className="sr-only"
                  />
                  {min} min
                </label>
              ))}
            </div>
          </section>

          {/* Difficulty */}
          <section>
            <h2 className="text-base font-semibold mb-2">Difficulty</h2>
            <div className="flex gap-3">
              {DIFFICULTIES.map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex items-center justify-center px-4 h-10 rounded-md border cursor-pointer text-sm font-medium transition-colors ${
                    settings.difficulty === value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="difficulty"
                    value={value}
                    checked={settings.difficulty === value}
                    onChange={() =>
                      setSettings((prev) => ({ ...prev, difficulty: value }))
                    }
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          {/* Voice */}
          <section>
            <h2 className="text-base font-semibold mb-2">Examiner Voice</h2>
            <select
              value={settings.voice}
              onChange={(e) => setSettings((prev) => ({ ...prev, voice: e.target.value }))}
              className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {VOICES.map((v) => (
                <option key={v} value={v}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </option>
              ))}
            </select>
          </section>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? "Generating cases…" : "Generate Exam"}
          </button>
        </div>
      )}
    </div>
  );
}
