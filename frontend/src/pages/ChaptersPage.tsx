import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getChapters, type Chapter } from "../api/chaptersApi";

function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-semibold text-slate-900">{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([1]));
  const [activePart, setActivePart] = useState<number>(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const sortedParts = useMemo(() => {
    const partsMap = new Map<number, { title: string; chapters: Chapter[] }>();
    for (const ch of chapters) {
      const partNum = ch.part_number ?? 0;
      const partTitle = ch.part_title ?? "Other";
      if (!partsMap.has(partNum)) partsMap.set(partNum, { title: partTitle, chapters: [] });
      partsMap.get(partNum)?.chapters.push(ch);
    }
    return [...partsMap.entries()].sort(([a], [b]) => a - b);
  }, [chapters]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value.trim()), 300);
  };

  const togglePart = (partNum: number) => {
    setExpandedParts((prev) => {
      const next = new Set(prev);
      if (next.has(partNum)) next.delete(partNum);
      else next.add(partNum);
      return next;
    });
  };

  const handleSidebarPartClick = (partNum: number) => {
    setActivePart(partNum);
    setExpandedParts((prev) => {
      if (prev.has(partNum)) return prev;
      const next = new Set(prev);
      next.add(partNum);
      return next;
    });
    partRefs.current.get(partNum)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const visibleParts = useMemo(() => {
    if (!searchQuery) return sortedParts;
    const q = searchQuery.toLowerCase();
    return sortedParts
      .map(([partNum, part]): [number, { title: string; chapters: Chapter[] }] | null => {
        const partMatches =
          part.title.toLowerCase().includes(q) || `part ${partNum}`.includes(q);
        if (partMatches) return [partNum, part];
        const matchingChapters = part.chapters.filter(
          (ch) =>
            ch.title.toLowerCase().includes(q) ||
            (ch.chapter_number != null && String(ch.chapter_number).includes(q))
        );
        if (matchingChapters.length > 0) return [partNum, { ...part, chapters: matchingChapters }];
        return null;
      })
      .filter((x): x is [number, { title: string; chapters: Chapter[] }] => x !== null);
  }, [sortedParts, searchQuery]);

  if (loading) return <p className="p-6 text-slate-600">Loading chapters...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="flex gap-6">
      {/* Left Sidebar */}
      <aside className="w-56 flex-shrink-0">
        <div className="sticky top-24 space-y-3">
          <input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search chapters…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <nav className="max-h-[calc(100vh-10rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {sortedParts.map(([partNum, part]) => (
              <button
                key={partNum}
                onClick={() => handleSidebarPartClick(partNum)}
                className={`block w-full px-3 py-2 text-left text-sm transition ${
                  activePart === partNum
                    ? "bg-blue-600 font-semibold text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="block truncate">Part {partNum}</span>
                <span
                  className={`block truncate text-xs font-normal ${
                    activePart === partNum ? "text-blue-100" : "text-slate-400"
                  }`}
                >
                  {part.title}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1">
        <div className="mb-4 space-y-1">
          <h1 className="m-0 text-3xl font-bold text-slate-900">Chapters</h1>
          <p className="text-sm text-slate-600">
            {chapters.length} chapters across {sortedParts.length} parts
          </p>
        </div>

        {visibleParts.length === 0 && searchQuery && (
          <p className="py-4 text-sm text-slate-600">
            No parts or chapters match &ldquo;{searchQuery}&rdquo;.
          </p>
        )}

        <div className="space-y-2">
          {visibleParts.map(([partNum, part]) => {
            const isOpen = !!searchQuery || expandedParts.has(partNum);
            const sorted = [...part.chapters].sort(
              (a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0)
            );

            return (
              <div
                key={partNum}
                ref={(el) => {
                  if (el) partRefs.current.set(partNum, el);
                  else partRefs.current.delete(partNum);
                }}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  onClick={() => togglePart(partNum)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold transition ${
                    isOpen
                      ? "bg-blue-600 text-white"
                      : "bg-slate-50 text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <span>
                    Part {partNum} &middot;{" "}
                    {searchQuery ? highlight(part.title, searchQuery) : part.title}
                  </span>
                  <span className={`text-xs ${isOpen ? "text-blue-100" : "text-slate-500"}`}>
                    {sorted.length} chapters {isOpen ? "▾" : "▸"}
                  </span>
                </button>

                {isOpen && (
                  <div className="divide-y divide-slate-100">
                    {sorted.map((ch) => (
                      <Link
                        key={ch.id}
                        to={`/chapters/${ch.id}`}
                        className="block px-5 py-3 text-sm text-blue-700 hover:bg-blue-50"
                      >
                        {ch.chapter_number != null && (
                          <span className="mr-2 text-xs text-slate-500">Ch. {ch.chapter_number}</span>
                        )}
                        {searchQuery ? highlight(ch.title, searchQuery) : ch.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
