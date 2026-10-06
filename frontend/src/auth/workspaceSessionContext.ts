import { createContext, useCallback, useContext, useEffect } from "react";
import { useNavigate, type NavigateOptions, type To } from "react-router-dom";
import type { WorkspaceSessionController, WorkspaceSessionState } from "./workspaceSessionController";

export const WorkspaceSessionContext = createContext<{
  state: WorkspaceSessionState;
  controller: WorkspaceSessionController;
} | null>(null);

export function useWorkspaceSession() {
  const context = useContext(WorkspaceSessionContext);
  if (!context) throw new Error("WorkspaceSessionProvider is required.");
  return context;
}

export function useWorkspaceScope() { return useWorkspaceSession().state.scope; }

export function useWorkspaceUnsavedChanges(dirty: boolean): void {
  const { state, controller } = useWorkspaceSession();
  useEffect(() => {
    if (dirty) return controller.registerUnsaved(state.scope);
  }, [controller, dirty, state.scope]);
}

export function useWorkspaceNavigate() {
  const { state } = useWorkspaceSession();
  const navigate = useNavigate();
  return useCallback((to: To, options?: NavigateOptions) => {
    if (state.scope.isCurrent()) return navigate(to, options);
  }, [navigate, state.scope]);
}
