import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  RouterProvider,
  type InitialEntry,
} from "react-router-dom";
import { createQueryClient } from "../app/queryClient";
import { appRoutes } from "../app/router";
import { DemoSessionProvider } from "../auth/DemoSessionProvider";
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
  options: { withSession?: boolean; autoDetectTimeZone?: boolean; session?: DemoSession } = {},
) {
  if (options.autoDetectTimeZone) clearManualTimeZonePreference();
  else markManualTimeZonePreference();
  if (options.withSession === false) {
    clearDemoSession();
  } else {
    saveDemoSession(options.session ?? testSession);
  }
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    mutations: { retry: false },
  });
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [initialEntry],
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <DemoSessionProvider>
        <RouterProvider router={router} />
      </DemoSessionProvider>
    </QueryClientProvider>,
  );

  return {
    ...result,
    queryClient,
    router,
    user: userEvent.setup(),
  };
}
