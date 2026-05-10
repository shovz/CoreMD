import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AudioPlayer } from "../components/AudioPlayer";
import { AudioRecorder } from "../components/AudioRecorder";
import { getQuestionTopics } from "../api/questionsApi";
import {
  advanceStage as apiAdvanceStage,
  chatWithExaminer,
  deleteStageBSession,
  fetchStageBTts,
  finalizeStageBSession,
  getActiveStageBSession,
  getStageBReport,
  listStageBSessions,
  retakeStageBSession,
  startStageBSession,
  submitStageBAnswer,
  transcribeStageBRecording,
  type Difficulty,
  type StageBAnswerResult,
  type StageBCaseReport,
  type StageBChatMessage,
  type StageBQuestion,
  type StageBQuestionFull,
  type StageBReport,
  type StageBSession,
  type StageBSessionSummary,
  type StageBStage,
  type StageBStageReport,
  type StageBStartPayload,
} from "../api/stageBApi";
import { useExamGuard } from "../context/ExamGuardContext";

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

// ---- Running Phase ----------------------------------------------------------

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type QuestionAnswerState = {
  mode: "text" | "audio";
  textDraft: string;
  transcriptDraft: string;
  transcribing: boolean;
  submitting: boolean;
  result: StageBAnswerResult | null;
  chatHistory: StageBChatMessage[];
  chatOpen: boolean;
  chatInput: string;
  chatLoading: boolean;
};

function defaultQState(): QuestionAnswerState {
  return {
    mode: "text", textDraft: "", transcriptDraft: "", transcribing: false,
    submitting: false, result: null,
    chatHistory: [], chatOpen: false, chatInput: "", chatLoading: false,
  };
}

function isQuestionAnswered(q: StageBQuestion, qStates: Record<string, QuestionAnswerState>): boolean {
  return q.answered_at !== null || (qStates[q.question_id]?.result ?? null) !== null;
}

function computeVisibleCount(questions: StageBQuestion[], qStates: Record<string, QuestionAnswerState>): number {
  if (questions.length === 0) return 0;
  let count = 1;
  for (let i = 0; i < questions.length - 1; i++) {
    if (isQuestionAnswered(questions[i], qStates)) count = i + 2;
    else break;
  }
  return count;
}

type StageStat = "complete" | "in-progress" | "unanswered";

function getStageStatus(stage: StageBStage, qStates: Record<string, QuestionAnswerState>): StageStat {
  const answered = stage.questions.filter(q => isQuestionAnswered(q, qStates)).length;
  if (answered === stage.questions.length) return "complete";
  if (answered > 0) return "in-progress";
  return "unanswered";
}

