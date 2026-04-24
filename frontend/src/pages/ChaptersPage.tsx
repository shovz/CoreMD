import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getChapters,
  searchChapters,
  type Chapter,
  type ChapterSearchResult,
} from "../api/chaptersApi";

const DOWN_CHEVRON = "\u25BE";
const RIGHT_CHEVRON = "\u25B8";

export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([1]));

  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<ChapterSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const sortedParts = useMemo(() => {
    const partsMap = new Map<number, { title: string; chapters: Chapter[] }>();

    for (const ch of chapters) {
      const partNum = ch.part_number ?? 0;
      const partTitle = ch.part_title ?? "Other";
      if (!partsMap.has(partNum)) {
        partsMap.set(partNum, { title: partTitle, chapters: [] });
      }
      partsMap.get(partNum)?.chapters.push(ch);
    }

    return [...partsMap.entries()].sort(([a], [b]) => a - b);
  }, [chapters]);

  const togglePart = (partNum: number) => {
    setExpandedParts((prev) => {
      const next = new Set(prev);
      if (next.has(partNum)) next.delete(partNum);
      else next.add(partNum);
      return next;
    });
  };

  const handleSearchChange = (nextValue: string) => {
    setSearchInput(nextValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const query = nextValue.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(() => {
      searchChapters(query)
        .then((res) => setSearchResults(res.data))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
  };

  const trimmedSearch = searchInput.trim();
  const visibleResults = trimmedSearch.length === 0 ? [] : searchResults;

  if (loading) return <p className="p-6">Loading chapters...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="m-0 text-3xl font-bold text-slate-900">Chapters</h1>
        <p className="text-sm text-slate-600">
          {chapters.length} chapters across {sortedParts.length} parts
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-slate-700">Search chapter content</label>
        <input
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Type a symptom, disease, or keyword..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        {trimmedSearch && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {searching ? (
              <p className="text-sm text-slate-600">Searching chapters...</p>
            ) : visibleResults.length === 0 ? (
              <p className="text-sm text-slate-600">No matching chapters found.</p>
            ) : (
              <ul className="space-y-2">
                {visibleResults.map((item) => (
                  <li key={item.chapter_id}>
                    <Link
                      to={`/chapters/${item.chapter_id}`}
                      className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:border-blue-300 hover:bg-blue-50"
                    >
                      <span className="font-medium text-slate-800">
                        {item.chapter_number ? `Chapter ${item.chapter_number}: ` : ""}
                        {item.chapter_title}
                      </span>
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {item.occurrence_count} hits
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {sortedParts.map(([partNum, part]) => {
          const isOpen = expandedParts.has(partNum);
          const sorted = [...part.chapters].sort(
            (a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0)
          );

          return (
            <div key={partNum} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                onClick={() => togglePart(partNum)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold transition ${
                  isOpen ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span>
                  Part {partNum}: {part.title}
                </span>
                <span className={`text-xs ${isOpen ? "text-blue-100" : "text-slate-500"}`}>
                  {sorted.length} chapters {isOpen ? DOWN_CHEVRON : RIGHT_CHEVRON}
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
                      {ch.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
