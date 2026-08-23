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
  removeStoredDemoSession,
  saveDemoSession,
  type DemoSessionEventReason,
} from "./sessionStore";
import { clearManualTimeZonePreference } from "./timeZonePreference";

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

  const start = useCallback(async () => {
    setIsCreating(true);
    setError(null);
    clearManualTimeZonePreference();
    try {
      const session = await createDemoSession();
      queryClient.clear();
      clearManualTimeZonePreference();
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

  const reset = useCallback(async () => {
    const previousSession = state.session;
    setIsCreating(true);
    setError(null);
    await queryClient.cancelQueries();
    queryClient.clear();
    removeStoredDemoSession();
    setState({ session: null, status: "replacing" });
    try {
      const session = await createDemoSession();
      queryClient.clear();
      saveDemoSession(session);
      setState({ session, status: "active" });
      return session;
    } catch (creationError) {
      if (previousSession) {
        saveDemoSession(previousSession);
        setState({ session: previousSession, status: "active" });
      } else {
        setState({ session: null, status: "missing" });
      }
      queryClient.clear();
      setError(creationError);
      throw creationError;
    } finally {
      setIsCreating(false);
    }
  }, [queryClient, state.session]);

  const exit = useCallback(() => {
    queryClient.clear();
    clearManualTimeZonePreference();
    clearDemoSession("cleared");
  }, [queryClient]);

  useEffect(() => {
    function handleSessionEvent(event: Event) {
      const customEvent = event as CustomEvent<{ reason?: DemoSessionEventReason }>;
      queryClient.clear();
      clearManualTimeZonePreference();
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
      start,
      reset,
      exit,
    }),
    [error, exit, isCreating, reset, start, state],
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}
