# Development Plan

The project is built in vertical slices. Every phase must leave the repository runnable, testable, and understandable.

## Phase 0 — Architecture and Rules

**Goal:** Freeze boundaries before implementation grows.

Deliverables:
- application architecture;
- dependency direction;
- file responsibilities;
- environment/secret policy;
- market-analysis terminology;
- development conventions.

Exit criteria:
- architecture reviewed;
- no business logic depends on React, Hono, Cloudflare, or Delta;
- every future module has an obvious owner.

## Phase 1 — Real Application Shell

**Goal:** Run a real TanStack Start application locally before connecting market data.

Build:
- React + TypeScript;
- TanStack Start;
- TanStack Router;
- Vite;
- Tailwind CSS v4;
- shadcn/ui;
- TanStack Query provider;
- TanStack Table foundation;
- Jotai state conventions;
- Hono application entry;
- `/api/health` endpoint;
- error/logging foundation;
- environment validation;
- development scripts.

Initial pages:

```text
/
/scanner
/markets
/markets/:symbol
```

Exit criteria:
- `npm run dev` starts;
- browser renders the home page;
- `/api/health` returns a typed response;
- typecheck and lint pass;
- no exchange credentials are required.

## Phase 2 — Domain Model First

**Goal:** Define the internal language before writing Delta-specific code.

Create types for Market, Instrument, Candle, Timeframe, Ticker, volume statistics, indicator values, market structure, trend state/score, reversal state, strategy setup, signal candidate, and API DTOs.

Exit criteria:
- core modules use domain types;
- Delta response objects never leak into `core/`;
- fixtures work without the Delta API.

## Phase 3 — Delta Exchange Adapter

**Goal:** Connect real Delta Exchange data without coupling the core engine to Delta.

Implement:
- instrument discovery;
- market eligibility;
- ticker retrieval;
- historical candles;
- authentication/signing where required;
- provider error handling;
- response normalization;
- WebSocket adapter where supported by the deployment model.

Only the Delta adapter knows provider endpoints, fields, signing, and message formats.

Exit criteria:
- real instruments can be fetched;
- real candles can be fetched;
- normalized domain objects are returned;
- provider failures are safely handled.

## Phase 4 — Historical Candle Pipeline

**Goal:** Establish reliable candle data before real-time scanning.

Build validation, timeframe normalization, chronological ordering, duplicate handling, missing-candle detection, historical fetching, an in-memory development store, and deterministic fixtures.

Initial timeframes: `3m`, `5m`, `15m`.

Exit criteria:
- clean candle series exist for all three timeframes;
- indicators receive deterministic ordered data.

## Phase 5 — Indicator Engine

**Goal:** Implement indicators as pure, independently testable functions.

Initial indicators:
- EMA 9;
- EMA 15;
- EMA 200;
- ADX 14;
- ATR 14;
- RSI 14;
- relative volume / RVOL;
- moving-average separation;
- volatility/activity metrics.

Rules: no API calls, database calls, framework imports, or global mutable state.

Exit criteria:
- tests cover normal, edge, insufficient-data, and flat-market cases;
- known fixture values are verified;
- calculations are deterministic.

## Phase 6 — Market Structure Engine

**Goal:** Turn candles into interpretable price structure.

Implement swing highs/lows, higher highs/lows, lower highs/lows, continuation, break of structure, structure failure, and transition candidates.

Exit criteria:
- structure is reproducible from fixed fixtures;
- repainting assumptions are documented;
- bullish, bearish, ranging, and transition cases are tested.

## Phase 7 — Trend Detection Engine

**Goal:** Answer the project's primary question: which coins are actually trending?

Evaluate directional movement, ADX strength, EMA alignment, EMA separation, price location relative to a longer trend reference, market structure, volatility/activity, relative volume, and recent directional movement.

Output:

```text
trendState: TRENDING | RANGING | TRANSITION
trendDirection: BULLISH | BEARISH | NEUTRAL
trendScore: 0..100
confidence: 0..1
reasons: string[]
```

The score must be explainable. No opaque single-indicator decision is presented as a definitive signal.

Exit criteria:
- fixture markets can be ranked;
- obvious ranges are separated from trends;
- bullish and bearish trends are distinguished;
- score components are visible for debugging.

## Phase 8 — Multi-Timeframe Trend Engine

**Goal:** Combine 15m, 5m, and 3m without allowing lower-timeframe noise to override context.

```text
15m → CONTEXT
5m  → SETUP
3m  → CONFIRMATION
```

Implement 15m dominant trend, 5m alignment/misalignment, 3m momentum confirmation, timeframe conflict state, alignment score, and transition state.

Exit criteria:
- the system explains whether timeframes agree or conflict;
- one noisy 3m candle cannot invalidate a clearly valid 15m context.

## Phase 9 — Reversal Engine

**Goal:** Turn reversal intuition into explicit, testable rules.

Evaluate trend exhaustion, momentum loss, weakening EMA separation, structure breaks, failed continuation, lower highs after uptrends, higher lows after downtrends, activity changes, and higher-timeframe transition.

Output:

```text
NO_REVERSAL
REVERSAL_WATCH
REVERSAL_CONFIRMED
```

Exit criteria:
- reversal logic is rule-based;
- false positives are explicitly tested;
- pullbacks are distinguished from structural reversals.

