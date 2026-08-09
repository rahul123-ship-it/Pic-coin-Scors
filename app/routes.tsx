// GOAL: Define the application's root route.
// RESPONSIBILITY: Connect TanStack Router to the scanner page.
// DOES NOT: Fetch market data directly.
import { createRootRoute, createRoute } from "@tanstack/react-router";
import { ScannerPage } from "./ScannerPage";

// Create the root route that owns global application rendering.
export const rootRoute = createRootRoute({
  // Render a simple not-found message for unknown client routes.
  notFoundComponent: () => <div className="empty">Page not found.</div>,
});

// Map the home URL to the scanner feature.
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ScannerPage,
});

// Build the code-based route tree used by this MVP.
export const routeTree = rootRoute.addChildren([indexRoute]);
