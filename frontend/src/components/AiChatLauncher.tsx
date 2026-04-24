import { useState } from "react";
import AssistantChat from "./AssistantChat";

export default function AiChatLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-30">
      {open ? (
        <div className="flex h-[34rem] w-[22rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[26rem]">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <span className="text-sm font-semibold text-slate-800">Ask AI</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Minimize
            </button>
          </div>
          <div className="flex-1 p-3">
            <AssistantChat compact />
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
        >
          Ask AI
        </button>
      )}
    </div>
  );
}
