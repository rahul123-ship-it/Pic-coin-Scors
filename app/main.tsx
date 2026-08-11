// GOAL: Bootstrap React, TanStack Router, and TanStack Query.
// RESPONSIBILITY: Create providers once and mount the route tree.
// DOES NOT: Contain feature-specific business logic.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routes";
import "./styles.css";

// Create one QueryClient for the browser session so server state is cached centrally.
const queryClient = new QueryClient();

// Create the type-safe TanStack Router from the route tree.
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  // Register the router so TanStack Router can infer route types throughout the app.
  interface Register {
    router: typeof router;
  }
}

// Find the HTML mount node created by index.html.
const rootElement = document.getElementById("root");

// Fail immediately if the HTML shell is damaged rather than silently doing nothing.
if (!rootElement) {
  throw new Error("Application root element was not found");
}

// Mount the application with strict checks and the query/router providers.
createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
