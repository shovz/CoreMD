import { useEffect, useState } from "react";
import {
  getHistory,
  deleteHistory,
  deleteSelectedHistory,
  type AttemptHistoryItem,
} from "../api/historyApi";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

export default function HistoryPage() {
  const [items, setItems] = useState<AttemptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmResetSelected, setConfirmResetSelected] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getHistory(50, 0)
      .then((res) => setItems(res.data.items))
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));
  }, []);

  const allChecked = items.length > 0 && selected.size === items.length;
  const someChecked = selected.size > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.question_id)));
    }
  };

  const toggleRow = (questionId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleConfirmReset = () => {
    deleteHistory()
      .then(() => {
        setItems([]);
        setSelected(new Set());
        setConfirmReset(false);
        setResetMessage("History reset.");
      })
      .catch(() => {
        setConfirmReset(false);
        setError("Failed to reset history.");
      });
  };

  const handleConfirmResetSelected = () => {
    deleteSelectedHistory(Array.from(selected))
      .then(() => {
        setItems((prev) => prev.filter((i) => !selected.has(i.question_id)));
        setSelected(new Set());
        setConfirmResetSelected(false);
        setResetMessage(`${selected.size} attempt(s) removed.`);
      })
      .catch(() => {
        setConfirmResetSelected(false);
        setError("Failed to reset selected history.");
      });
  };

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold text-slate-900">Question History</h1>

        <div className="flex items-center gap-3">
          {/* Reset Selected */}
          {!confirmResetSelected ? (
            <button
              disabled={selected.size === 0}
              onClick={() => {
                setResetMessage(null);
                setConfirmReset(false);
                setConfirmResetSelected(true);
              }}
              className="rounded-md border border-orange-300 px-4 py-2 text-sm font-medium text-orange-600 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset Selected ({selected.size})
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm">
              <span className="text-amber-800">
                Remove {selected.size} attempt(s)?
              </span>
              <button
                onClick={handleConfirmResetSelected}
                className="font-semibold text-red-600 hover:underline"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmResetSelected(false)}
                className="text-slate-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Reset All */}
          {!confirmReset ? (
            <button
              onClick={() => {
                setResetMessage(null);
                setConfirmResetSelected(false);
                setConfirmReset(true);
              }}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              Reset All
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm">
              <span className="text-amber-800">Are you sure? This cannot be undone.</span>
              <button
                onClick={handleConfirmReset}
                className="font-semibold text-red-600 hover:underline"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="text-slate-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {resetMessage && (
        <p className="text-sm font-medium text-green-700">{resetMessage}</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="italic text-slate-500">
          No question history yet. Start a session in the Question Bank.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Question</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr
                  key={item.attempt_id}
                  className={`hover:bg-slate-50 ${selected.has(item.question_id) ? "bg-blue-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.question_id)}
                      onChange={() => toggleRow(item.question_id)}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                      aria-label="Select row"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    {truncate(item.stem, 80)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.is_correct ? (
                      <span className="font-bold text-green-600">✓</span>
                    ) : (
                      <span className="font-bold text-red-500">✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
