// GOAL: Provide the Cloudflare Worker entry point.
// RESPONSIBILITY: Expose the Hono Fetch handler to the Worker runtime.
// DOES NOT: Contain business logic.
import app from "./app";

// Cloudflare calls this Fetch handler for every incoming request.
export default app;