## Phase 10 — 9/15 EMA Strategy Engine

**Goal:** Apply the user's strategy only after market selection and trend context exist.

Sequence:
1. Evaluate 15m context.
2. Evaluate 5m setup.
3. Optionally use 3m confirmation.
4. Require confirmed candle close.
5. Detect fresh 9/15 EMA crossover.
6. Check trend alignment.
7. Check activity/volatility.
8. Check market structure.
9. Produce invalidation context.

**Rule:** A 9/15 crossover alone is never a complete signal.

Exit criteria:
- strategy results are deterministic;
- long/short rules are explicit;
- invalidation conditions are explicit;
- fixed fixtures cover strategy behavior.

## Phase 11 — Scanner API

**Goal:** Expose the analysis engine through stable API contracts.

```text
GET /api/health
GET /api/markets
GET /api/markets/:symbol
GET /api/scanner
GET /api/signals
```

Scanner response includes symbol, price, trend state/direction, score, ADX, RVOL, EMA state, structure state, timeframe alignment, reversal state, strategy state, reasons, and timestamp.

Exit criteria:
- responses are typed and validated;
- provider failures become safe API errors;
- secrets never appear in responses.

## Phase 12 — Scanner UI

**Goal:** Build the dashboard that solves the original problem.

Main table:

```text
Rank | Coin | Direction | Trend | ADX | RVOL | 9/15 | Reversal | Score
```

Add timeframe filters, direction filters, minimum score, trending-only mode, sorting, search, and loading/error/empty states.

Exit criteria:
- top trending markets are immediately visible;
- each score has an explainable detail view.

## Phase 13 — Market Detail and Charts

**Goal:** Show why a market ranked highly.

Display price/candles, EMA 9/15/200, volume, score components, market structure, 15m/5m/3m alignment, reversal state, and strategy state.

Exit criteria:
- chart and scanner data agree;
- timeframe switching is deterministic;
- UI components do not calculate indicators.

## Phase 14 — Persistence and Database

**Goal:** Persist only durable data needed by product and research workflows.

Supabase provides PostgreSQL.

- **Prisma:** schema, migrations, controlled table management.
- **Kysely:** primary typed SQL/query layer for scanner and analytical queries.
- **Drizzle:** optional; introduce only where its ORM model has a clear benefit.

Do not create three competing query layers for the same operation.

Initial entities: markets, selected candle/history data, trend snapshots, signal candidates, and Better Auth records as required.

Exit criteria:
- migrations are reproducible;
- `core/` has no database dependency;
- historical scanner snapshots are queryable.

## Phase 15 — Cache and Real-Time Updates

**Goal:** Improve responsiveness without making cache the source of truth.

KV handles short-lived scanner snapshots, market metadata, and replaceable calculation results.

R2 handles exports and large research/backtest artifacts.

Delta WebSocket handles real-time updates where the deployment model supports it.

Exit criteria:
- stale data is detectable;
- cache failures degrade gracefully;
- durable state remains authoritative.

## Phase 16 — Authentication

**Goal:** Protect user-specific features after the anonymous scanner is stable.

Better Auth handles registration/login, sessions, protected routes, user settings, and saved scanner preferences.

Exit criteria:
- protected APIs require valid sessions;
- intentionally public analysis endpoints remain public.

## Phase 17 — Testing and Backtesting

**Goal:** Prove consistent behavior before production use.

```text
Unit
 ↓
Indicator / Structure / Trend / Strategy
 ↓
Integration
 ↓
Delta adapter / API / DB
 ↓
End-to-end
 ↓
Scanner workflow
```

Add historical fixtures and backtest utilities for crossover frequency, trend-filter frequency, reversal false positives, setup outcomes, and timeframe alignment.

Backtests do not guarantee future profitability.

## Phase 18 — Cloudflare Production Infrastructure

**Goal:** Deploy with explicit infrastructure boundaries.

Configure Cloudflare Workers, KV, R2, Hyperdrive, environment bindings/secrets, production logging, and deployment configuration.

Alchemy IaC owns infrastructure definitions.

Exit criteria:
- deployment is reproducible;
- secrets are outside Git;
- local/production differences are documented.

## Phase 19 — Observability and Reliability

**Goal:** Make failures diagnosable.

Implement structured logging, correlation IDs, provider latency/error metrics, scanner calculation timing, WebSocket/reconnect status, database error reporting, and safe user-facing errors.

Exit criteria:
- exchange failures are diagnosable;
- secrets are never logged.

## Phase 20 — Production Hardening

**Goal:** Make the complete application maintainable.

Checklist:
- typecheck passes;
- lint passes;
- tests pass;
- migrations are reproducible;
- error boundaries exist;
- loading/empty/error UI exists;
- API contracts are validated;
- secrets are excluded from Git;
- Cloudflare configuration is documented;
- README matches the repository;
- architecture docs match implementation.

## MVP Definition of Done

The MVP is complete when a user can:

1. open the application;
2. see Delta Exchange markets;
3. see which markets are trending;
4. sort/filter by trend strength;
5. understand why a market is trending;
6. inspect 15m context;
7. inspect 5m setup;
8. inspect 3m confirmation;
9. see 9/15 EMA state;
10. see reversal status;
11. open a market detail view;
12. inspect supporting charts/data;
13. use the application without exposing exchange secrets.

Automated trade execution is explicitly outside MVP scope.
