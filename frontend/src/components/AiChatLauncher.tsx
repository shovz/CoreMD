import { useEffect, useState } from "react";
import AssistantChat from "./AssistantChat";
import { useAiContext } from "../context/AiContext";

export default function AiChatLauncher() {
  const { open, setOpen, selectedContext, clearSelectedContext } = useAiContext();
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
        className="fixed bottom-6 right-5 z-30 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[var(--accent-hover)]"
        aria-label="Toggle AI Assistant"
        aria-expanded={open}
      >
        Ask AI
      </button>

      {open && (
        <div
          className="animate-slide-up fixed bottom-20 left-0 right-0 z-50 mx-4 flex max-h-[480px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl sm:left-auto sm:mx-0 sm:right-5 sm:w-[360px]"
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
                onClick={() => {
                  setChatKey((k) => k + 1);
                  clearSelectedContext();
                }}
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
              selectedContext={selectedContext}
              onSelectedContextConsumed={clearSelectedContext}
            />
          </div>
        </div>
      )}
    </>
  );
}
