import { createContext, useContext, useState, type ReactNode } from "react";
import type { SelectedAiContext } from "../api/aiApi";

interface AiContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  selectedContext: SelectedAiContext | null;
  openWithContext: (context: SelectedAiContext) => void;
  clearSelectedContext: () => void;
}

const AiContext = createContext<AiContextValue | null>(null);

export function AiContextProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState<SelectedAiContext | null>(null);

  function openWithContext(context: SelectedAiContext) {
    setSelectedContext(context);
    setOpen(true);
  }

  return (
    <AiContext.Provider
      value={{
        open,
        setOpen,
        selectedContext,
        openWithContext,
        clearSelectedContext: () => setSelectedContext(null),
      }}
    >
      {children}
    </AiContext.Provider>
  );
}

export function useAiContext() {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAiContext must be used within AiContextProvider");
  return ctx;
}
