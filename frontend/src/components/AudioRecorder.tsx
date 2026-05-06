import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { AudioPlayer } from "./AudioPlayer";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
  maxSeconds?: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioRecorder({
  onRecordingComplete,
  disabled = false,
  maxSeconds = 120,
}: AudioRecorderProps) {
  const { state, audioBlob, audioUrl, durationSeconds, startRecording, stopRecording, reset, error } =
    useAudioRecorder({ maxDurationSeconds: maxSeconds });

  const isRecording = state === "recording";
  const isStopped = state === "stopped";

  function handleMicClick() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function handleConfirm() {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mic button row */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleMicClick}
          disabled={disabled || isStopped}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          className={[
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-colors",
            isRecording
              ? "bg-red-500 hover:bg-red-600"
              : "bg-indigo-600 hover:bg-indigo-700",
            (disabled || isStopped) ? "opacity-40 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {/* Pulse ring when recording */}
          {isRecording && (
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-60" />
          )}

          {isRecording ? (
            /* Stop icon */
            <svg viewBox="0 0 24 24" fill="currentColor" className="relative h-5 w-5">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            /* Mic icon */
            <svg viewBox="0 0 24 24" fill="currentColor" className="relative h-5 w-5">
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
              <path d="M19 10a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.93V19H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.07A7 7 0 0 0 19 10z" />
            </svg>
          )}
        </button>

        {/* Duration counter */}
        {isRecording && (
          <span className="tabular-nums text-sm font-medium text-red-600">
            {formatDuration(durationSeconds)} / {formatDuration(maxSeconds)}
          </span>
        )}

        {!isRecording && state === "idle" && (
          <span className="text-sm text-gray-500">Press to record</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Playback + confirm */}
      {isStopped && audioUrl && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
          <AudioPlayer src={audioUrl} label="Preview" />
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Use This Recording
            </button>
            <button
              onClick={reset}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Re-record
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
