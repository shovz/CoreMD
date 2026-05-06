import { useRef, useState, useEffect, useCallback } from "react";

interface AudioPlayerProps {
  src: string;
  label?: string;
  autoPlay?: boolean;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, label, autoPlay = false, className = "" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  const play = useCallback(() => {
    audioRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, play, pause]);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
    setCurrentTime(audio.currentTime);
  }, []);

  // autoPlay: trigger once src is set and audio is ready
  useEffect(() => {
    if (autoPlay && ready && src) {
      play();
    }
    // only re-run when src changes or ready flips true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, ready, autoPlay]);

  // reset state on src change
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setReady(false);
  }, [src]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}

      <div className="flex items-center gap-3 rounded-lg bg-gray-100 px-4 py-3">
        {/* Play / pause button */}
        <button
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors"
        >
          {playing ? (
            // Pause icon
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            // Play icon
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Progress bar */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={seek}
          disabled={!ready}
          aria-label="Seek"
          className="flex-1 accent-indigo-600 disabled:opacity-40"
        />

        {/* Time display */}
        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-gray-600">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        className="hidden"
        onLoadedMetadata={() => {
          setDuration(audioRef.current?.duration ?? 0);
          setReady(true);
        }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
