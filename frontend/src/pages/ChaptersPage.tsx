import { useEffect, useState } from "react";
import { getChapters, type Chapter } from "../api/chaptersApi";
import { Link } from "react-router-dom";


export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <p>Loading chapters...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Chapters</h1>
      <ul>
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <Link to={`/chapters/${chapter.id}`}>
              {chapter.id}. {chapter.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
