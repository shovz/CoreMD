import { createContext, useContext, useState, type ReactNode } from "react";

interface AiContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  prefillText: string;
  openWithText: (text: string) => void;
  clearPrefill: () => void;
}

const AiContext = createContext<AiContextValue | null>(null);

export function AiContextProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefillText, setPrefillText] = useState("");

  function openWithText(text: string) {
    setPrefillText(`Regarding: "${text}" — `);
    setOpen(true);
  }

  return (
    <AiContext.Provider
      value={{ open, setOpen, prefillText, openWithText, clearPrefill: () => setPrefillText("") }}
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
