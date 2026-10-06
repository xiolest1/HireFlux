import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  RouterProvider,
  type InitialEntry,
} from "react-router-dom";
import { createQueryClient } from "../app/queryClient";
import { appRoutes } from "../app/router";
import { WorkspaceSessionProvider } from "../auth/WorkspaceSessionProvider";
import { WorkspaceSessionController } from "../auth/workspaceSessionController";
import { createDemoAdapter, type SessionAdapter } from "../auth/sessionAdapters";
import type { DemoSession } from "../api/schemas";
import { clearDemoSession, saveDemoSession } from "../auth/sessionStore";
import {
  clearManualTimeZonePreference,
  markManualTimeZonePreference,
} from "../auth/timeZonePreference";

const testSession = {
  access_token: "test.demo.session.token.that.is.long.enough",
  token_type: "Bearer" as const,
  expires_at: "2099-08-11T12:00:00Z",
};

export function renderApp(
  initialEntry: InitialEntry = "/applications",
  options: { withSession?: boolean; autoDetectTimeZone?: boolean; session?: DemoSession; adapter?: SessionAdapter; controller?: WorkspaceSessionController } = {},
) {
  if (options.autoDetectTimeZone) clearManualTimeZonePreference();
  else markManualTimeZonePreference();
  if (options.withSession === false) {
    clearDemoSession();
  } else {
    saveDemoSession(options.session ?? testSession);
  }
  const clientFactory = () => {
    const client = createQueryClient();
    client.setDefaultOptions({
    queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    mutations: { retry: false },
    });
    return client;
  };
  const controller = options.controller ?? new WorkspaceSessionController(options.adapter ?? createDemoAdapter(), clientFactory);
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [initialEntry],
  });
  const result = render(
      <WorkspaceSessionProvider controller={controller}>
        <RouterProvider router={router} />
      </WorkspaceSessionProvider>,
  );

  return {
    ...result,
    queryClient: controller.getSnapshot().queryClient,
    controller,
    router,
    user: userEvent.setup(),
  };
}
