import { createContext, useContext } from "react";
import type { DemoSession } from "../api/schemas";

export type SessionStatus = "active" | "missing" | "expired" | "replacing";

export interface DemoSessionContextValue {
  session: DemoSession | null;
  status: SessionStatus;
  isCreating: boolean;
  error: unknown;
  start: () => Promise<DemoSession>;
  reset: () => Promise<DemoSession>;
  abandonReset: () => void;
  exit: () => void;
}

export const DemoSessionContext = createContext<DemoSessionContextValue | null>(
  null,
);

export function useDemoSession(): DemoSessionContextValue {
  const context = useContext(DemoSessionContext);
  if (!context) {
    throw new Error("useDemoSession must be used within DemoSessionProvider.");
  }
  return context;
}
