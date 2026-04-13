import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { askQuestion, type Message, type Citation } from "../api/aiApi";

const EXCHANGE_LIMIT = 10; // max user/assistant pairs
const MESSAGE_LIMIT = EXCHANGE_LIMIT * 2; // 20 total messages

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  loading?: boolean;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export default function ChatPage() {
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
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        maxWidth: 760,
        margin: "0 auto",
        padding: "16px 16px 0",
        boxSizing: "border-box",
      }}
    >
      <h2 style={{ margin: "0 0 12px" }}>Harrison's AI Assistant</h2>

      {/* Message thread */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 8,
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "#888", textAlign: "center", marginTop: 40 }}>
            Ask a clinical question grounded in Harrison's.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: 12,
                background: msg.role === "user" ? "#2563eb" : "#e5e7eb",
                color: msg.role === "user" ? "#fff" : "#111",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {msg.loading ? "..." : msg.content}
            </div>

            {msg.role === "assistant" &&
              !msg.loading &&
              msg.citations &&
              msg.citations.length > 0 && (
                <div
                  style={{
                    maxWidth: "75%",
                    marginTop: 6,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  {msg.citations.map((c, ci) => (
                    <Link
                      key={ci}
                      to={`/chapters/${c.chapter_id}`}
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 9999,
                        border: "1px solid #93c5fd",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: 12,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
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

      {/* Session limit banner */}
      {limitReached && (
        <div
          style={{
            margin: "8px 0",
            padding: "12px 16px",
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 14, color: "#92400e" }}>
            Conversation limit reached
          </span>
          <button
            onClick={startNewConversation}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Start new conversation
          </button>
        </div>
      )}

      {/* Input bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 0",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            limitReached
              ? "Start a new conversation to continue"
              : "Ask a clinical question…"
          }
          disabled={inputDisabled}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 15,
            outline: "none",
            background: inputDisabled ? "#f3f4f6" : "#fff",
            cursor: inputDisabled ? "not-allowed" : "text",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={inputDisabled || !input.trim()}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            fontSize: 15,
            cursor:
              inputDisabled || !input.trim() ? "not-allowed" : "pointer",
            opacity: inputDisabled || !input.trim() ? 0.6 : 1,
          }}
        >
          Ask
        </button>
      </div>
    </div>
  );
}
