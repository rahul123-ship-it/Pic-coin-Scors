# Architecture

## Goal

Pic-coin-Scors is a market-analysis system, not an order-execution system.

Its first responsibility is to answer:

> Which Delta Exchange markets are currently trending strongly enough to deserve attention?

Only after market selection is complete should the system evaluate the 15m → 5m → 3m setup for the 9/15 EMA strategy.

## System boundaries

```text
┌──────────────────────────────────────────────────────────────┐
│ React / TanStack Start                                      │
│ Router · Query · Table · Jotai · Tailwind · shadcn          │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS / typed API
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Application Server                                          │
│ Hono on Cloudflare Worker                                  │
│ auth · routes · validation · orchestration · errors         │
└───────────────┬───────────────────────────────┬──────────────┘
                │                               │
                ▼                               ▼
┌──────────────────────────────┐    ┌──────────────────────────┐
│ Delta Market Gateway         │    │ Core Analysis Engine     │
│ REST · ticker · candles      │    │ Pure TypeScript          │
│ WebSocket / streaming        │    │                          │
│ exchange → domain models     │    │ indicators               │
└──────────────┬───────────────┘    │ structure                │
               │                    │ trend scoring            │
               │                    │ reversal detection       │
               │                    │ strategy evaluation      │
               │                    └─────────────┬────────────┘
               │                                  │
               └──────────────────┬───────────────┘
                                  ▼
                    ┌──────────────────────────┐
                    │ Persistence / Cache      │
                    │ PostgreSQL / Supabase    │
                    │ Cloudflare KV            │
                    │ Cloudflare R2            │
                    │ Hyperdrive → PostgreSQL  │
                    └──────────────────────────┘
```

## Request path

```text
Browser
  ↓
TanStack Query
  ↓
Hono /api/scanner
  ↓
market snapshot / cache
  ↓
trend engine
  ↓
scanner result DTO
  ↓
TanStack Query cache
  ↓
TanStack Table
```

The browser never receives Delta API secrets.

## Market-data path

```text
Delta REST
  ├── instruments
  ├── ticker
  └── historical candles

Delta WebSocket (where the selected deployment model supports it)
  └── live market/candle updates
          ↓
     Delta adapter
          ↓
  normalized domain models
          ↓
   cache / persistence
          ↓
   indicator calculations
          ↓
      trend engine
```

Only `server/services/delta/` knows Delta-specific endpoints, fields, authentication/signing, and provider message formats.

If a persistent outbound WebSocket cannot be operated reliably in the selected Cloudflare model, use scheduled REST candle updates as the fallback. The core engine must never depend on a permanent socket.

## Core-engine boundary

```text
core/
├── indicators/
├── structure/
├── trend/
└── strategy/
```

Core code:

- accepts plain TypeScript domain objects;
- returns deterministic values;
- has no React imports;
- has no Hono imports;
- has no Cloudflare bindings;
- has no database access;
- has no Delta Exchange API calls.

This makes the engine unit-testable and reusable for historical backtests.

## Trend pipeline

```text
All supported Delta markets
          ↓
Market eligibility
          ↓
Enough candle history?
          ↓
Activity / volatility filter
          ↓
Trending or ranging?
          ↓
Trend direction
          ↓
Trend strength score
          ↓
Top trending markets
          ↓
15m context
          ↓
5m setup
          ↓
3m confirmation
          ↓
9/15 EMA strategy result
```

This separation is fundamental: **market selection is not trade entry**.

## Trend engine

The trend engine answers three independent questions:

1. **Is the market trending?** Use directional movement, volatility, moving-average separation, price structure, and relative activity. ADX is evidence, not the complete definition.
2. **Which direction?** Classify bullish, bearish, or neutral from structure and directional evidence.
3. **How strong?** Return a bounded, explainable score with component contributions.

No single indicator should be presented as a definitive prediction.

## Multi-timeframe responsibility

```text
15m = CONTEXT
  ↓
5m  = SETUP
  ↓
3m  = CONFIRMATION
```

15m determines the dominant environment. 5m determines whether a usable setup is developing. 3m provides optional entry confirmation and cannot override an invalid higher-timeframe context.

## Strategy boundary

The strategy engine consumes normalized analysis data. It does not fetch candles or decide which markets exist.

```text
Trend Engine
      ↓
Structure Engine
      ↓
Strategy Engine
      ├── EMA 9
      ├── EMA 15
      ├── candle-close confirmation
      ├── timeframe alignment
      ├── activity / volatility
      └── invalidation context
      ↓
Signal candidate
```

A signal candidate is an analytical result, never an order.

## Database architecture

Supabase provides PostgreSQL.

- **Prisma:** migrations and controlled schema/table management.
- **Drizzle:** only for relational application operations where its ORM model gives a clear benefit.
- **Kysely:** primary typed SQL/query layer for scanner and analytical queries.

These tools must not all own the same database operation. Each query path has one explicit owner.

Hyperdrive is the Worker-side database connectivity layer when it is used in production.

## Cache architecture

### Cloudflare KV

Use for small, frequently read, replaceable values:

- current scanner snapshots;
- market metadata caches;
- short-lived calculation results;
- feature/configuration values.

KV is not the source of truth for historical market data.

### Cloudflare R2

Use for object-style storage:

- exported datasets;
- archived research files;
- large backtest artifacts.

### PostgreSQL

Use for durable relational state:

- instruments/markets;
- selected historical data;
- trend snapshots;
- signal candidates;
- users and sessions where appropriate;
- application history.

## Authentication boundary

Better Auth is added after the anonymous scanner works.

```text
Browser
  ↓
Better Auth
  ↓
Session
  ↓
Hono auth middleware
  ↓
Protected API
```

Authentication never enters the indicator or strategy layer.

## Cloudflare boundary

Cloudflare is infrastructure, not trading logic.

```text
TanStack Start / React
          ↓
Hono application
          ↓
Cloudflare Worker
          ├── KV
          ├── R2
          └── Hyperdrive
                    ↓
                PostgreSQL
```

Alchemy IaC owns infrastructure definitions and deployment configuration. It does not contain trading calculations.

## Dependency direction

```text
UI
 ↓
Features
 ↓
API routes
 ↓
Services
 ↓
Core
```

`core` must never import upward into `server`, `features`, or `components`.

Database access stays behind `db/` and server-side service boundaries.

## Error handling

Classify errors at the boundary where they occur:

- exchange/network → provider error;
- validation → API validation error;
- database → persistence error;
- calculation → domain/calculation error;
- unexpected → internal error.

Client responses contain safe error DTOs. Secrets, credentials, raw authenticated provider payloads, and stack traces never reach the browser.

## Observability

Important market-data and scanner operations should log structured fields such as:

- correlation/request ID;
- symbol;
- timeframe;
- operation;
- latency;
- status;
- provider error code.

Never log secrets.

## Testing architecture

```text
Unit
 ├── indicators
 ├── structure
 ├── trend scoring
 └── strategy rules

Integration
 ├── Delta adapter
 ├── Hono API
 └── database queries

End-to-end
 └── scanner user flow
```

The most important tests are deterministic tests around the core engine. A market-analysis rule that cannot be tested against fixed candle fixtures is incomplete.
