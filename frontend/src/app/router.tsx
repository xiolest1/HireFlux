import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { DemoSessionGuard } from "../auth/DemoSessionGuard";
import { AppLayout } from "../components/AppLayout";
import { DocumentTitle } from "../components/DocumentTitle";
import { LoadingState } from "../components/ui/Feedback";
import { LandingPage } from "../pages/LandingPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RouteErrorPage } from "../pages/RouteErrorPage";

const DashboardPage = lazy(() => import("../pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ApplicationListPage = lazy(() => import("../pages/ApplicationListPage").then((module) => ({ default: module.ApplicationListPage })));
const ApplicationCreatePage = lazy(() => import("../pages/ApplicationCreatePage").then((module) => ({ default: module.ApplicationCreatePage })));
const ApplicationDetailPage = lazy(() => import("../pages/ApplicationDetailPage").then((module) => ({ default: module.ApplicationDetailPage })));
const ApplicationEditPage = lazy(() => import("../pages/ApplicationEditPage").then((module) => ({ default: module.ApplicationEditPage })));
const InterviewsPage = lazy(() => import("../pages/InterviewsPage").then((module) => ({ default: module.InterviewsPage })));
const AnalyticsPage = lazy(() => import("../pages/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const SettingsPage = lazy(() => import("../pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

function privatePage(page: ReactNode, label: string) {
  return <Suspense fallback={<LoadingState label={label} />}>{page}</Suspense>;
}

function titledPage(title: string, page: ReactNode) {
  return <DocumentTitle title={title}>{page}</DocumentTitle>;
}

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: titledPage("Demo workspace", <LandingPage />),
    errorElement: <RouteErrorPage />,
  },
  {
    element: <DemoSessionGuard />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorPage />,
        children: [
          { path: "dashboard", element: privatePage(<DashboardPage />, "Loading dashboard…") },
          { path: "applications", element: privatePage(<ApplicationListPage />, "Loading applications…") },
          { path: "applications/new", element: privatePage(<ApplicationCreatePage />, "Loading application form…") },
          {
            path: "applications/:applicationId",
            element: privatePage(<ApplicationDetailPage />, "Loading application…"),
          },
          {
            path: "applications/:applicationId/edit",
            element: privatePage(<ApplicationEditPage />, "Loading application form…"),
          },
          { path: "interviews", element: privatePage(<InterviewsPage />, "Loading interviews…") },
          { path: "analytics", element: privatePage(<AnalyticsPage />, "Loading analytics…") },
          { path: "settings", element: privatePage(<SettingsPage />, "Loading settings…") },
        ],
      },
    ],
  },
  { path: "*", element: titledPage("Page not found", <NotFoundPage />) },
];

export const router = createBrowserRouter(appRoutes);
