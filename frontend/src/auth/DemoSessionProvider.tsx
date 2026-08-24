import { useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createDemoOperationKey, createDemoSession } from "../api/demoSessions";
import { ApiError } from "../api/client";
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

function shouldRetainOperationKey(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ["NETWORK_ERROR", "DEMO_PROVISIONING_IN_PROGRESS"].includes(error.code)
  );
}

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState(initialState);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const startKeyRef = useRef<string | null>(null);
  const resetKeyRef = useRef<string | null>(null);

  const start = useCallback(async () => {
    setIsCreating(true);
    setError(null);
    clearManualTimeZonePreference();
    const idempotencyKey = startKeyRef.current ?? createDemoOperationKey();
    startKeyRef.current = idempotencyKey;
    try {
      const session = await createDemoSession(idempotencyKey);
      queryClient.clear();
      clearManualTimeZonePreference();
      saveDemoSession(session);
      setState({ session, status: "active" });
      startKeyRef.current = null;
      return session;
    } catch (creationError) {
      if (!shouldRetainOperationKey(creationError)) startKeyRef.current = null;
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
    const idempotencyKey = resetKeyRef.current ?? createDemoOperationKey();
    resetKeyRef.current = idempotencyKey;
    try {
      const session = await createDemoSession(idempotencyKey);
      queryClient.clear();
      clearManualTimeZonePreference();
      saveDemoSession(session);
      setState({ session, status: "active" });
      resetKeyRef.current = null;
      return session;
    } catch (creationError) {
      if (!shouldRetainOperationKey(creationError)) resetKeyRef.current = null;
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

  const abandonReset = useCallback(() => {
    if (isCreating) return;
    resetKeyRef.current = null;
    setError(null);
  }, [isCreating]);

  const exit = useCallback(() => {
    queryClient.clear();
    clearManualTimeZonePreference();
    startKeyRef.current = null;
    resetKeyRef.current = null;
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
      abandonReset,
      exit,
    }),
    [abandonReset, error, exit, isCreating, reset, start, state],
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}
