import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { askQuestion, type Message, type Citation } from "../api/aiApi";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  loading?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit() {
    const question = input.trim();
    if (!question || isLoading) return;

    const history: Message[] = messages
      .filter((m) => !m.loading)
      .map((m) => ({ role: m.role, content: m.content }));

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
                    marginTop: 4,
                    fontSize: 12,
                    color: "#555",
                  }}
                >
                  <strong>Citations:</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {msg.citations.map((c, ci) => (
                      <li key={ci}>
                        {c.chapter_title} — {c.section_title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

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
          placeholder="Ask a clinical question…"
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 15,
            outline: "none",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            fontSize: 15,
            cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
            opacity: isLoading || !input.trim() ? 0.6 : 1,
          }}
        >
          Ask
        </button>
      </div>
    </div>
  );
}
