import { Hono } from 'hono';

/**
 * GOAL:
 * Provide the first backend entry point for Pic-coin-Scors.
 *
 * RESPONSIBILITY:
 * - Create the Hono application.
 * - Expose a minimal health endpoint.
 *
 * DOES NOT:
 * - Connect to Delta Exchange yet.
 * - Calculate indicators yet.
 * - Access the database yet.
 */

const app = new Hono();

app.get('/api/health', (c) => {
  return c.json({ ok: true, service: 'pic-coin-scors' });
});

export default app;
