import { useRef, useState, useCallback, useEffect } from "react";

type RecorderState = "idle" | "recording" | "stopped";

interface UseAudioRecorderOptions {
  maxDurationSeconds?: number;
}

interface UseAudioRecorderResult {
  state: RecorderState;
  audioBlob: Blob | null;
  audioUrl: string | null;
  durationSeconds: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
  error: string | null;
}

export function useAudioRecorder({
  maxDurationSeconds = 120,
}: UseAudioRecorderOptions = {}): UseAudioRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  const clearTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = useCallback(async () => {
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Please allow microphone permission.");
      return;
    }

    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      prevUrlRef.current = url;
      setAudioBlob(blob);
      setAudioUrl(url);
      setDurationSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
      setState("stopped");
      stopStream();
    };

    recorder.start();
    startTimeRef.current = Date.now();
    setState("recording");
    setDurationSeconds(0);

    timerRef.current = setInterval(() => {
      setDurationSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 500);

    autoStopRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        clearTimers();
      }
    }, maxDurationSeconds * 1000);
  }, [maxDurationSeconds]);

  const stopRecording = useCallback(() => {
    clearTimers();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    stopStream();
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationSeconds(0);
    setError(null);
    setState("idle");
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      stopStream();
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
      }
    };
  }, []);

  return {
    state,
    audioBlob,
    audioUrl,
    durationSeconds,
    startRecording,
    stopRecording,
    reset,
    error,
  };
}
