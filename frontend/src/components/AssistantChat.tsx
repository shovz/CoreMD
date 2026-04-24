import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { askQuestion, type Message, type Citation } from "../api/aiApi";

const EXCHANGE_LIMIT = 10;
const MESSAGE_LIMIT = EXCHANGE_LIMIT * 2;
const ELLIPSIS = "\u2026";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  loading?: boolean;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}${ELLIPSIS}` : text;
}

export default function AssistantChat({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const completedMessages = messages.filter((m) => !m.loading);
  const limitReached = completedMessages.length >= MESSAGE_LIMIT;
  const inputDisabled = isLoading || limitReached;

  function startNewConversation() {
    setMessages([]);
    setInput("");
  }

  async function handleSubmit() {
    const question = input.trim();
    if (!question || inputDisabled) return;

    const history: Message[] = completedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", loading: true },
    ]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await askQuestion(question, history);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: res.answer, citations: res.citations },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
          citations: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSubmit();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
        <h2 className="m-0 text-lg font-semibold text-slate-900">Harrison&apos;s AI Assistant</h2>
        <button
          onClick={startNewConversation}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          New Chat
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pb-3">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-500">
            Ask a clinical question grounded in Harrison&apos;s.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === "user" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-900"
              }`}
            >
              {msg.loading ? "..." : msg.content}
            </div>

            {msg.role === "assistant" && !msg.loading && msg.citations && msg.citations.length > 0 && (
              <div className="mt-2 flex max-w-[90%] flex-wrap gap-2">
                {msg.citations.map((c, ci) => (
                  <Link
                    key={ci}
                    to={`/chapters/${c.chapter_id}`}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100"
                    title={c.chapter_title}
                  >
                    {truncate(c.chapter_title, 40)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {limitReached && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <span className="text-xs text-amber-800">Conversation limit reached</span>
          <button
            onClick={startNewConversation}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Start new conversation
          </button>
        </div>
      )}

      <div className="flex gap-2 border-t border-slate-200 pt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={limitReached ? "Start a new conversation to continue" : "Ask a clinical question..."}
          disabled={inputDisabled}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        <button
          onClick={handleSubmit}
          disabled={inputDisabled || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {compact ? "Ask" : "Send"}
        </button>
      </div>
    </div>
  );
}
