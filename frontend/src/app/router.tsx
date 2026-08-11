import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { ApplicationCreatePage } from "../pages/ApplicationCreatePage";
import { ApplicationDetailPage } from "../pages/ApplicationDetailPage";
import { ApplicationEditPage } from "../pages/ApplicationEditPage";
import { ApplicationListPage } from "../pages/ApplicationListPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RouteErrorPage } from "../pages/RouteErrorPage";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/applications" replace /> },
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
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
