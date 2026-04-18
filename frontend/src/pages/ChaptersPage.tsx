import { useEffect, useState } from "react";
import { getChapters, type Chapter } from "../api/chaptersApi";
import { Link } from "react-router-dom";

export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([1]));

  useEffect(() => {
    getChapters()
      .then((res) => {
        setChapters(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load chapters");
        setLoading(false);
      });
  }, []);

  if (loading) return <p style={{ padding: 24 }}>Loading chapters...</p>;
  if (error) return <p style={{ padding: 24, color: "red" }}>{error}</p>;

  // Group by part
  const partsMap = new Map<number, { title: string; chapters: Chapter[] }>();
  for (const ch of chapters) {
    const partNum = ch.part_number ?? 0;
    const partTitle = ch.part_title ?? "Other";
    if (!partsMap.has(partNum)) {
      partsMap.set(partNum, { title: partTitle, chapters: [] });
    }
    partsMap.get(partNum)!.chapters.push(ch);
  }
  const sortedParts = [...partsMap.entries()].sort(([a], [b]) => a - b);

  const togglePart = (partNum: number) => {
    setExpandedParts((prev) => {
      const next = new Set(prev);
      if (next.has(partNum)) next.delete(partNum);
      else next.add(partNum);
      return next;
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <Link to="/" style={{ fontSize: 14, display: "inline-block", marginBottom: 20 }}>
        ← Dashboard
      </Link>

      <h1 style={{ marginTop: 0, marginBottom: 4 }}>Chapters</h1>
      <p style={{ color: "#666", marginBottom: 24, marginTop: 0 }}>
        {chapters.length} chapters across {sortedParts.length} parts
      </p>

      {sortedParts.map(([partNum, part]) => {
        const isOpen = expandedParts.has(partNum);
        const sorted = [...part.chapters].sort(
          (a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0)
        );
        return (
          <div
            key={partNum}
            style={{ marginBottom: 8, border: "1px solid #ddd", borderRadius: 6, overflow: "hidden" }}
          >
            <button
              onClick={() => togglePart(partNum)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "13px 16px",
                background: isOpen ? "#1565c0" : "#f5f5f5",
                color: isOpen ? "#fff" : "#222",
                border: "none",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              <span>Part {partNum}: {part.title}</span>
              <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.85 }}>
                {sorted.length} chapters {isOpen ? "▲" : "▼"}
              </span>
            </button>

            {isOpen && (
              <div>
                {sorted.map((ch) => (
                  <Link
                    key={ch.id}
                    to={`/chapters/${ch.id}`}
                    style={{
                      display: "block",
                      padding: "10px 20px",
                      color: "#1565c0",
                      textDecoration: "none",
                      borderBottom: "1px solid #f0f0f0",
                      fontSize: 14,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4ff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {ch.chapter_number != null ? (
                      <span style={{ color: "#999", marginRight: 8, fontSize: 13 }}>
                        Ch. {ch.chapter_number}
                      </span>
                    ) : null}
                    {ch.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
