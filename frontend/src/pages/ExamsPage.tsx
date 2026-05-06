import { useEffect, useMemo, useRef, useState } from "react";
import { getChapters, type Chapter } from "../api/chaptersApi";
import {
  createStageAPreset,
  deleteStageAPreset,
  finalizeStageAExam,
  getActiveStageAExam,
  getQuestionTopics,
  getStageAPresets,
  previewStageAExam,
  startStageAExam,
  submitStageAAnswer,
  type StageAExamItem,
  type StageAExamSession,
  type StageAPreset,
  type StageAReport,
  type StageAStartPayload,
} from "../api/questionsApi";
import { useExamGuard } from "../context/ExamGuardContext";

type Phase = "settings" | "running" | "review";
type ExamBuildMode = "topic" | "chapter";

interface StageASettings {
  topics: string[];
  topic_weights: Record<string, number>;
  part_numbers: number[];
  chapter_ids: string[];
  exclude_answered_correctly: boolean;
}

const DEFAULT_SETTINGS: StageASettings = {
  topics: [],
  topic_weights: {},
  part_numbers: [],
  chapter_ids: [],
  exclude_answered_correctly: false,
};

const MODE_COPY: Record<ExamBuildMode, { label: string; description: string }> = {
  topic: {
    label: "By Topic",
    description: "Use question-bank topics. Leave empty for all topics.",
  },
  chapter: {
    label: "By Chapter",
    description: "Use Harrison parts and chapters. Parts only affect this mode.",
  },
};

