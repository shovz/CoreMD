import { useEffect, useState } from "react";
import { getHistory, deleteHistory, type AttemptHistoryItem } from "../api/historyApi";

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
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    getHistory(50, 0)
      .then((res) => setItems(res.data.items))
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));
  }, []);

  const handleConfirmReset = () => {
    deleteHistory()
      .then(() => {
        setItems([]);
        setConfirmReset(false);
        setResetMessage("History reset.");
      })
      .catch(() => {
        setConfirmReset(false);
        setError("Failed to reset history.");
      });
  };

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Question History</h1>

        {!confirmReset ? (
          <button
            onClick={() => {
              setResetMessage(null);
              setConfirmReset(true);
            }}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Reset History
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

      {resetMessage && (
        <p className="text-sm font-medium text-green-700">{resetMessage}</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-slate-200"
            />
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
                <th className="px-4 py-3 text-left font-medium text-slate-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Question</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.attempt_id} className="hover:bg-slate-50">
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
