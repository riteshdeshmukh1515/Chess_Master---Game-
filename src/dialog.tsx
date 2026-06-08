import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Panel = "none" | "save" | "load" | "import" | "stats" | "about";

interface DialogCtx {
  panel: Panel;
  open: (p: Panel) => void;
  close: () => void;
}

const DialogContext = createContext<DialogCtx | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>("none");
  const open = useCallback((p: Panel) => setPanel(p), []);
  const close = useCallback(() => setPanel("none"), []);
  const value = useMemo(() => ({ panel, open, close }), [panel, open, close]);
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be inside DialogProvider");
  return ctx;
}
