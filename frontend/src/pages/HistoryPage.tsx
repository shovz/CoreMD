import { useEffect, useState } from "react";
import {
  getHistory,
  deleteHistory,
  deleteSelectedHistory,
  getCaseHistory,
  deleteCaseHistory,
  deleteSelectedCaseHistory,
  type AttemptHistoryItem,
  type CaseHistoryItem,
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
  const [activeTab, setActiveTab] = useState<"questions" | "cases">("questions");

  // --- Questions tab state ---
  const [items, setItems] = useState<AttemptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmResetSelected, setConfirmResetSelected] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- Cases tab state ---
  const [cItems, setCItems] = useState<CaseHistoryItem[]>([]);
  const [cLoaded, setCLoaded] = useState(false);
  const [cLoading, setCLoading] = useState(false);
  const [cError, setCError] = useState<string | null>(null);
  const [cConfirmReset, setCConfirmReset] = useState(false);
  const [cConfirmResetSelected, setCConfirmResetSelected] = useState(false);
  const [cResetMessage, setCResetMessage] = useState<string | null>(null);
  const [cSelected, setCSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getHistory(50, 0)
      .then((res) => setItems(res.data.items))
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "cases" && !cLoaded) {
      setCLoading(true);
      getCaseHistory(50, 0)
        .then((res) => {
          setCItems(res.data.items);
          setCLoaded(true);
        })
        .catch(() => setCError("Failed to load case history."))
        .finally(() => setCLoading(false));
    }
  }, [activeTab, cLoaded]);

  // --- Questions tab logic ---
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

  // --- Cases tab logic ---
  const uniqueCaseIds = Array.from(new Set(cItems.map((i) => i.case_id)));
  const cAllChecked = uniqueCaseIds.length > 0 && cSelected.size === uniqueCaseIds.length;
  const cSomeChecked = cSelected.size > 0 && !cAllChecked;

  const toggleCAll = () => {
    if (cAllChecked) {
      setCSelected(new Set());
    } else {
      setCSelected(new Set(uniqueCaseIds));
    }
  };

  const toggleCRow = (caseId: string) => {
    setCSelected((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  };

  const handleConfirmCReset = () => {
    deleteCaseHistory()
      .then(() => {
        setCItems([]);
        setCSelected(new Set());
        setCConfirmReset(false);
        setCResetMessage("Case history reset.");
      })
      .catch(() => {
        setCConfirmReset(false);
        setCError("Failed to reset case history.");
      });
  };

  const handleConfirmCResetSelected = () => {
    const ids = Array.from(cSelected);
    deleteSelectedCaseHistory(ids)
      .then(() => {
        setCItems((prev) => prev.filter((i) => !cSelected.has(i.case_id)));
        setCSelected(new Set());
        setCConfirmResetSelected(false);
        setCResetMessage(`${ids.length} case(s) removed.`);
      })
      .catch(() => {
        setCConfirmResetSelected(false);
        setCError("Failed to reset selected case history.");
      });
  };

  return (
    <div className="px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">History</h1>

      {/* Tab toggle */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        <button
          onClick={() => setActiveTab("questions")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            activeTab === "questions"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Questions
        </button>
        <button
          onClick={() => setActiveTab("cases")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            activeTab === "cases"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Cases
        </button>
      </div>

      {activeTab === "questions" ? (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
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
                  <span className="text-amber-800">Remove {selected.size} attempt(s)?</span>
                  <button onClick={handleConfirmResetSelected} className="font-semibold text-red-600 hover:underline">
                    Confirm
                  </button>
                  <button onClick={() => setConfirmResetSelected(false)} className="text-slate-500 hover:underline">
                    Cancel
                  </button>
                </div>
              )}

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
                  <button onClick={handleConfirmReset} className="font-semibold text-red-600 hover:underline">
                    Confirm
                  </button>
                  <button onClick={() => setConfirmReset(false)} className="text-slate-500 hover:underline">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {resetMessage && <p className="text-sm font-medium text-green-700">{resetMessage}</p>}
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
                        ref={(el) => { if (el) el.indeterminate = someChecked; }}
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
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(item.created_at)}</td>
                      <td className="px-4 py-3 text-slate-800">{truncate(item.stem, 80)}</td>
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
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {!cConfirmResetSelected ? (
                <button
                  disabled={cSelected.size === 0}
                  onClick={() => {
                    setCResetMessage(null);
                    setCConfirmReset(false);
                    setCConfirmResetSelected(true);
                  }}
                  className="rounded-md border border-orange-300 px-4 py-2 text-sm font-medium text-orange-600 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset Selected ({cSelected.size})
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm">
                  <span className="text-amber-800">Remove {cSelected.size} case(s)?</span>
                  <button onClick={handleConfirmCResetSelected} className="font-semibold text-red-600 hover:underline">
                    Confirm
                  </button>
                  <button onClick={() => setCConfirmResetSelected(false)} className="text-slate-500 hover:underline">
                    Cancel
                  </button>
                </div>
              )}

              {!cConfirmReset ? (
                <button
                  onClick={() => {
                    setCResetMessage(null);
                    setCConfirmResetSelected(false);
                    setCConfirmReset(true);
                  }}
                  className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Reset All
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm">
                  <span className="text-amber-800">Are you sure? This cannot be undone.</span>
                  <button onClick={handleConfirmCReset} className="font-semibold text-red-600 hover:underline">
                    Confirm
                  </button>
                  <button onClick={() => setCConfirmReset(false)} className="text-slate-500 hover:underline">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {cResetMessage && <p className="text-sm font-medium text-green-700">{cResetMessage}</p>}
          {cError && <p className="text-sm text-red-600">{cError}</p>}

          {cLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200" />
              ))}
            </div>
          ) : cItems.length === 0 ? (
            <p className="italic text-slate-500">
              No case history yet. Try a case study to get started.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="w-10 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={cAllChecked}
                        ref={(el) => { if (el) el.indeterminate = cSomeChecked; }}
                        onChange={toggleCAll}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Case</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-500">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cItems.map((item) => (
                    <tr
                      key={item.attempt_id}
                      className={`hover:bg-slate-50 ${cSelected.has(item.case_id) ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={cSelected.has(item.case_id)}
                          onChange={() => toggleCRow(item.case_id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                          aria-label="Select row"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(item.created_at)}</td>
                      <td className="px-4 py-3 text-slate-800">{truncate(item.case_title, 80)}</td>
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
        </>
      )}
    </div>
  );
}
