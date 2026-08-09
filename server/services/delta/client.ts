// GOAL: Isolate every Delta Exchange HTTP detail from the rest of the application.
// RESPONSIBILITY: Fetch products, tickers, and historical candles and normalize them.
// DOES NOT: Calculate indicators or make trading decisions.
import type { Candle, MarketProduct, MarketTicker } from "../../types/market";

// Use the India production API because this project targets Delta Exchange India.
const BASE_URL = "https://api.india.delta.exchange";

type DeltaEnvelope<T> = {
  success?: boolean;
  result?: T;
  meta?: unknown;
};

type DeltaProduct = {
  id: number;
  symbol: string;
  contract_type: string;
  state: string;
  trading_status: string;
};

type DeltaTicker = {
  symbol: string;
  close?: number;
  ltp_change_24h?: string;
  volume?: number;
  turnover_usd?: number;
  turnover?: number;
};

type DeltaCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

// Perform one safe JSON GET request with a timeout.
async function getJson<T>(path: string): Promise<T> {
  // Abort slow provider calls so a dead exchange cannot hang the scanner forever.
  const controller = new AbortController();

  // Give the provider ten seconds before failing the request.
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    // Ask the provider for JSON and identify the request as public market data.
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    // Convert non-2xx responses into useful server-side failures.
    if (!response.ok) {
      throw new Error(`Delta API returned HTTP ${response.status}`);
    }

    // Parse the provider response exactly once at the boundary.
    return (await response.json()) as T;
  } finally {
    // Always clear the timer so completed requests do not leak timers.
    clearTimeout(timer);
  }
}

// Fetch live perpetual products that are currently operational.
export async function getPerpetualProducts(): Promise<MarketProduct[]> {
  // Delta supports filtering directly, reducing unnecessary payloads.
  const response = await getJson<DeltaEnvelope<DeltaProduct[]>>(
    "/v2/products?contract_types=perpetual_futures&states=live&page_size=100",
  );

  // Treat an absent result as an empty provider response.
  const products = response.result ?? [];

  // Normalize provider naming into the application's naming convention.
  return products
    .filter((product) => product.trading_status === "operational")
    .map((product) => ({
      id: product.id,
      symbol: product.symbol,
      contractType: product.contract_type,
      state: product.state,
      tradingStatus: product.trading_status,
    }));
}

// Fetch all live perpetual tickers in one public request.
export async function getPerpetualTickers(): Promise<MarketTicker[]> {
  // Ask Delta to return only perpetual-futures contracts.
  const response = await getJson<DeltaEnvelope<DeltaTicker[]>>(
    "/v2/tickers?contract_types=perpetual_futures",
  );

  // Normalize every ticker and discard malformed records.
  return (response.result ?? []).flatMap((ticker) => {
    // Convert optional provider values into safe numbers.
    const lastPrice = Number(ticker.close ?? 0);

    // Ignore records without a usable symbol or price.
    if (!ticker.symbol || !Number.isFinite(lastPrice) || lastPrice <= 0) {
      return [];
    }

    // Return only fields needed by the scanner.
    return [
      {
        symbol: ticker.symbol,
        lastPrice,
        change24h: Number(ticker.ltp_change_24h ?? 0),
        volume24h: Number(ticker.volume ?? 0),
        turnover24h: Number(ticker.turnover_usd ?? ticker.turnover ?? 0),
      },
    ];
  });
}

// Fetch enough candles for EMA-200 and the current trend calculation.
export async function getCandles(
  symbol: string,
  resolution: "3m" | "5m" | "15m",
  lookbackCandles = 240,
): Promise<Candle[]> {
  // Convert the requested resolution into seconds.
  const secondsPerCandle =
    resolution === "3m" ? 180 : resolution === "5m" ? 300 : 900;

  // End the request at the current Unix timestamp.
  const end = Math.floor(Date.now() / 1000);

  // Keep the request within Delta's documented 2000-candle response maximum.
  const count = Math.min(Math.max(lookbackCandles, 200), 2000);

  // Calculate the start timestamp from the requested number of candles.
  const start = end - secondsPerCandle * count;

  // Encode query parameters safely.
  const params = new URLSearchParams({
    resolution,
    symbol,
    start: String(start),
    end: String(end),
  });

  // Fetch the historical OHLC response.
  const response = await getJson<DeltaEnvelope<DeltaCandle[]>>(
    `/v2/history/candles?${params.toString()}`,
  );

  // Normalize and sort candles from oldest to newest.
  return (response.result ?? [])
    .map((candle) => ({
      time: Number(candle.time),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume ?? 0),
    }))
    .filter(
      (candle) =>
        Number.isFinite(candle.time) &&
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close),
    )
    .sort((a, b) => a.time - b.time);
}