function RunningPhase({
  session: initialSession,
  onSessionEnd,
}: {
  session: StageBSession;
  onSessionEnd: (report: StageBReport | null) => void;
}) {
  const [session, setSession] = useState(initialSession);
  const [selCaseIdx, setSelCaseIdx] = useState(initialSession.current_case_idx);
  const [selStageIdx, setSelStageIdx] = useState(initialSession.current_stage_idx);

  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const expires = new Date(initialSession.expires_at).getTime();
    return Math.max(0, Math.floor((expires - Date.now()) / 1000));
  });
  const finalizedRef = useRef(false);

  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [audioEnded, setAudioEnded] = useState(false);
  const [showText, setShowText] = useState(false);
  const ttsUrlRef = useRef<string | null>(null);

  const [qStates, setQStates] = useState<Record<string, QuestionAnswerState>>({});
  const [advancing, setAdvancing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // Timer — run once on mount
  useEffect(() => {
    const doFinalize = () => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      finalizeStageBSession(session.session_id)
        .then(res => onSessionEnd(res.data))
        .catch(() =>
          getStageBReport(session.session_id)
            .then(res => onSessionEnd(res.data))
            .catch(() => onSessionEnd(null)),
        );
    };
    if (remainingSeconds <= 0) { doFinalize(); return; }
    const id = setInterval(() => {
      setRemainingSeconds(prev => {
        const next = prev - 1;
        if (next <= 0) { clearInterval(id); doFinalize(); return 0; }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TTS fetch on stage change; revoke previous object URL
  useEffect(() => {
    if (ttsUrlRef.current) { URL.revokeObjectURL(ttsUrlRef.current); ttsUrlRef.current = null; }
    setTtsUrl(null);
    setAudioEnded(false);
    setShowText(false);
    setTtsLoading(true);
    let cancelled = false;
    fetchStageBTts(session.session_id, selCaseIdx, selStageIdx)
      .then(url => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        setTtsUrl(url);
        ttsUrlRef.current = url;
      })
      .catch(() => { if (!cancelled) setShowText(true); })
      .finally(() => { if (!cancelled) setTtsLoading(false); });
    return () => {
      cancelled = true;
      if (ttsUrlRef.current) { URL.revokeObjectURL(ttsUrlRef.current); ttsUrlRef.current = null; }
    };
  }, [selCaseIdx, selStageIdx, session.session_id]);

  const setQState = useCallback((qId: string, update: Partial<QuestionAnswerState>) => {
    setQStates(prev => ({ ...prev, [qId]: { ...(prev[qId] ?? defaultQState()), ...update } }));
  }, []);

  const handleTranscribe = useCallback(async (
    q: StageBQuestion, cIdx: number, sIdx: number, qNum: number, blob: Blob,
  ) => {
    setQState(q.question_id, { transcribing: true });
    try {
      const res = await transcribeStageBRecording(session.session_id, cIdx, sIdx, qNum, blob);
      setQState(q.question_id, { transcribing: false, transcriptDraft: res.data.transcription });
    } catch {
      setQState(q.question_id, { transcribing: false });
    }
  }, [session.session_id, setQState]);

  const handleChat = useCallback(async (
    q: StageBQuestion, cIdx: number, sIdx: number, qNum: number,
  ) => {
    const qState = qStates[q.question_id] ?? defaultQState();
    const msg = qState.chatInput.trim();
    if (!msg || qState.chatLoading) return;
    const userMsg: StageBChatMessage = { role: "user", content: msg };
    const nextHistory = [...qState.chatHistory, userMsg];
    setQState(q.question_id, { chatHistory: nextHistory, chatInput: "", chatLoading: true });
    try {
      const res = await chatWithExaminer(
        session.session_id, cIdx, sIdx, qNum,
        { message: msg, history: qState.chatHistory },
      );
      setQState(q.question_id, {
        chatHistory: [...nextHistory, { role: "assistant", content: res.data.reply }],
        chatLoading: false,
      });
    } catch {
      setQState(q.question_id, { chatLoading: false });
    }
  }, [session.session_id, qStates, setQState]);

  const handleSubmitAnswer = useCallback(async (
    q: StageBQuestion, cIdx: number, sIdx: number, qNum: number,
  ) => {
    const qState = qStates[q.question_id] ?? defaultQState();
    const answer = qState.mode === "text" ? qState.textDraft : qState.transcriptDraft;
    if (!answer.trim()) return;
    setQState(q.question_id, { submitting: true });
    try {
      const res = await submitStageBAnswer(
        session.session_id, cIdx, sIdx, qNum,
        { student_answer: answer, answer_mode: qState.mode },
      );
      setQState(q.question_id, { submitting: false, result: res.data });
      if (typeof res.data.remaining_seconds === "number") {
        setRemainingSeconds(res.data.remaining_seconds);
      }
    } catch {
      setQState(q.question_id, { submitting: false });
    }
  }, [session.session_id, qStates, setQState]);

  const handleAdvanceStage = useCallback(async () => {
    setAdvancing(true);
    try {
      const res = await apiAdvanceStage(session.session_id);
      const newSession = res.data;
      setSession(newSession);
      setSelCaseIdx(newSession.current_case_idx);
      setSelStageIdx(newSession.current_stage_idx);
    } catch {
      // ignore — edge case where backend errors
    } finally {
      setAdvancing(false);
    }
  }, [session.session_id]);

  const handleFinalizeExam = useCallback(async () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setFinalizing(true);
    try {
      const res = await finalizeStageBSession(session.session_id);
      onSessionEnd(res.data);
    } catch {
      try {
        const reportRes = await getStageBReport(session.session_id);
        onSessionEnd(reportRes.data);
      } catch {
        onSessionEnd(null);
      }
    } finally {
      setFinalizing(false);
    }
  }, [session.session_id, onSessionEnd]);

  const currentCase = session.cases[selCaseIdx];
  const currentStage = currentCase?.stages[selStageIdx];
  const isCurrentPos =
    selCaseIdx === session.current_case_idx && selStageIdx === session.current_stage_idx;
  const allStageAnswered =
    currentStage ? currentStage.questions.every(q => isQuestionAnswered(q, qStates)) : false;
  const isLastStageOfLastCase =
    session.current_case_idx === session.cases.length - 1 &&
    session.current_stage_idx ===
      ((session.cases[session.current_case_idx]?.stages.length ?? 1) - 1);

  const visibleCount = currentStage ? computeVisibleCount(currentStage.questions, qStates) : 0;
  const visibleQuestions = currentStage?.questions.slice(0, visibleCount) ?? [];

  const timerColor =
    remainingSeconds < 300 ? "text-red-600" :
    remainingSeconds < 600 ? "text-amber-600" :
    "text-gray-700";

  return (
    <div className="flex">
      {/* Sidebar navigator */}
      <aside
        className="w-60 shrink-0 border-r bg-gray-50 self-start sticky top-0 overflow-y-auto"
        style={{ maxHeight: "100vh" }}
      >
        <div className="px-3 py-2.5 border-b">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Navigator</p>
        </div>
        <nav className="p-2 space-y-3">
          {session.cases.map((c, cIdx) => {
            const locked = cIdx > session.current_case_idx;
            return (
              <div key={c.case_id}>
                <div className={`px-2 py-1 text-xs font-semibold flex items-center gap-1 ${locked ? "text-gray-400" : "text-gray-700"}`}>
                  {locked && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0 text-gray-400">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className="truncate">Case {cIdx + 1}: {c.title}</span>
                </div>
                <div className="ml-2 mt-0.5 space-y-0.5">
                  {c.stages.map((stage, sIdx) => {
                    const accessible =
                      cIdx < session.current_case_idx ||
                      (cIdx === session.current_case_idx && sIdx <= session.current_stage_idx);
                    const isSelected = selCaseIdx === cIdx && selStageIdx === sIdx;
                    const status = getStageStatus(stage, qStates);
                    if (!accessible) {
                      return (
                        <div key={sIdx} className="px-2 py-1 text-xs text-gray-400 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-200 shrink-0" />
                          <span className="truncate">{stage.title}</span>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={sIdx}
                        onClick={() => { setSelCaseIdx(cIdx); setSelStageIdx(sIdx); }}
                        className={`w-full text-left px-2 py-1 text-xs rounded flex items-center gap-1.5 transition-colors ${
                          isSelected
                            ? "bg-indigo-100 text-indigo-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          status === "complete" ? "bg-green-500" :
                          status === "in-progress" ? "bg-amber-400" :
                          "bg-gray-300"
                        }`} />
                        <span className="truncate">{stage.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Sticky top bar with timer */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-700 truncate">
            {currentCase
              ? `Case ${selCaseIdx + 1} of ${session.case_count}: ${currentCase.title}`
              : "Stage B Oral Exam"}
          </p>
          <span className={`tabular-nums text-sm font-semibold font-mono shrink-0 ${timerColor}`}>
            ⏱ {formatTimer(remainingSeconds)}
          </span>
        </div>

        {/* Stage content */}
        <div className="px-6 py-6">
          {currentStage ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Stage title badge */}
              <div>
                <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide">
                  {currentStage.title}
                </span>
              </div>

              {/* Audio player + context reveal */}
              <div className="space-y-2">
                {ttsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent inline-block" />
                    Loading audio…
                  </div>
                ) : ttsUrl ? (
                  <>
                    <AudioPlayer
                      src={ttsUrl}
                      label="Examiner"
                      autoPlay
                      onEnded={() => setAudioEnded(true)}
                    />
                    {!audioEnded && !showText && (
                      <button
                        onClick={() => setShowText(true)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Show Text
                      </button>
                    )}
                  </>
                ) : null}
                {(audioEnded || showText || (!ttsUrl && !ttsLoading)) && (
                  <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-md p-3">
                    {currentStage.context}
                  </p>
                )}
              </div>

              {/* Questions */}
              <div className="space-y-5">
                {visibleQuestions.map((q, i) => {
                  const qState = qStates[q.question_id] ?? defaultQState();
                  const answered = isQuestionAnswered(q, qStates);
                  const qNum = i;

                  return (
                    <div key={q.question_id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                          Question {qNum}
                        </p>
                        <p className="text-sm font-medium text-gray-800">{q.stem}</p>
                      </div>

                      {!answered ? (
                        <div className="p-4 space-y-4">
                          {/* Examiner chat */}
                          <div className="border border-indigo-100 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setQState(q.question_id, { chatOpen: !qState.chatOpen })}
                              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                            >
                              <span>Ask the Examiner</span>
                              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 transition-transform ${qState.chatOpen ? "rotate-180" : ""}`}>
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                              </svg>
                            </button>
                            {qState.chatOpen && (
                              <div className="p-3 space-y-2">
                                {qState.chatHistory.length > 0 && (
                                  <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {qState.chatHistory.map((msg, mi) => (
                                      <div key={mi} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${
                                          msg.role === "user"
                                            ? "bg-indigo-600 text-white"
                                            : "bg-gray-100 text-gray-800"
                                        }`}>
                                          {msg.content}
                                        </div>
                                      </div>
                                    ))}
                                    {qState.chatLoading && (
                                      <div className="flex justify-start">
                                        <div className="bg-gray-100 rounded-lg px-3 py-1.5 text-xs text-gray-500 flex items-center gap-1.5">
                                          <span className="h-3 w-3 animate-spin rounded-full border border-gray-400 border-t-transparent inline-block" />
                                          Thinking…
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={qState.chatInput}
                                    onChange={e => setQState(q.question_id, { chatInput: e.target.value })}
                                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(q, selCaseIdx, selStageIdx, qNum); } }}
                                    placeholder="Ask a clarifying question…"
                                    className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    disabled={qState.chatLoading}
                                  />
                                  <button
                                    onClick={() => handleChat(q, selCaseIdx, selStageIdx, qNum)}
                                    disabled={!qState.chatInput.trim() || qState.chatLoading}
                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  >
                                    Send
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Mode tabs */}
                          <div className="flex border border-gray-200 rounded-md overflow-hidden w-fit text-xs">
                            {(["text", "audio"] as const).map(mode => (
                              <button
                                key={mode}
                                onClick={() => setQState(q.question_id, { mode })}
                                className={`px-3 py-1.5 font-medium transition-colors ${
                                  qState.mode === mode
                                    ? "bg-indigo-600 text-white"
                                    : "text-gray-600 hover:bg-gray-50"
                                }`}
                              >
                                {mode === "text" ? "Type" : "Record"}
                              </button>
                            ))}
                          </div>

                          {/* Answer input */}
                          {qState.mode === "text" ? (
                            <textarea
                              value={qState.textDraft}
                              onChange={e => setQState(q.question_id, { textDraft: e.target.value })}
                              maxLength={3000}
                              rows={5}
                              placeholder="Type your answer…"
                              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          ) : (
                            <div className="space-y-2">
                              {qState.transcribing ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent inline-block" />
                                  Transcribing…
                                </div>
                              ) : qState.transcriptDraft ? (
                                <textarea
                                  value={qState.transcriptDraft}
                                  onChange={e =>
                                    setQState(q.question_id, { transcriptDraft: e.target.value })
                                  }
                                  rows={5}
                                  placeholder="Transcript (editable)…"
                                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              ) : (
                                <AudioRecorder
                                  onRecordingComplete={blob =>
                                    handleTranscribe(q, selCaseIdx, selStageIdx, qNum, blob)
                                  }
                                />
                              )}
                            </div>
                          )}

                          <button
                            onClick={() => handleSubmitAnswer(q, selCaseIdx, selStageIdx, qNum)}
                            disabled={
                              qState.submitting ||
                              !(qState.mode === "text"
                                ? qState.textDraft.trim()
                                : qState.transcriptDraft.trim())
                            }
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {qState.submitting ? "Submitting…" : "Submit Answer"}
                          </button>
                        </div>
                      ) : qState.result ? (
                        /* Fresh result from this session */
                        <div className="p-4 space-y-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                            qState.result.score >= 7 ? "bg-green-100 text-green-700" :
                            qState.result.score >= 4 ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            Score: {qState.result.score}/10
                          </span>
                          <p className="text-sm text-gray-700">{qState.result.feedback}</p>
                          {qState.result.key_points_hit.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                Key Points Covered
                              </p>
                              <ul className="space-y-0.5">
                                {qState.result.key_points_hit.map((kp, ki) => (
                                  <li key={ki} className="text-xs text-green-700 flex items-start gap-1">
                                    <span className="mt-0.5">✓</span>
                                    <span>{kp}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <details>
                            <summary className="text-xs text-indigo-600 cursor-pointer select-none">
                              Model Answer
                            </summary>
                            <p className="mt-1 text-sm text-gray-700 bg-gray-50 border border-gray-100 p-3 rounded-md">
                              {qState.result.model_answer}
                            </p>
                          </details>
                        </div>
                      ) : (
                        /* Resumed session: answered previously — show data from session */
                        <div className="p-4 space-y-2">
                          {q.score !== null && (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                              (q.score ?? 0) >= 7 ? "bg-green-100 text-green-700" :
                              (q.score ?? 0) >= 4 ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              Score: {q.score}/10
                            </span>
                          )}
                          {q.feedback && (
                            <p className="text-sm text-gray-700">{q.feedback}</p>
                          )}
                          {q.key_points_hit && q.key_points_hit.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                Key Points Covered
                              </p>
                              <ul className="space-y-0.5">
                                {q.key_points_hit.map((kp, ki) => (
                                  <li key={ki} className="text-xs text-green-700 flex items-start gap-1">
                                    <span className="mt-0.5">✓</span>
                                    <span>{kp}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Next Stage / Finalize */}
              {isCurrentPos && allStageAnswered && (
                <div className="flex justify-end pt-2">
                  {isLastStageOfLastCase ? (
                    <button
                      onClick={handleFinalizeExam}
                      disabled={finalizing}
                      className="px-6 py-2.5 bg-green-600 text-white rounded-md font-medium text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {finalizing ? "Finalizing…" : "Finalize Exam ✓"}
                    </button>
                  ) : (
                    <button
                      onClick={handleAdvanceStage}
                      disabled={advancing}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-md font-medium text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {advancing ? "Advancing…" : "Next Stage →"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 p-6">Loading stage…</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Review Phase -----------------------------------------------------------

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const cls =
    score >= 7 ? "bg-green-100 text-green-700" :
    score >= 4 ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {score}/10
    </span>
  );
}

function QuestionReview({ q, num }: { q: StageBQuestionFull; num: number }) {
  const missed = (q.key_points ?? []).filter(kp => !(q.key_points_hit ?? []).includes(kp));
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Question {num}</p>
        <p className="text-sm font-medium text-gray-800">{q.stem}</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ScoreBadge score={q.score} />
          {q.score === null && <span className="text-xs text-gray-400">Not answered</span>}
        </div>
        {q.student_answer && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Your Answer</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{q.student_answer}</p>
          </div>
        )}
        {q.model_answer && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Model Answer</p>
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 p-3 rounded-md whitespace-pre-wrap">
              {q.model_answer}
            </p>
          </div>
        )}
        {q.feedback && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">AI Feedback</p>
            <p className="text-sm text-gray-700">{q.feedback}</p>
          </div>
        )}
        {q.key_points_hit && q.key_points_hit.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Key Points Covered</p>
            <ul className="space-y-0.5">
              {q.key_points_hit.map((kp, ki) => (
                <li key={ki} className="text-xs text-green-700 flex items-start gap-1">
                  <span className="mt-0.5">✓</span>
                  <span>{kp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {missed.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Key Points Missed</p>
            <ul className="space-y-0.5">
              {missed.map((kp, ki) => (
                <li key={ki} className="text-xs text-red-600 flex items-start gap-1">
                  <span className="mt-0.5">✗</span>
                  <span>{kp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function StageSection({ stage }: { stage: StageBStageReport }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-t">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>{stage.title}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-md p-3">
            {stage.context}
          </p>
          {stage.questions.map((q, qi) => (
            <QuestionReview key={q.question_id} q={q} num={qi + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function CaseAccordion({ caseReport, caseNum }: { caseReport: StageBCaseReport; caseNum: number }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-start justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left gap-4"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">
            Case {caseNum}: {caseReport.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{caseReport.chief_complaint}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {caseReport.avg_score !== null && (
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
              caseReport.avg_score >= 7 ? "bg-green-100 text-green-700" :
              caseReport.avg_score >= 4 ? "bg-amber-100 text-amber-700" :
              "bg-red-100 text-red-700"
            }`}>
              Avg {caseReport.avg_score.toFixed(1)}/10
            </span>
          )}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>
      {open && (
        <div>
          {caseReport.stages.map(stage => (
            <StageSection key={stage.stage_index} stage={stage} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewPhase({
  report,
  onRetake,
}: {
  report: StageBReport;
  onRetake: (session: StageBSession) => void;
}) {
  const navigate = useNavigate();
  const [retaking, setRetaking] = useState(false);
  const allQuestions = report.cases.flatMap(c => c.stages.flatMap(s => s.questions));
  const passCount = allQuestions.filter(q => q.score !== null && q.score >= 6).length;

  const handleRetake = async () => {
    setRetaking(true);
    try {
      const res = await retakeStageBSession(report.session_id);
      onRetake(res.data);
    } catch {
      setRetaking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Exam Review</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {report.difficulty} · {report.case_count} case{report.case_count !== 1 ? "s" : ""} · {report.duration_minutes} min
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleRetake}
            disabled={retaking}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {retaking ? "Starting…" : "Retake Exam"}
          </button>
          <button
            onClick={() => navigate("/exams")}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Back to Exams
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Questions Answered", value: `${report.answered_count}/${report.total_questions}` },
          { label: "Passed (≥6/10)", value: String(passCount) },
          { label: "Average Score", value: report.avg_score !== null ? `${report.avg_score.toFixed(1)}/10` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {report.cases.map((c, ci) => (
          <CaseAccordion key={c.case_id} caseReport={c} caseNum={ci + 1} />
        ))}
      </div>
    </div>
  );
}

// ---- Main Page Component ---------------------------------------------------

export default function StageBExamPage() {
  const navigate = useNavigate();
  const { setExamRunning } = useExamGuard();
  const [phase, setPhase] = useState<Phase>("settings");
  const [settings, setSettings] = useState<StageBSettings>(DEFAULT_SETTINGS);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicSearch, setTopicSearch] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [activeSession, setActiveSession] = useState<StageBSession | null>(null);
  const [pastSessions, setPastSessions] = useState<StageBSessionSummary[]>([]);
  const [session, setSession] = useState<StageBSession | null>(null);
  const [report, setReport] = useState<StageBReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retakingId, setRetakingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Same pattern as ExamsPage.tsx
  useEffect(() => {
    setExamRunning(phase === "running");
    return () => setExamRunning(false);
  }, [phase, setExamRunning]);

  useEffect(() => {
    (async () => {
      setLoadingSettings(true);
      try {
        const [topicsRes, activeRes, pastRes] = await Promise.allSettled([
          getQuestionTopics(),
          getActiveStageBSession(),
          listStageBSessions(),
        ]);
        if (topicsRes.status === "fulfilled") setTopics(topicsRes.value.data);
        if (activeRes.status === "fulfilled") setActiveSession(activeRes.value.data);
        if (pastRes.status === "fulfilled") setPastSessions(pastRes.value.data);
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

  const handleRetakeFromSettings = async (sessionId: string) => {
    setRetakingId(sessionId);
    try {
      const res = await retakeStageBSession(sessionId);
      setSession(res.data);
      setPhase("running");
    } catch {
      setRetakingId(null);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingId(sessionId);
    try {
      await deleteStageBSession(sessionId);
      setPastSessions(prev => prev.filter(s => s.session_id !== sessionId));
    } finally {
      setDeletingId(null);
    }
  };

  if (phase === "running" && session) {
    return (
      <RunningPhase
        session={session}
        onSessionEnd={r => { setReport(r); setPhase("review"); }}
      />
    );
  }

  if (phase === "review") {
    if (!report) {
      return (
        <div className="p-6 max-w-3xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold mb-2">Exam Complete</h1>
          <p className="text-gray-500 mb-6">Report unavailable.</p>
          <button
            onClick={() => { setPhase("settings"); setSession(null); setReport(null); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Start New Exam
          </button>
        </div>
      );
    }
    return (
      <ReviewPhase
        report={report}
        onRetake={s => { setSession(s); setReport(null); setPhase("running"); }}
      />
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <button
          onClick={() => navigate("/exams")}
          className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Exams
        </button>
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

      {pastSessions.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">Past Exams</p>
          </div>
          <div className="divide-y max-h-72 overflow-y-auto">
            {pastSessions.map(s => (
              <div key={s.session_id} className="flex items-center justify-between px-4 py-3 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 capitalize">
                    {s.difficulty} · {s.case_count} case{s.case_count !== 1 ? "s" : ""} · {s.duration_minutes} min
                    {s.avg_score !== null && (
                      <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
                        s.avg_score >= 7 ? "bg-green-100 text-green-700" :
                        s.avg_score >= 4 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {s.avg_score.toFixed(1)}/10
                      </span>
                    )}
                  </p>
                  {s.topics.length > 0 && (
                    <p className="text-xs text-indigo-600 truncate mt-0.5">
                      {s.topics.join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(s.started_at).toLocaleDateString()}
                    {s.status === "expired" && " · expired"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRetakeFromSettings(s.session_id)}
                    disabled={retakingId === s.session_id || deletingId === s.session_id}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {retakingId === s.session_id ? "Starting…" : "Retake"}
                  </button>
                  <button
                    onClick={() => handleDeleteSession(s.session_id)}
                    disabled={deletingId === s.session_id || retakingId === s.session_id}
                    className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded"
                    title="Delete exam"
                  >
                    {deletingId === s.session_id ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent inline-block" />
                    ) : (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
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
