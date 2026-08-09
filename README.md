# Pic-coin-Scors

A hands-on cryptocurrency trend scanner and trading-analysis dashboard for Delta Exchange.

The project is being built from the ground up with React, TypeScript, TanStack Start, Hono, TanStack Query, TanStack Router, TanStack Table, Jotai, Tailwind CSS v4, shadcn/ui, Better Auth, PostgreSQL/Supabase, Prisma, Drizzle, Kysely, and Cloudflare.

## Project Goal

The application should answer one primary question:

> **Which Delta Exchange coins are actually trending right now?**

Once a strong trend is identified, the application will analyze 15-minute, 5-minute, and 3-minute timeframes for the user's 9/15 EMA strategy and reversal setups.

The application is an analysis and scanning tool. It does not place trades automatically.

## Core Objectives

1. Discover liquid/tradable Delta Exchange markets.
2. Detect whether a market is trending or ranging.
3. Determine bullish or bearish trend direction.
4. Rank markets by trend strength.
5. Detect 9/15 EMA crossover setups.
6. Detect potential trend exhaustion and reversals.
7. Align 15m, 5m, and 3m market structure.
8. Present the strongest opportunities in a clean dashboard.
9. Store useful market and trend history for later analysis.
10. Deploy the application using Cloudflare infrastructure.

## Trading-analysis concept

The scanner should separate **market selection** from **trade entry**.

```text
Delta Exchange market data
        ↓
Market universe
        ↓
Trend detection
        ↓
Trend strength score
        ↓
Bullish / Bearish / Neutral
        ↓
15m context
        ↓
5m setup
        ↓
3m confirmation
        ↓
9/15 EMA strategy
        ↓
Reversal / continuation candidate
```

A 9/15 crossover by itself is not considered a trade signal. The surrounding trend and market structure must be evaluated first.

## Technology Stack

### Frontend

- React
- TypeScript
- TanStack Start
- TanStack Router
- TanStack Query
- TanStack Table
- Jotai
- Tailwind CSS v4
- shadcn/ui
- Charting library

### Backend

- Hono
- Cloudflare Workers
- Delta Exchange REST/WebSocket market data

### Database

- PostgreSQL through Supabase
- Prisma for schema/migrations/table management
- Drizzle ORM where appropriate
- Kysely for typed querying

### Authentication

- Better Auth

### Cloudflare

- Workers
- KV
- R2
- Hyperdrive

### Infrastructure / Tooling

- Vite
- Alchemy IaC

## Architecture

```text
                         Delta Exchange
                               │
                    REST + WebSocket data
                               │
                               ▼
                    Hono / Cloudflare Worker
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
        Market Data       Indicator Engine    Cache
             │                 │                 │
             │          EMA / ADX / ATR        KV
             │          RSI / RVOL             │
             │                 │                 │
             └─────────────────┼─────────────────┘
                               ▼
                         Trend Engine
                               │
                    Market Structure Engine
                               │
                         Strategy Engine
                               │
                               ▼
                         Hono API Layer
                               │
                               ▼
                       TanStack Query
                               │
                               ▼
                         React Dashboard
```

## Repository Structure

```text
Pic-coin-Scors/
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.jsonc
├── alchemy.run.ts
├── .env.example
├── .gitignore
├── eslint.config.js
├── prettier.config.js
│
├── app/
│   ├── client.tsx
│   ├── router.tsx
│   └── routes/
│       ├── __root.tsx
│       ├── index.tsx
│       ├── scanner.tsx
│       ├── markets.tsx
│       └── markets.$symbol.tsx
│
├── components/
│   ├── ui/
│   ├── scanner/
│   │   ├── TrendTable.tsx
│   │   ├── TrendScoreBadge.tsx
│   │   ├── TrendFilters.tsx
│   │   └── MarketStatus.tsx
│   └── charts/
│       ├── PriceChart.tsx
│       ├── VolumeChart.tsx
│       └── IndicatorChart.tsx
│
├── features/
│   ├── scanner/
│   │   ├── api.ts
│   │   ├── queries.ts
│   │   ├── atoms.ts
│   │   └── types.ts
│   └── market/
│       ├── api.ts
│       ├── queries.ts
│       └── types.ts
│
├── server/
│   ├── index.ts
│   ├── env.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── errors.ts
│   │   └── logging.ts
│   ├── routes/
│   │   ├── health.ts
│   │   ├── markets.ts
│   │   ├── scanner.ts
│   │   └── auth.ts
│   └── services/
│       ├── delta/
│       │   ├── client.ts
│       │   ├── instruments.ts
│       │   ├── ticker.ts
│       │   ├── candles.ts
│       │   └── websocket.ts
│       ├── cache/
│       │   ├── kv.ts
│       │   └── market-cache.ts
│       └── auth/
│           └── better-auth.ts
│
├── core/
│   ├── indicators/
│   │   ├── ema.ts
│   │   ├── adx.ts
│   │   ├── atr.ts
│   │   ├── rsi.ts
│   │   └── rvol.ts
│   ├── structure/
│   │   ├── swings.ts
│   │   ├── trend.ts
│   │   └── reversal.ts
│   ├── trend/
│   │   ├── trend-engine.ts
│   │   ├── trend-score.ts
│   │   └── timeframe-alignment.ts
│   └── strategy/
│       ├── ema-crossover.ts
│       ├── setup.ts
│       └── rules.ts
│
├── db/
│   ├── schema/
│   ├── migrations/
│   └── queries/
│       ├── markets.ts
│       ├── candles.ts
│       └── trend-snapshots.ts
│
├── lib/
│   ├── logger.ts
│   ├── errors.ts
│   ├── time.ts
│   └── validation.ts
│
├── types/
│   ├── market.ts
│   ├── candle.ts
│   ├── indicators.ts
│   ├── trend.ts
│   └── api.ts
│
├── tests/
│   ├── unit/
│   │   ├── indicators/
│   │   ├── structure/
│   │   └── strategy/
│   ├── integration/
│   └── fixtures/
│
├── scripts/
│   ├── seed.ts
│   └── backfill.ts
│
├── infra/
│   ├── worker.ts
│   ├── kv.ts
│   ├── r2.ts
│   └── hyperdrive.ts
│
└── docs/
    ├── architecture.md
    ├── data-model.md
    ├── trend-engine.md
    ├── strategy.md
    └── development-plan.md
```

