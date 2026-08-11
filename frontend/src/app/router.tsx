import {
  createBrowserRouter,
  type RouteObject,
} from "react-router-dom";
import { DemoSessionGuard } from "../auth/DemoSessionGuard";
import { AppLayout } from "../components/AppLayout";
import { ApplicationCreatePage } from "../pages/ApplicationCreatePage";
import { ApplicationDetailPage } from "../pages/ApplicationDetailPage";
import { ApplicationEditPage } from "../pages/ApplicationEditPage";
import { ApplicationListPage } from "../pages/ApplicationListPage";
import { LandingPage } from "../pages/LandingPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RouteErrorPage } from "../pages/RouteErrorPage";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <LandingPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    element: <DemoSessionGuard />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorPage />,
        children: [
          { path: "applications", element: <ApplicationListPage /> },
          { path: "applications/new", element: <ApplicationCreatePage /> },
          {
            path: "applications/:applicationId",
            element: <ApplicationDetailPage />,
          },
          {
            path: "applications/:applicationId/edit",
            element: <ApplicationEditPage />,
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];

export const router = createBrowserRouter(appRoutes);
