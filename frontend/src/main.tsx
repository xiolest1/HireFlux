import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { WorkspaceSessionProvider } from "./auth/WorkspaceSessionProvider";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("HireFlux could not find its root element.");
}

createRoot(root).render(
  <StrictMode>
    <WorkspaceSessionProvider>
      <RouterProvider router={router} />
    </WorkspaceSessionProvider>
  </StrictMode>,
);
