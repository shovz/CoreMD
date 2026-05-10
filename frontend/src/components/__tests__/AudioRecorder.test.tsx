import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as useAudioRecorderModule from "../../hooks/useAudioRecorder";
import { AudioRecorder } from "../AudioRecorder";

vi.mock("../../hooks/useAudioRecorder");
vi.mock("../AudioPlayer", () => ({
  AudioPlayer: () => <div data-testid="audio-player" />,
}));

function makeHookReturn(
  overrides: Partial<ReturnType<typeof useAudioRecorderModule.useAudioRecorder>>
): ReturnType<typeof useAudioRecorderModule.useAudioRecorder> {
  return {
    state: "idle",
    audioBlob: null,
    audioUrl: null,
    durationSeconds: 0,
    startRecording: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn(),
    reset: vi.fn(),
    error: null,
    ...overrides,
  };
}

describe("AudioRecorder", () => {
  beforeEach(() => {
    // no handlers needed but reset is handled by afterEach in setup.ts
  });

  it("idle state: mic button visible with aria-label 'Start recording' and 'Press to record' text shown", () => {
    vi.mocked(useAudioRecorderModule.useAudioRecorder).mockReturnValue(
      makeHookReturn({ state: "idle" })
    );

    render(<AudioRecorder onRecordingComplete={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Start recording" })).toBeInTheDocument();
    expect(screen.getByText("Press to record")).toBeInTheDocument();
  });

  it("clicking mic button calls startRecording", async () => {
    const startRecording = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAudioRecorderModule.useAudioRecorder).mockReturnValue(
      makeHookReturn({ state: "idle", startRecording })
    );

    render(<AudioRecorder onRecordingComplete={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Start recording" }));

    expect(startRecording).toHaveBeenCalledTimes(1);
  });

  it("recording state: stop button visible and duration counter shown", () => {
    vi.mocked(useAudioRecorderModule.useAudioRecorder).mockReturnValue(
      makeHookReturn({ state: "recording", durationSeconds: 5 })
    );

    render(<AudioRecorder onRecordingComplete={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Stop recording" })).toBeInTheDocument();
    expect(screen.getByText(/0:05/)).toBeInTheDocument();
  });

  it("stopped state with audioUrl: 'Use This Recording' and 'Re-record' buttons visible", () => {
    const blob = new Blob(["audio"], { type: "audio/webm" });
    vi.mocked(useAudioRecorderModule.useAudioRecorder).mockReturnValue(
      makeHookReturn({ state: "stopped", audioBlob: blob, audioUrl: "blob:fake-url" })
    );

    render(<AudioRecorder onRecordingComplete={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Use This Recording" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-record" })).toBeInTheDocument();
  });

  it("'Use This Recording' calls onRecordingComplete with the audioBlob", async () => {
    const blob = new Blob(["audio"], { type: "audio/webm" });
    const onRecordingComplete = vi.fn();
    vi.mocked(useAudioRecorderModule.useAudioRecorder).mockReturnValue(
      makeHookReturn({ state: "stopped", audioBlob: blob, audioUrl: "blob:fake-url" })
    );

    render(<AudioRecorder onRecordingComplete={onRecordingComplete} />);

    await userEvent.click(screen.getByRole("button", { name: "Use This Recording" }));

    expect(onRecordingComplete).toHaveBeenCalledTimes(1);
    expect(onRecordingComplete).toHaveBeenCalledWith(blob);
  });

  it("'Re-record' calls reset", async () => {
    const reset = vi.fn();
    const blob = new Blob(["audio"], { type: "audio/webm" });
    vi.mocked(useAudioRecorderModule.useAudioRecorder).mockReturnValue(
      makeHookReturn({ state: "stopped", audioBlob: blob, audioUrl: "blob:fake-url", reset })
    );

    render(<AudioRecorder onRecordingComplete={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Re-record" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
