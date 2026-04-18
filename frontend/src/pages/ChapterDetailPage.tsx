import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getChapterById, type Chapter } from "../api/chaptersApi";

export default function ChapterDetailPage() {
  const { chapterId } = useParams();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chapterId) return;
    getChapterById(chapterId)
      .then((res) => setChapter(res.data))
      .catch(() => setError("Failed to load chapter"))
      .finally(() => setLoading(false));
  }, [chapterId]);

  if (loading) return <p style={{ padding: 24 }}>Loading chapter...</p>;
  if (error) return <p style={{ padding: 24, color: "red" }}>{error}</p>;
  if (!chapter) return null;

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      {/* Back link */}
      <Link to="/chapters" style={{ fontSize: 14, display: "inline-block", marginBottom: 12 }}>
        ← Back to Chapters
      </Link>

      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
        <Link to="/chapters" style={{ color: "#888" }}>Chapters</Link>
        {chapter.part_title && (
          <>
            {" › "}
            {chapter.part_number != null ? `Part ${chapter.part_number}: ` : ""}
            {chapter.part_title}
          </>
        )}
      </div>

      {/* Chapter number label */}
      {chapter.chapter_number != null && (
        <div style={{ fontSize: 13, color: "#999", marginBottom: 4 }}>
          Chapter {chapter.chapter_number}
        </div>
      )}

      <h1 style={{ marginTop: 0, marginBottom: 8 }}>{chapter.title}</h1>

      {chapter.specialty && (
        <span style={{
          display: "inline-block",
          marginBottom: 28,
          background: "#e3f2fd",
          color: "#1565c0",
          borderRadius: 4,
          padding: "2px 10px",
          fontSize: 13,
        }}>
          {chapter.specialty}
        </span>
      )}

      <h2 style={{ marginTop: 0, marginBottom: 12 }}>Sections</h2>

      {chapter.sections.length === 0 ? (
        <p style={{ color: "#888" }}>No sections available.</p>
      ) : (
        <div>
          {chapter.sections.map((section, idx) => (
            <Link
              key={section.id}
              to={`/chapters/${chapter.id}/sections/${section.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "11px 16px",
                marginBottom: 8,
                border: "1px solid #e0e0e0",
                borderRadius: 6,
                background: "#fafafa",
                color: "#1565c0",
                textDecoration: "none",
                fontSize: 14,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fafafa")}
            >
              <span style={{ color: "#bbb", fontSize: 12, marginRight: 14, minWidth: 20 }}>
                {idx + 1}
              </span>
              {section.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