function formatSeconds(total: number): string {
  const clamped = Math.max(0, total);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function toPayload(settings: StageASettings): StageAStartPayload {
  const selected = new Set(settings.topics);
  const topic_weights: Record<string, number> = {};
  Object.entries(settings.topic_weights).forEach(([topic, weight]) => {
    if (selected.has(topic) && Number.isFinite(weight) && weight > 0) {
      topic_weights[topic] = Math.max(1, Math.min(5, Math.floor(weight)));
    }
  });
  return {
    topics: settings.topics,
    topic_weights,
    part_numbers: settings.part_numbers,
    chapter_ids: settings.chapter_ids,
    exclude_answered_correctly: settings.exclude_answered_correctly,
  };
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function chapterSearchText(chapter: Chapter): string {
  const chapterNumber = chapter.chapter_number;
  return normalizeSearch(
    [
      chapter.title,
      chapter.specialty ?? "",
      chapter.part_title ?? "",
      typeof chapter.part_number === "number" ? `part ${chapter.part_number}` : "",
      typeof chapterNumber === "number" ? `${chapterNumber}` : "",
      typeof chapterNumber === "number" ? `ch ${chapterNumber}` : "",
      typeof chapterNumber === "number" ? `chapter ${chapterNumber}` : "",
      typeof chapterNumber === "number" ? `ch ${chapterNumber} ${chapter.title}` : "",
    ].join(" ")
  );
}

function getApiDetail(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const response = "response" in error ? error.response : null;
  if (!response || typeof response !== "object") return null;
  const data = "data" in response ? response.data : null;
  if (!data || typeof data !== "object") return null;
  const detail = "detail" in data ? data.detail : null;
  return typeof detail === "string" ? detail : null;
}

export default function ExamsPage() {
  const [phase, setPhase] = useState<Phase>("settings");
  const [buildMode, setBuildMode] = useState<ExamBuildMode>("topic");
  const [settings, setSettings] = useState<StageASettings>(DEFAULT_SETTINGS);
  const [preview, setPreview] = useState<{
    eligible_count: number;
    requested_question_count: number;
    actual_question_count: number;
    shortened_due_to_pool: boolean;
  } | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [presets, setPresets] = useState<StageAPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [search, setSearch] = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [session, setSession] = useState<StageAExamSession | null>(null);
  const [report, setReport] = useState<StageAReport | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAnswerMap, setShowAnswerMap] = useState<Record<number, boolean>>({});
  const { setExamRunning, examsReloadToken } = useExamGuard();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const partChoices = useMemo(() => {
    const partMap = new Map<number, string>();
    chapters.forEach((ch) => {
      if (typeof ch.part_number === "number") partMap.set(ch.part_number, ch.part_title || `Part ${ch.part_number}`);
    });
    return Array.from(partMap.entries())
      .map(([part_number, part_title]) => ({ part_number, part_title }))
      .sort((a, b) => a.part_number - b.part_number);
  }, [chapters]);

  const query = normalizeSearch(search);

  const visibleTopics = useMemo(() => {
    const sorted = topics.slice().sort((a, b) => a.localeCompare(b));
    if (!query) return sorted;
    const terms = query.split(" ").filter(Boolean);
    return sorted.filter((topic) => {
      const text = normalizeSearch(topic);
      return terms.every((term) => text.includes(term));
    });
  }, [topics, query]);

  const filteredChapters = useMemo(() => {
    const selectedParts = new Set(settings.part_numbers);
    const terms = query.split(" ").filter(Boolean);
    return chapters.filter((ch) => {
      const partOk = selectedParts.size === 0 || (typeof ch.part_number === "number" && selectedParts.has(ch.part_number));
      const searchOk = terms.length === 0 || terms.every((term) => chapterSearchText(ch).includes(term));
      return partOk && searchOk;
    });
  }, [chapters, query, settings.part_numbers]);

  const answeredCount = useMemo(() => session?.items.filter((item) => item.selected_option !== null).length ?? 0, [session]);
  const correctCount = useMemo(() => session?.items.filter((item) => item.is_correct === true).length ?? 0, [session]);
  const currentItem: StageAExamItem | null = session?.items[currentIndex] ?? null;

  const refreshSettingsData = async () => {
    setLoadingSettings(true);
    try {
      const [topicsRes, chaptersRes, presetsRes] = await Promise.all([getQuestionTopics(), getChapters(), getStageAPresets()]);
      setTopics(topicsRes.data);
      setChapters(chaptersRes.data);
      setPresets(presetsRes.data);
      setError(null);
    } catch {
      setError("Failed to load exam settings.");
    } finally {
      setLoadingSettings(false);
    }
  };

  const runPreview = async (nextSettings: StageASettings) => {
    try {
      const res = await previewStageAExam(toPayload(nextSettings));
      setPreview(res.data);
      setError(null);
    } catch {
      setPreview(null);
    }
  };

  useEffect(() => {
    refreshSettingsData();
  }, []);

  useEffect(() => {
    if (phase !== "settings") return;
    runPreview(settings);
  }, [phase, settings]);

  useEffect(() => {
    setExamRunning(phase === "running");
    return () => setExamRunning(false);
  }, [phase, setExamRunning]);

  useEffect(() => {
    if (!examsReloadToken) return;
    setPhase("settings");
    setSession(null);
    setReport(null);
    setCurrentIndex(0);
    setSelected(null);
    setRationale("");
    setShowAnswerMap({});
    setRemainingSeconds(0);
    setError(null);
    setSearch("");
    setBuildMode("topic");
    refreshSettingsData();
  }, [examsReloadToken]);

  useEffect(() => {
    if (!currentItem) {
      setSelected(null);
      setRationale("");
      return;
    }
    setSelected(currentItem.selected_option);
    setRationale("");
  }, [currentItem?.index]);

  useEffect(() => {
    if (phase !== "running" || !session || report) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          handleFinalize();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [phase, report?.session_id, session?.session_id]);

  const handleStart = async () => {
    try {
      const started = await startStageAExam(toPayload(settings));
      setSession(started.data);
      setPhase("running");
      setReport(null);
      setCurrentIndex(0);
      setShowAnswerMap({});
      setRemainingSeconds(Math.max(0, Math.floor((new Date(started.data.expires_at).getTime() - Date.now()) / 1000)));
      setError(null);
    } catch (e: unknown) {
      setError(getApiDetail(e) || "Failed to start Stage A exam.");
    }
  };

  const handleResumeActive = async () => {
    try {
      const active = await getActiveStageAExam();
      setSession(active.data);
      setPhase("running");
      setReport(null);
      setCurrentIndex(0);
      setShowAnswerMap({});
      setRemainingSeconds(Math.max(0, Math.floor((new Date(active.data.expires_at).getTime() - Date.now()) / 1000)));
      setError(null);
    } catch {
      setError("No active Stage A session found.");
    }
  };

  const handleFinalize = async () => {
    if (!session) return;
    try {
      const res = await finalizeStageAExam(session.session_id);
      setReport(res.data);
      setPhase("review");
      setError(null);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    } catch {
      setError("Failed to finalize exam.");
    }
  };

  const handleSubmitCurrent = async () => {
    if (!session || !currentItem || selected === null || currentItem.selected_option !== null) return;
    setSubmitting(true);
    try {
      const res = await submitStageAAnswer(session.session_id, {
        index: currentItem.index,
        selected_option: selected,
        rationale_text: rationale.trim() || undefined,
      });
      setSession((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) => (item.index === currentItem.index ? { ...item, selected_option: selected, is_correct: res.data.correct } : item)),
            }
          : prev
      );
      if (currentIndex < session.items.length - 1) setCurrentIndex((prev) => Math.min(session.items.length - 1, prev + 1));
      setError(null);
    } catch {
      setError("Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const savePreset = async () => {
    if (!newPresetName.trim()) return;
    try {
      await createStageAPreset({ name: newPresetName.trim(), ...toPayload(settings) });
      setNewPresetName("");
      const res = await getStageAPresets();
      setPresets(res.data);
    } catch {
      setError("Failed to save preset.");
    }
  };

  const applyPreset = (preset: StageAPreset) => {
    const nextMode: ExamBuildMode = preset.chapter_ids.length > 0 || preset.part_numbers.length > 0 ? "chapter" : "topic";
    setBuildMode(nextMode);
    setSettings({
      topics: nextMode === "topic" ? preset.topics : [],
      topic_weights: nextMode === "topic" ? preset.topic_weights ?? {} : {},
      part_numbers: nextMode === "chapter" ? preset.part_numbers : [],
      chapter_ids: nextMode === "chapter" ? preset.chapter_ids : [],
      exclude_answered_correctly: preset.exclude_answered_correctly,
    });
  };

  const removePreset = async (presetId: string) => {
    try {
      await deleteStageAPreset(presetId);
      setPresets((prev) => prev.filter((p) => p.preset_id !== presetId));
    } catch {
      setError("Failed to delete preset.");
    }
  };

  const toggleValue = (arr: string[], value: string) => (arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  const toggleNumber = (arr: number[], value: number) => (arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);

  const handleBuildModeChange = (mode: ExamBuildMode) => {
    setBuildMode(mode);
    setSearch("");
    setSettings((prev) =>
      mode === "topic"
        ? { ...prev, part_numbers: [], chapter_ids: [] }
        : { ...prev, topics: [], topic_weights: {} }
    );
  };

  const toggleTopic = (topic: string) => {
    setSettings((prev) => {
      const topicsNext = toggleValue(prev.topics, topic);
      const weightsNext = { ...prev.topic_weights };
      if (topicsNext.includes(topic)) weightsNext[topic] = weightsNext[topic] ?? 1;
      else delete weightsNext[topic];
      return { ...prev, topics: topicsNext, topic_weights: weightsNext };
    });
  };

  const selectTopics = (items: string[]) => {
    setSettings((prev) => {
      const topicsNext = Array.from(new Set([...prev.topics, ...items]));
      const weightsNext = { ...prev.topic_weights };
      items.forEach((t) => {
        weightsNext[t] = weightsNext[t] ?? 1;
      });
      return { ...prev, topics: topicsNext, topic_weights: weightsNext };
    });
  };

  const clearTopics = (items: string[]) => {
    setSettings((prev) => {
      const remove = new Set(items);
      const topicsNext = prev.topics.filter((t) => !remove.has(t));
      const weightsNext = { ...prev.topic_weights };
      items.forEach((t) => delete weightsNext[t]);
      return { ...prev, topics: topicsNext, topic_weights: weightsNext };
    });
  };

  const setTopicWeight = (topic: string, weight: number) => {
    setSettings((prev) => ({
      ...prev,
      topic_weights: { ...prev.topic_weights, [topic]: Math.max(1, Math.min(5, Math.floor(weight))) },
    }));
  };

  if (loadingSettings && phase === "settings") return <p className="p-6 text-slate-500">Loading exams...</p>;

  if (phase === "settings") {
    const selectedTopicSet = new Set(settings.topics);
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Exams</h1>
            <p className="text-sm text-slate-500">Build a Stage A scope by topic or by chapter.</p>
          </div>
          <button onClick={() => setMobileFilterOpen(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 md:hidden">Filters</button>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SettingRow label="Build Mode">
            <div className="grid gap-2 sm:grid-cols-2">
              {(["topic", "chapter"] as ExamBuildMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleBuildModeChange(mode)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    buildMode === mode
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-white"
                  }`}
                >
                  <span className="block text-sm font-bold">{MODE_COPY[mode].label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{MODE_COPY[mode].description}</span>
                </button>
              ))}
            </div>
          </SettingRow>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={buildMode === "topic" ? "Search topics" : "Search chapters, e.g. Good Health"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {buildMode === "topic" && (
            <SettingRow label={`Topics (${settings.topics.length} selected)`}>
              <div className="mb-2 flex flex-wrap gap-2">
                <button onClick={() => selectTopics(visibleTopics)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Select Visible</button>
                <button onClick={() => clearTopics(visibleTopics)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Clear Visible</button>
                <button onClick={() => clearTopics(settings.topics)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Clear All Selected</button>
                {settings.topics.length === 0 && <span className="self-center text-xs text-slate-400">all topics</span>}
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
                {visibleTopics.map((topic) => {
                  const isSelected = selectedTopicSet.has(topic);
                  return (
                    <div key={topic} className="flex items-center justify-between gap-3">
                      <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTopic(topic)}
                          className="mt-0.5"
                        />
                        <span>{topic}</span>
                      </label>
                      {isSelected && (
                        <select
                          value={settings.topic_weights[topic] ?? 1}
                          onChange={(e) => setTopicWeight(topic, Number(e.target.value))}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>{w}x</option>)}
                        </select>
                      )}
                    </div>
                  );
                })}
                {visibleTopics.length === 0 && <p className="text-sm text-slate-500">No topics match this search.</p>}
              </div>
            </SettingRow>
          )}
          {buildMode === "chapter" && (
            <>
              <SettingRow label="Parts">
                <div className="flex flex-wrap gap-2">
                  {partChoices.map((part) => (
                    <button key={part.part_number} onClick={() => setSettings((prev) => ({ ...prev, part_numbers: toggleNumber(prev.part_numbers, part.part_number) }))} className={`rounded-full px-3 py-1 text-xs font-semibold ${settings.part_numbers.includes(part.part_number) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{part.part_number} - {part.part_title}</button>
                  ))}
                  {settings.part_numbers.length === 0 && <span className="self-center text-xs text-slate-400">all parts</span>}
                </div>
              </SettingRow>
              <SettingRow label={`Chapters (${filteredChapters.length})`}>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
                  {filteredChapters.map((ch) => (
                    <label key={ch.id} className="flex items-start gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={settings.chapter_ids.includes(ch.id)} onChange={() => setSettings((prev) => ({ ...prev, chapter_ids: toggleValue(prev.chapter_ids, ch.id) }))} className="mt-0.5" />
                      <span>{ch.chapter_number ? `Ch ${ch.chapter_number}: ` : ""}{ch.title}</span>
                    </label>
                  ))}
                  {filteredChapters.length === 0 && <p className="text-sm text-slate-500">No chapters match this part and search filter.</p>}
                </div>
              </SettingRow>
            </>
          )}
          <SettingRow label="Reuse Control">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.exclude_answered_correctly} onChange={(e) => setSettings((prev) => ({ ...prev, exclude_answered_correctly: e.target.checked }))} />
              <span className="text-sm text-slate-700">Exclude already answered-correct questions</span>
            </label>
          </SettingRow>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p>Target: <span className="font-semibold">150 questions</span> | Timer: <span className="font-semibold">4 hours</span></p>
            {preview && <p className="mt-1">Eligible pool: <span className="font-semibold">{preview.eligible_count}</span>.{preview.shortened_due_to_pool && <span className="ml-1 text-amber-700">Exam will auto-shorten to {preview.actual_question_count} questions.</span>}</p>}
          </div>
          <SettingRow label="Saved Presets">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} placeholder="Preset name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <button onClick={savePreset} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Save</button>
              </div>
              <div className="space-y-1">
                {presets.map((preset) => (
                  <div key={preset.preset_id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <button onClick={() => applyPreset(preset)} className="text-left text-sm text-blue-700 hover:underline">{preset.name}</button>
                    <button onClick={() => removePreset(preset.preset_id)} className="text-xs text-rose-600 hover:underline">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          </SettingRow>
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button
              onClick={handleResumeActive}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Resume Active Session
            </button>
            <button
              onClick={handleStart}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Start Stage A Exam
            </button>
          </div>
        </section>
        {mobileFilterOpen && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-black/40" onClick={() => setMobileFilterOpen(false)} aria-hidden="true" /><div className="absolute inset-x-0 bottom-0 top-8 overflow-y-auto rounded-t-2xl bg-white p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Exam Filters</h2><button onClick={() => setMobileFilterOpen(false)} className="text-sm font-semibold text-slate-600">Close</button></div><p className="text-sm text-slate-600">Use the full settings flow on this page; mobile drawer support is partial.</p></div></div>}
      </div>
    );
  }

  if (phase === "review" && report) {
    return <div className="mx-auto max-w-5xl space-y-6 px-6 py-6"><h1 className="text-3xl font-bold text-slate-900">Stage A Mock Report</h1><div className="grid gap-4 sm:grid-cols-4"><Stat label="Score" value={`${report.percent_correct.toFixed(2)}%`} /><Stat label="Correct" value={`${report.correct_count}/${report.question_count}`} /><Stat label="Answered" value={`${report.answered_count}/${report.question_count}`} /><Stat label="Elapsed" value={formatSeconds(report.elapsed_seconds)} /></div>{report.shortened_due_to_pool && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">This exam was shortened due to scope pool limits: {report.actual_question_count}/{report.requested_question_count}.</p>}<section className="space-y-4">{report.review_items.map((item) => { const itemAnswered = item.selected_option !== null; const reveal = Boolean(showAnswerMap[item.index]); const show = itemAnswered || reveal; return <article key={`${item.question_id}-${item.index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review Question {item.index} / {report.question_count}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.topic}</span></div><p className="mb-4 text-lg font-medium leading-7 text-slate-900">{item.stem}</p><div className="grid gap-2 sm:grid-cols-2">{item.options.map((opt, idx) => { const correctIdx = show ? item.correct_option : -1; const selectedIdx = item.selected_option; const isCorrect = show && idx === correctIdx; const isWrong = show && selectedIdx !== null && idx === selectedIdx && idx !== correctIdx; const className = show ? (isCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-900" : isWrong ? "border-rose-500 bg-rose-50 text-rose-900" : "border-slate-200 bg-slate-50 text-slate-500") : "border-slate-200 bg-slate-50 text-slate-700"; return <div key={`${item.question_id}-${idx}`} className={`rounded-lg border px-3 py-2 text-left text-sm ${className}`}><span className="mr-2 font-semibold text-slate-500">{String.fromCharCode(65 + idx)}.</span>{opt}</div>; })}</div>{!itemAnswered && !reveal && <button onClick={() => setShowAnswerMap((prev) => ({ ...prev, [item.index]: true }))} className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Show Answer</button>}{show && <div className={`mt-4 rounded-lg border-l-4 px-4 py-3 ${item.is_correct ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-rose-600 bg-rose-50 text-rose-900"}`}><p className="mb-1 text-sm font-semibold">{item.is_correct ? "Correct" : "Incorrect"}</p><p className="text-sm leading-6">{item.explanation}</p></div>}</article>; })}</section><div className="flex justify-end gap-2"><button onClick={() => { setPhase("settings"); setReport(null); setSession(null); setCurrentIndex(0); setShowAnswerMap({}); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Build Another Exam</button></div></div>;
  }

  return <div className="mx-auto max-w-5xl space-y-6 px-6 py-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold text-slate-900">Stage A Exam</h1><p className="text-sm text-slate-500">{session?.actual_question_count ?? session?.question_count ?? 0} questions / 4 hours</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Time Left: {formatSeconds(remainingSeconds)}</span><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{answeredCount}/{session?.question_count ?? 0} answered</span><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">Score: {correctCount}/{answeredCount}</span><button onClick={() => setPhase("settings")} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back to Settings</button></div></div>{error && <p className="text-sm text-rose-600">{error}</p>}{!session || !currentItem ? <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-slate-600">No active Stage A exam session.</p><button onClick={() => setPhase("settings")} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Back to Settings</button></div> : <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{session.shortened_due_to_pool && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Shortened exam due to scope limits: {session.actual_question_count}/{session.requested_question_count}.</p>}<div className="mb-4 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {currentItem.index} / {session.question_count}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{currentItem.topic}</span></div><p className="mb-4 text-lg font-medium leading-7 text-slate-900">{currentItem.stem}</p><div className="grid gap-2 sm:grid-cols-2">{currentItem.options.map((opt, idx) => { const isAnswered = currentItem.selected_option !== null; const className = !isAnswered ? selected === idx ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50" : "border-slate-200 bg-slate-50 text-slate-500"; return <button key={`${currentItem.question_id}-${idx}`} type="button" disabled={isAnswered || submitting} onClick={() => setSelected(idx)} className={`rounded-lg border px-3 py-2 text-left text-sm transition ${className}`}><span className="mr-2 font-semibold text-slate-500">{String.fromCharCode(65 + idx)}.</span>{opt}</button>; })}</div>{currentItem.selected_option === null && <div className="mt-4"><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Optional rationale</label><textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Briefly explain your reasoning..." /></div>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><button onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))} disabled={currentIndex === 0} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50">Previous</button><div className="flex items-center gap-2"><button onClick={handleSubmitCurrent} disabled={selected === null || currentItem.selected_option !== null || submitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Submitting..." : "Submit"}</button><button onClick={handleFinalize} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Finalize Exam</button></div><button onClick={() => setCurrentIndex((prev) => Math.min(session.items.length - 1, prev + 1))} disabled={currentIndex >= session.items.length - 1} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50">Next</button></div></section>}</div>;
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">{label}</p>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
