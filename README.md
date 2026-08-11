# Pic-coin-Scors

Pic-coin-Scors is a cryptocurrency market-analysis scanner for Delta Exchange.

The product is designed to answer one question:

> **Which Delta Exchange perpetual-futures markets are trending strongly enough to deserve attention?**

It is an analysis tool. It does **not** place trades.

## Current runnable product

The `mvp-live-scanner` branch now contains a working first product slice:

```text
Delta Exchange REST
        ↓
Delta adapter
        ↓
Normalized products + tickers + 15m candles
        ↓
EMA 9 / EMA 15 / EMA 200
        ↓
ATR + relative volume
        ↓
Explainable trend score
        ↓
Hono API
        ↓
TanStack Query
        ↓
TanStack Router
        ↓
Responsive scanner dashboard
```

The scanner currently analyzes the 12 highest-turnover eligible perpetual markets returned by the exchange snapshot. The browser never calls Delta directly.

## Important architecture rule

```text
UI
 ↓
Features
 ↓
API routes
 ↓
Provider services
 ↓
Core analysis
```

The `core/` layer must remain independent from React, Hono, Cloudflare, Delta Exchange, and the database. This makes indicator and strategy code deterministic and reusable for backtesting.

## Technology

- React 19
- TypeScript
- Vite
- TanStack Router
- TanStack Query
- Hono
- Delta Exchange public REST API
- Cloudflare-compatible Fetch handler

The longer-term target also includes TanStack Start, Tailwind v4, shadcn/ui, PostgreSQL/Supabase, Better Auth, KV/R2/Hyperdrive, and production Cloudflare infrastructure.

## Run locally

Install dependencies:

```bash
npm install
```

Start development:

```bash
npm run dev
```

Open the URL printed by Vite.

Useful checks:

```bash
npm run typecheck
npm run build
```

The first scanner request uses the public Delta Exchange India API, so an internet connection is required.

## API

```text
GET /api/health
GET /api/scanner
```

`GET /api/scanner` returns normalized market-analysis DTOs. Provider-specific Delta response fields are not passed through to the browser.

## Core scoring model

The first version intentionally uses explainable components rather than an opaque score:

- EMA 9 vs EMA 15 alignment
- Price vs EMA 200
- EMA 15 vs EMA 200 alignment
- Latest close direction
- Relative volume
- ATR as normalized volatility

This is **not** a trading signal. A 9/15 crossover alone is never treated as sufficient evidence.

## Development roadmap

```text
Phase 0   Architecture and boundaries
Phase 1   Runnable application shell             ← started
Phase 2   Delta market-data adapter              ← started
Phase 3   Indicator engine                       ← started
Phase 4   Market structure
Phase 5   Trend engine hardening + ADX/RSI/RVOL
Phase 6   15m → 5m → 3m multi-timeframe engine
Phase 7   9/15 strategy + reversal candidates
Phase 8   Scanner filters, detail page, charts
Phase 9   PostgreSQL/Supabase persistence
Phase 10  Realtime WebSocket market feed
Phase 11  Better Auth
Phase 12  Cloudflare Workers/KV/R2/Hyperdrive
Phase 13  Backtesting + integration + E2E tests
Phase 14  Observability and production hardening
```

## Delta Exchange data boundary

Delta Exchange's current public documentation exposes products, tickers, and historical OHLC candles through REST, and its current public WebSocket endpoint supports ticker and candlestick feeds. The adapter is deliberately isolated so the provider can be changed without rewriting the analysis engine.

## Code-comment convention

Core files contain explicit comments describing why important lines exist. Every source module should begin with:

```ts
// GOAL: What this module exists to do.
// RESPONSIBILITY: What this module owns.
// DOES NOT: What this module must never own.
```

Do not put business logic into React components merely to make the UI work faster.

## Production principles

1. Exchange data is normalized at the boundary.
2. Indicators remain pure.
3. Market selection happens before entry selection.
4. Trend scores remain explainable.
5. Higher timeframes cannot be overridden by lower-timeframe noise.
6. Historical analysis must be testable with fixed candle fixtures.
7. No automatic trading is part of the initial product.

## Disclaimer

Trend scores and analytical candidates are not guarantees of future price movement or profitability. Validate all strategy behavior with historical and paper-trading data before using it for financial decisions.
