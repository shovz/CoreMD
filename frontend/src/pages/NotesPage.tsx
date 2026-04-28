import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllAnnotations, deleteAnnotation, type Annotation } from "../api/annotationsApi";

export default function NotesPage() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getAllAnnotations()
      .then((res) => setAnnotations(res.data))
      .catch(() => setError("Failed to load notes."))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { title: string; items: Annotation[] }>();
    for (const ann of annotations) {
      const key = ann.chapter_id;
      if (!map.has(key)) {
        map.set(key, { title: ann.chapter_title ?? ann.chapter_id, items: [] });
      }
      map.get(key)!.items.push(ann);
    }
    return [...map.values()];
  }, [annotations]);

  const handleDelete = async (id: string) => {
    await deleteAnnotation(id);
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--ink-dim)]">
        Loading notes…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--ink)]">My Notes</h1>

      {grouped.length === 0 ? (
        <p className="text-[var(--ink-dim)]">
          No notes yet. Select text in a chapter and click &ldquo;Add Note&rdquo; to get started.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ title, items }) => (
            <section key={title}>
              <button
                onClick={() => navigate("/chapters")}
                className="mb-3 text-left text-lg font-semibold text-blue-600 hover:underline"
              >
                {title}
              </button>
              <div className="space-y-3">
                {items.map((ann) => (
                  <div
                    key={ann.id}
                    className="rounded-lg border bg-[var(--paper-2)] p-4"
                    style={{ borderColor: "var(--ink-4)" }}
                  >
                    <p className="mb-1 text-sm italic text-[var(--ink-dim)]">
                      &ldquo;{ann.selected_text}&rdquo;
                    </p>
                    <p className="mb-2 text-sm text-[var(--ink)]">{ann.note_text}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--ink-dim)]">
                        {new Date(ann.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <button
                        onClick={() => handleDelete(ann.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
