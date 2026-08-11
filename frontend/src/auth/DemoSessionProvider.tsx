import { useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createDemoSession } from "../api/demoSessions";
import type { DemoSession } from "../api/schemas";
import {
  DemoSessionContext,
  type DemoSessionContextValue,
  type SessionStatus,
} from "./demoSessionContext";
import {
  clearDemoSession,
  DEMO_SESSION_EVENT,
  loadDemoSession,
  saveDemoSession,
  type DemoSessionEventReason,
} from "./sessionStore";

function initialState(): { session: DemoSession | null; status: SessionStatus } {
  const loaded = loadDemoSession();
  return {
    session: loaded.session,
    status: loaded.session ? "active" : loaded.expired ? "expired" : "missing",
  };
}

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState(initialState);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const createAndActivate = useCallback(async () => {
    setIsCreating(true);
    setError(null);
    try {
      const session = await createDemoSession();
      queryClient.clear();
      saveDemoSession(session);
      setState({ session, status: "active" });
      return session;
    } catch (creationError) {
      setError(creationError);
      throw creationError;
    } finally {
      setIsCreating(false);
    }
  }, [queryClient]);

  const exit = useCallback(() => {
    clearDemoSession("cleared");
  }, []);

  useEffect(() => {
    function handleSessionEvent(event: Event) {
      const customEvent = event as CustomEvent<{ reason?: DemoSessionEventReason }>;
      queryClient.clear();
      setState({
        session: null,
        status: customEvent.detail?.reason === "expired" ? "expired" : "missing",
      });
    }
    window.addEventListener(DEMO_SESSION_EVENT, handleSessionEvent);
    return () => window.removeEventListener(DEMO_SESSION_EVENT, handleSessionEvent);
  }, [queryClient]);

  useEffect(() => {
    if (!state.session) return;
    const remaining = new Date(state.session.expires_at).getTime() - Date.now();
    if (remaining <= 0) {
      clearDemoSession("expired");
      return;
    }
    const timeout = window.setTimeout(
      () => clearDemoSession("expired"),
      Math.min(remaining, 2_147_483_647),
    );
    return () => window.clearTimeout(timeout);
  }, [state.session]);

  const value = useMemo<DemoSessionContextValue>(
    () => ({
      ...state,
      isCreating,
      error,
      start: createAndActivate,
      reset: createAndActivate,
      exit,
    }),
    [createAndActivate, error, exit, isCreating, state],
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}
