import { useEffect, useState } from "react";
import AssistantChat from "./AssistantChat";
import { useAiContext } from "../context/AiContext";

export default function AiChatLauncher() {
  const { open, setOpen, prefillText, clearPrefill } = useAiContext();
  const [chatKey, setChatKey] = useState(0);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) { setOpen(false); return; }
      if (e.key === "j" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-30 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
        aria-label="Toggle AI Assistant"
      >
        Ask AI
      </button>

      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 flex w-[360px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
          style={{ maxHeight: "480px" }}
        >
          {/* Panel header */}
          <div className="flex flex-shrink-0 items-center justify-between rounded-t-2xl border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">✦ Ask Harrison</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">RAG</span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500">⌘J</kbd>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setChatKey((k) => k + 1)}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                New Chat
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                aria-label="Close AI Assistant"
              >
                ×
              </button>
            </div>
          </div>

          {/* Panel body */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-scroll p-4">
            <AssistantChat
              key={chatKey}
              compact
              prefillText={prefillText}
              onPrefillConsumed={clearPrefill}
            />
          </div>
        </div>
      )}
    </>
  );
}
