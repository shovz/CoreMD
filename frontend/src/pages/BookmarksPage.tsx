import { useState } from "react";
import { Link } from "react-router-dom";
import { getBookmarks, removeBookmark, type Bookmark, type BookmarkType } from "../api/bookmarksApi";

function truncate(text: string, max = 80): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function BookmarkRow({
  item,
  linkTo,
  displayText,
  onRemove,
}: {
  item: Bookmark;
  linkTo: string;
  displayText: string;
  onRemove: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeBookmark(item.item_id);
      onRemove(item.item_id);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <span className="min-w-0 flex-1 text-sm text-slate-700">
        {truncate(displayText)}
      </span>
      <div className="flex flex-shrink-0 items-center gap-2">
        <Link
          to={linkTo}
          className="text-sm text-blue-600 hover:underline"
        >
          →
        </Link>
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-slate-400 transition hover:text-rose-500 disabled:opacity-40"
          title="Remove bookmark"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

type Tab = "question" | "case";

export default function BookmarksPage() {
  const [activeTab, setActiveTab] = useState<Tab>("question");
  const [questionItems, setQuestionItems] = useState<Bookmark[] | null>(null);
  const [caseItems, setCaseItems] = useState<Bookmark[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTab = async (tab: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getBookmarks(tab as BookmarkType);
      if (tab === "question") setQuestionItems(res.data);
      else setCaseItems(res.data);
    } catch {
      setError("Failed to load bookmarks.");
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    const alreadyLoaded = tab === "question" ? questionItems !== null : caseItems !== null;
    if (!alreadyLoaded) fetchTab(tab);
  };

  // Fetch Questions tab on first render
  if (questionItems === null && !loading && !error) {
    fetchTab("question");
  }

  const items = activeTab === "question" ? questionItems : caseItems;

  const handleRemove = (id: string) => {
    if (activeTab === "question") {
      setQuestionItems((prev) => prev?.filter((b) => b.item_id !== id) ?? null);
    } else {
      setCaseItems((prev) => prev?.filter((b) => b.item_id !== id) ?? null);
    }
  };

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
      activeTab === tab
        ? "bg-blue-600 text-white"
        : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="px-6 pt-6 pb-16 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Bookmarks</h1>

      <div className="flex gap-2 mb-6">
        <button className={tabClass("question")} onClick={() => handleTabClick("question")}>
          Questions
        </button>
        <button className={tabClass("case")} onClick={() => handleTabClick("case")}>
          Cases
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && items !== null && (
        items.length === 0 ? (
          <p className="text-sm text-slate-500">
            {activeTab === "question"
              ? "No bookmarked questions yet."
              : "No bookmarked cases yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const doc = item.document as Record<string, string> | null;
              const displayText = activeTab === "question"
                ? (doc?.stem ?? item.item_id)
                : (doc?.title ?? item.item_id);
              const linkTo = activeTab === "question"
                ? "/questions"
                : `/cases/${item.item_id}`;
              return (
                <BookmarkRow
                  key={item.item_id}
                  item={item}
                  linkTo={linkTo}
                  displayText={displayText}
                  onRemove={handleRemove}
                />
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
