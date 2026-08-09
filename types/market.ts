// GOAL: Define the normalized market objects used by the whole application.
// RESPONSIBILITY: Keep exchange-specific response shapes outside the core engine.
// DOES NOT: Call Delta Exchange, React, Hono, or a database.
export type Direction = "bullish" | "bearish" | "neutral";

// A candle is the smallest time-series unit consumed by indicators.
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// A normalized ticker contains only fields the scanner actually needs.
export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  change24h: number;
  volume24h: number;
  turnover24h: number;
}

// A normalized product describes an eligible Delta market.
export interface MarketProduct {
  id: number;
  symbol: string;
  contractType: string;
  state: string;
  tradingStatus: string;
}

// The trend engine returns an explainable analytical result.
export interface TrendResult {
  symbol: string;
  direction: Direction;
  score: number;
  ema9: number;
  ema15: number;
  ema200: number;
  atrPercent: number;
  rvol: number;
  reasons: string[];
}
