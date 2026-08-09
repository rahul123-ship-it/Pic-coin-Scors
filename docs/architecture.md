# Architecture

The application is intentionally split into four layers:

1. `server/` — exchange/API/infrastructure boundary.
2. `core/` — pure market-analysis and strategy logic.
3. `db/` — persistence.
4. `app/` and `components/` — UI.

The core layer must not know about React, Hono, Cloudflare, or Delta Exchange.
