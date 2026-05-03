import { render, screen, act } from "@testing-library/react";
import { ExamGuardProvider, useExamGuard } from "../ExamGuardContext";

// Consumer component that exposes context values via data-testid
function Consumer() {
  const ctx = useExamGuard();
  return (
    <div>
      <span data-testid="exam-running">{String(ctx.examRunning)}</span>
      <span data-testid="modal-open">{String(ctx.modalOpen)}</span>
      <span data-testid="pending-path">{ctx.pendingPath ?? "null"}</span>
      <span data-testid="pending-action">{ctx.pendingAction ?? "null"}</span>
      <span data-testid="reload-token">{ctx.examsReloadToken}</span>
      <button onClick={() => ctx.setExamRunning(true)}>start</button>
      <button onClick={() => ctx.setExamRunning(false)}>stop</button>
      <button onClick={() => (window.__result = ctx.requestNavigation("/target"))}>
        request-navigate
      </button>
      <button onClick={() => (window.__result = ctx.requestNavigation("/reload", "reload_exams"))}>
        request-reload
      </button>
      <button onClick={() => (window.__result = ctx.confirmNavigation())}>confirm</button>
      <button onClick={() => ctx.cancelNavigation()}>cancel</button>
      <button onClick={() => ctx.triggerExamsReload()}>reload</button>
    </div>
  );
}

declare global {
  interface Window {
    __result: unknown;
  }
}

function setup() {
  render(
    <ExamGuardProvider>
      <Consumer />
    </ExamGuardProvider>
  );
}

function click(label: string) {
  screen.getByText(label).click();
}

function val(testid: string) {
  return screen.getByTestId(testid).textContent;
}

describe("ExamGuardContext", () => {
  it("requestNavigation returns true when exam not running", () => {
    setup();
    act(() => click("request-navigate"));
    expect(window.__result).toBe(true);
    expect(val("modal-open")).toBe("false");
  });

  it("requestNavigation returns false and opens modal when exam is running", () => {
    setup();
    act(() => click("start"));
    act(() => click("request-navigate"));
    expect(window.__result).toBe(false);
    expect(val("modal-open")).toBe("true");
    expect(val("pending-path")).toBe("/target");
    expect(val("pending-action")).toBe("navigate");
  });

  it("confirmNavigation clears state and returns the path", () => {
    setup();
    act(() => click("start"));
    act(() => click("request-navigate"));
    act(() => click("confirm"));
    expect((window.__result as { path: string }).path).toBe("/target");
    expect(val("modal-open")).toBe("false");
    expect(val("pending-path")).toBe("null");
  });

  it("cancelNavigation clears state", () => {
    setup();
    act(() => click("start"));
    act(() => click("request-navigate"));
    act(() => click("cancel"));
    expect(val("modal-open")).toBe("false");
    expect(val("pending-path")).toBe("null");
  });

  it("confirmNavigation with reload_exams action increments examsReloadToken", () => {
    setup();
    act(() => click("start"));
    act(() => click("request-reload"));
    const before = Number(val("reload-token"));
    act(() => click("confirm"));
    expect(Number(val("reload-token"))).toBe(before + 1);
  });

  it("triggerExamsReload increments token on each call", () => {
    setup();
    act(() => click("reload"));
    act(() => click("reload"));
    expect(val("reload-token")).toBe("2");
  });

  it("useExamGuard throws outside ExamGuardProvider", () => {
    function Naked() {
      useExamGuard();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Naked />)).toThrow("ExamGuardProvider");
    spy.mockRestore();
  });
});
