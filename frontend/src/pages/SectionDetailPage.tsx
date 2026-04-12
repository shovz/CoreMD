import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getSectionById, type SectionResponse } from "../api/sectionApi";

export default function SectionDetailPage() {
  const { chapterId, sectionId } = useParams();
  const [section, setSection] = useState<SectionResponse | null>(null);

  useEffect(() => {
    if (!chapterId || !sectionId) return;

    getSectionById(chapterId, sectionId)
      .then((res) => setSection(res.data));
  }, [chapterId, sectionId]);

  if (!section) return <p>Loading section...</p>;

  return (
    <div style={{ padding: 24 }}>
      <h1>{section.chapter_title}</h1>
      <h2>{section.section_title}</h2>
      <p>{section.content}</p>
    </div>
  );
}
