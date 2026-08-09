// GOAL: Assemble the HTTP application without coupling it to a deployment runtime.
// RESPONSIBILITY: Expose health and scanner routes and safe error responses.
// DOES NOT: Render React or calculate indicators directly.
import { Hono } from "hono";
import { scannerRoute } from "./routes/scanner";

// Create one application object so local development and Workers share the same routes.
export const app = new Hono();

// Provide a cheap endpoint for local and production health checks.
app.get("/api/health", (context) =>
  context.json({
    ok: true,
    service: "pic-coin-scors",
    time: new Date().toISOString(),
  }),
);

// Mount the scanner API under the documented application namespace.
app.route("/api/scanner", scannerRoute);

// Convert unexpected server errors into a safe JSON response.
app.onError((error, context) => {
  // Log the real error server-side for debugging.
  console.error(error);

  // Never expose stack traces or provider secrets to clients.
  return context.json({ success: false, error: "Internal scanner error" }, 500);
});

// Export the Fetch-compatible handler used by Cloudflare Workers.
export default app;
