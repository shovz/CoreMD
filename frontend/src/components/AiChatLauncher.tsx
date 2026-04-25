import { useEffect } from "react";
import AssistantChat from "./AssistantChat";
import { useAiContext } from "../context/AiContext";

export default function AiChatLauncher() {
  const { open, setOpen, prefillText, clearPrefill } = useAiContext();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
        aria-label="Open AI Assistant"
      >
        Ask AI
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[420px]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">Harrison's AI Assistant</span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                aria-label="Close AI Assistant"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-hidden p-4">
              <AssistantChat prefillText={prefillText} onPrefillConsumed={clearPrefill} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
