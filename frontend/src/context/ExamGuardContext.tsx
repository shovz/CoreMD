import { createContext, useContext, useState, type ReactNode } from "react";

type PendingAction = "navigate" | "reload_exams";

interface ExamGuardContextValue {
  examRunning: boolean;
  setExamRunning: (running: boolean) => void;
  pendingPath: string | null;
  pendingAction: PendingAction | null;
  modalOpen: boolean;
  examsReloadToken: number;
  triggerExamsReload: () => void;
  requestNavigation: (path: string, action?: PendingAction) => boolean;
  confirmNavigation: () => { path: string | null; action: PendingAction | null };
  cancelNavigation: () => void;
}

const ExamGuardContext = createContext<ExamGuardContextValue | null>(null);

export function ExamGuardProvider({ children }: { children: ReactNode }) {
  const [examRunning, setExamRunning] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [examsReloadToken, setExamsReloadToken] = useState(0);
  const triggerExamsReload = () => setExamsReloadToken((prev) => prev + 1);

  const requestNavigation = (path: string, action: PendingAction = "navigate") => {
    if (!examRunning) return true;
    setPendingPath(path);
    setPendingAction(action);
    setModalOpen(true);
    return false;
  };

  const confirmNavigation = () => {
    const path = pendingPath;
    const action = pendingAction;
    setModalOpen(false);
    setPendingPath(null);
    setPendingAction(null);
    if (action === "reload_exams") triggerExamsReload();
    return { path, action };
  };

  const cancelNavigation = () => {
    setModalOpen(false);
    setPendingPath(null);
    setPendingAction(null);
  };

  return (
    <ExamGuardContext.Provider
      value={{
        examRunning,
        setExamRunning,
        pendingPath,
        pendingAction,
        modalOpen,
        examsReloadToken,
        triggerExamsReload,
        requestNavigation,
        confirmNavigation,
        cancelNavigation,
      }}
    >
      {children}
    </ExamGuardContext.Provider>
  );
}

export function useExamGuard() {
  const ctx = useContext(ExamGuardContext);
  if (!ctx) throw new Error("useExamGuard must be used within ExamGuardProvider");
  return ctx;
}
