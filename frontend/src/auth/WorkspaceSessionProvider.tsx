import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { WorkspaceSessionContext } from "./workspaceSessionContext";
import { WorkspaceSessionController } from "./workspaceSessionController";

export function WorkspaceSessionProvider({ children, controller: supplied }: {
  children: ReactNode;
  controller?: WorkspaceSessionController;
}) {
  const [controller] = useState(() => supplied ?? new WorkspaceSessionController());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    void controller.initialize();
    return () => { queueMicrotask(controller.disposeIfUnused); };
  }, [controller]);

  useEffect(() => {
    if (state.status === "ready") return controller.observeReadySession(state);
  }, [controller, state]);

  return (
    <WorkspaceSessionContext.Provider value={{ state, controller }}>
      <QueryClientProvider client={state.queryClient}>{children}</QueryClientProvider>
    </WorkspaceSessionContext.Provider>
  );
}