## File Responsibility Rules

Every source file should document its purpose at the top. A typical module header should explain:

- GOAL: what the file exists to do.
- RESPONSIBILITY: what it owns.
- DOES NOT: what it must not own.
- USED BY: the main consumers.

Example:

```ts
/**
 * GOAL:
 * Calculate Exponential Moving Average values.
 *
 * RESPONSIBILITY:
 * - Accept validated price data.
 * - Calculate EMA values for a requested period.
 * - Return deterministic results.
 *
 * DOES NOT:
 * - Call Delta Exchange.
 * - Access the database.
 * - Make trading decisions.
 *
 * USED BY:
 * - Trend Engine
 * - EMA Crossover Strategy
 */
```

## Development Phases

### Phase 1 — Foundation

- Initialize TanStack Start / React / TypeScript.
- Configure Vite.
- Configure Tailwind CSS v4.
- Add shadcn/ui foundations.
- Configure TanStack Router.
- Create the first application route.
- Create the Hono health endpoint.
- Establish repository conventions.

### Phase 2 — Market Data

- Connect to Delta Exchange.
- Fetch supported instruments.
- Fetch ticker data.
- Fetch historical candles.
- Add WebSocket market updates.
- Normalize exchange-specific data into internal types.

### Phase 3 — Indicator Engine

Implement indicators independently and test them:

- EMA 9
- EMA 15
- EMA 200
- ADX
- ATR
- RSI
- Relative Volume

### Phase 4 — Trend Engine

Determine whether a market is:

- Strong bullish
- Bullish
- Neutral / ranging
- Bearish
- Strong bearish

The engine should produce a numerical trend score and explain why the score was assigned.

### Phase 5 — Market Structure

Implement:

- swing highs
- swing lows
- higher highs
- higher lows
- lower highs
- lower lows
- structure breaks
- trend continuation
- potential reversal

### Phase 6 — Strategy Engine

Implement the 9/15 EMA strategy only after the trend engine exists.

The strategy should evaluate:

- higher timeframe direction
- EMA relationship
- fresh crossover
- candle close confirmation
- volatility
- relative volume
- market structure
- nearby invalidation levels

### Phase 7 — Scanner UI

Build a dashboard that ranks markets by trend strength.

Example:

| Rank | Coin | Direction | ADX | RVOL | Trend Score |
| --- | --- | --- | ---: | ---: | ---: |
| 1 | SOL | Bullish | 42 | 2.1 | 97 |
| 2 | BTC | Bullish | 35 | 1.8 | 93 |
| 3 | ETH | Bearish | 31 | 1.7 | 89 |

### Phase 8 — Multi-Timeframe Analysis

Use:

- 15m for market context.
- 5m for setup.
- 3m for entry confirmation.

### Phase 9 — Database and Authentication

Add:

- PostgreSQL/Supabase.
- schema and migrations.
- market snapshots.
- candle history where required.
- trend snapshots.
- signal history.
- Better Auth.

### Phase 10 — Cloudflare

Add and configure:

- Workers.
- KV.
- R2 where large object storage is useful.
- Hyperdrive where database connectivity requires it.
- Alchemy IaC for infrastructure management.

### Phase 11 — Testing and Production

- Unit tests for indicators.
- Unit tests for market structure.
- Unit tests for strategy rules.
- API integration tests.
- Error handling.
- Observability/logging.
- Production deployment.

## Important Design Principles

### Separate exchange data from trading logic

Delta Exchange API response formats must be normalized before entering the core trading engine.

### Keep indicators pure

An indicator should calculate values. It should not fetch data, write to a database, or make a trade decision.

### Trend selection comes before entry selection

The scanner first determines which coins are trending. The EMA strategy then looks for setups inside those markets.

### No absolute volume assumptions

Delta Exchange volume should not be filtered using Binance-specific absolute thresholds. Relative volume and exchange-native market metrics should be evaluated instead.

### No automatic trading

The first version is an analysis/scanner application. Trade execution is intentionally outside the initial scope.

## API Plan

```text
GET /api/health
GET /api/markets
GET /api/markets/:symbol
GET /api/scanner
GET /api/signals
```

## Local Development

The exact setup commands will be documented after the framework versions are pinned and the Phase 1 application shell is created.

## Learning Philosophy

This project is intentionally being built by hand.

AI assistance may explain concepts, review code, diagnose errors, and suggest improvements, but the architecture and implementation should remain understandable to the developer building the project.

## Disclaimer

This project is a software and market-analysis project. Trend scores and signals are not guarantees of future price movement or profitability. Use appropriate risk management and validate strategy behavior with historical and paper-trading data before relying on it.
