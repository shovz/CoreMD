import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
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

  if (loading) return <p>Loading chapter...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!chapter) return null;

  return (
    <div style={{ padding: 24 }}>
      <h1>{chapter.title}</h1>

      <h2 style={{ marginTop: 24 }}>Sections</h2>
      <ul>
        {chapter.sections.map((section) => (
          <li key={section.id} style={{ marginBottom: 8 }}>
            <Link to={`/chapters/${chapter.id}/sections/${section.id}`}>
              {section.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
