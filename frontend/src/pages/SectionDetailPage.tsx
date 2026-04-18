import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { getSectionById, type SectionResponse } from "../api/sectionApi";
import { getChapterById, type Chapter } from "../api/chaptersApi";

export default function SectionDetailPage() {
  const { chapterId, sectionId } = useParams();
  const [section, setSection] = useState<SectionResponse | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);

  useEffect(() => {
    if (!chapterId || !sectionId) return;
    Promise.all([
      getSectionById(chapterId, sectionId),
      getChapterById(chapterId),
    ]).then(([sectionRes, chapterRes]) => {
      setSection(sectionRes.data);
      setChapter(chapterRes.data);
    });
  }, [chapterId, sectionId]);

  if (!section) return <p style={{ padding: 24 }}>Loading section...</p>;

  const sections = chapter?.sections ?? [];
  const currentIdx = sections.findIndex((s) => s.id === sectionId);
  const prevSection = currentIdx > 0 ? sections[currentIdx - 1] : null;
  const nextSection = currentIdx >= 0 && currentIdx < sections.length - 1 ? sections[currentIdx + 1] : null;

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      {/* Back link */}
      <Link
        to={`/chapters/${chapterId}`}
        style={{ fontSize: 14, display: "inline-block", marginBottom: 12 }}
      >
        ← Back to Chapter
      </Link>

      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
        <Link to="/chapters" style={{ color: "#888" }}>Chapters</Link>
        {" › "}
        <Link to={`/chapters/${chapterId}`} style={{ color: "#888" }}>{section.chapter_title}</Link>
        {" › "}
        {section.section_title}
      </div>

      {/* Headings */}
      <h1 style={{ marginTop: 0, marginBottom: 4 }}>{section.chapter_title}</h1>
      <h2 style={{ marginTop: 0, marginBottom: 24, color: "#444", fontWeight: 600, fontSize: 20 }}>
        {section.section_title}
      </h2>

      {/* Section position indicator */}
      {sections.length > 0 && currentIdx >= 0 && (
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 20 }}>
          Section {currentIdx + 1} of {sections.length}
        </div>
      )}

      {/* Content */}
      {section.html_content ? (
        <div
          className="section-content"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.html_content) }}
        />
      ) : (
        <div style={{ lineHeight: 1.75, color: "#222", fontSize: 15 }}>
          {section.content.split("\n\n").map((para, i) => (
            <p key={i} style={{ marginBottom: 16, marginTop: 0 }}>{para.trim()}</p>
          ))}
        </div>
      )}

      {/* Prev / Next navigation */}
      {(prevSection || nextSection) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 48,
            paddingTop: 20,
            borderTop: "1px solid #e0e0e0",
            gap: 16,
          }}
        >
          <div>
            {prevSection && (
              <Link
                to={`/chapters/${chapterId}/sections/${prevSection.id}`}
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  color: "#1565c0",
                  textDecoration: "none",
                  fontSize: 14,
                  maxWidth: 320,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={prevSection.title}
              >
                ← {prevSection.title}
              </Link>
            )}
          </div>
          <div>
            {nextSection && (
              <Link
                to={`/chapters/${chapterId}/sections/${nextSection.id}`}
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  color: "#1565c0",
                  textDecoration: "none",
                  fontSize: 14,
                  maxWidth: 320,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={nextSection.title}
              >
                {nextSection.title} →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
