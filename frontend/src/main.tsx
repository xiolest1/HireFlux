import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { queryClient } from "./app/queryClient";
import { router } from "./app/router";
import { DemoSessionProvider } from "./auth/DemoSessionProvider";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("HireFlux could not find its root element.");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DemoSessionProvider>
        <RouterProvider router={router} />
      </DemoSessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
