// GOAL: Isolate every Delta Exchange HTTP detail from the rest of the application.
// RESPONSIBILITY: Fetch, validate, normalize, safely retry, and lightly cache public market data.
// DOES NOT: Calculate indicators or make trading decisions.
import { z } from "zod";
import type { Candle, MarketProduct, MarketTicker } from "../../../types/market";

// Use Delta Exchange India's production API because this scanner targets Delta India.
const BASE_URL = "https://api.india.delta.exchange";

// Keep retries small so an exchange incident cannot create a retry storm.
const MAX_RETRIES = 2;

// Abort one provider request after ten seconds instead of hanging a scan indefinitely.
const REQUEST_TIMEOUT_MS = 10_000;

// Keep provider backoff bounded so a single request cannot block the whole scanner.
const MAX_RETRY_DELAY_MS = 5_000;

// Products change slowly, so do not fetch the exchange universe on every dashboard refresh.
const PRODUCTS_CACHE_TTL_MS = 5 * 60_000;

// Give the ticker endpoint no cache because the dashboard uses it as the live price snapshot.
const TICKERS_CACHE_TTL_MS = 0;

// Small safety margin after a candle boundary gives the exchange time to publish the closed candle.
const CANDLE_CACHE_GRACE_MS = 5_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

// Keep the process-local cache deliberately small and scoped to this provider module.
const productsCache: { entry: CacheEntry<MarketProduct[]> | null } = { entry: null };
const candlesCache = new Map<string, CacheEntry<Candle[]>>();

// Validate the response envelope at runtime because TypeScript types cannot validate JSON.
const envelopeSchema = <T extends z.ZodType>(resultSchema: T) =>
  z.object({
    success: z.boolean().optional(),
    result: resultSchema.optional(),
    meta: z.unknown().optional(),
  });

// Validate only fields that the application actually consumes from a Delta product.
const productSchema = z.object({
  id: z.coerce.number(),
  symbol: z.string().min(1),
  contract_type: z.string(),
  state: z.string(),
  trading_status: z.string(),
});

// Provider ticker values can be strings or numbers, so coerce them at the boundary.
const tickerSchema = z.object({
  symbol: z.string().min(1),
  close: z.coerce.number().optional(),
  ltp_change_24h: z.coerce.number().optional(),
  volume: z.coerce.number().optional(),
  turnover_usd: z.coerce.number().optional(),
  turnover: z.coerce.number().optional(),
});

// Historical candle fields are normalized to finite numbers before entering core code.
const candleSchema = z.object({
  time: z.coerce.number(),
  open: z.coerce.number(),
  high: z.coerce.number(),
  low: z.coerce.number(),
  close: z.coerce.number(),
  volume: z.coerce.number().optional(),
});

// Sleep without blocking the Worker event loop so retries remain asynchronous.
async function sleep(milliseconds: number): Promise<void> {
  // Resolve after the requested backoff interval.
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

// Calculate a bounded retry delay, preferring Delta's explicit rate-limit reset when present.
function retryDelay(attempt: number, resetHeader: string | null): number {
  // Delta documents this header as milliseconds until the next request may be made.
  const providerDelay = Number(resetHeader ?? "NaN");

  // Respect a valid provider delay but cap it for predictable application latency.
  if (Number.isFinite(providerDelay) && providerDelay >= 0) {
    return Math.min(providerDelay, MAX_RETRY_DELAY_MS);
  }

  // Fall back to exponential backoff when the provider gives no reset hint.
  return Math.min(500 * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

// Perform one runtime-validated JSON GET with timeout and transient-error retry handling.
async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  // Try the request once plus the configured number of retries.
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    // Create a fresh abort controller for every attempt.
    const controller = new AbortController();

    // Abort slow provider calls after the configured timeout.
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      // Request public JSON data without exposing any private API credentials.
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      // Retry only failures that are plausibly transient at the transport/provider layer.
      const retryable = response.status === 429 || response.status >= 500;

      // Convert permanent HTTP failures into a clear provider error immediately.
      if (!response.ok && !retryable) {
        throw new Error(`Delta API returned HTTP ${response.status}`);
      }

      // Retry a rate limit or server outage while attempts remain.
      if (!response.ok && retryable) {
        if (attempt === MAX_RETRIES) {
          throw new Error(`Delta API unavailable after ${MAX_RETRIES + 1} attempts`);
        }

        // Wait before retrying and then continue the attempt loop.
        await sleep(retryDelay(attempt, response.headers.get("X-RATE-LIMIT-RESET")));
        continue;
      }

      // Parse JSON exactly once at the provider boundary.
      const raw: unknown = await response.json();

      // Validate the response before application code can consume it.
      const parsed = schema.safeParse(raw);

      // Reject malformed provider responses instead of allowing undefined values downstream.
      if (!parsed.success) {
        throw new Error("Delta API returned an unexpected response shape");
      }

      // Return the validated provider response.
      return parsed.data;
    } catch (error) {
      // Abort errors are retryable because they represent a timed-out provider request.
      const retryableError =
        error instanceof Error &&
        (error.name === "AbortError" || /network|fetch/i.test(error.message));

      // Retry transient network failures while attempts remain.
      if (retryableError && attempt < MAX_RETRIES) {
        await sleep(retryDelay(attempt, null));
        continue;
      }

      // Preserve the original error for server-side diagnostics.
      throw error;
    } finally {
      // Always clear the timeout, including successful and failed attempts.
      clearTimeout(timer);
    }
  }

  // This point is unreachable, but keeps TypeScript's control-flow analysis explicit.
  throw new Error("Delta request failed unexpectedly");
}

// Fetch live perpetual products that are currently operational.
export async function getPerpetualProducts(): Promise<MarketProduct[]> {
  // Return the stable exchange universe while its short cache is still valid.
  if (productsCache.entry && productsCache.entry.expiresAt > Date.now()) {
    return productsCache.entry.value;
  }

  // Validate the entire provider envelope before mapping it.
  const response = await getJson(
    "/v2/products?contract_types=perpetual_futures&states=live&page_size=100",
    envelopeSchema(z.array(productSchema)),
  );

  // Treat an absent result as an empty provider response.
  const products = response.result ?? [];

  // Normalize provider naming into the application's domain naming convention.
  const normalized = products
    .filter((product) => product.trading_status === "operational")
    .map((product) => ({
      id: product.id,
      symbol: product.symbol,
      contractType: product.contract_type,
      state: product.state,
      tradingStatus: product.trading_status,
    }));

  // Cache the normalized universe only after the provider response has passed validation.
  productsCache.entry = {
    value: normalized,
    expiresAt: Date.now() + PRODUCTS_CACHE_TTL_MS,
  };

  // Return a stable normalized product list to the scanner.
  return normalized;
}

// Fetch all live perpetual tickers in one public request.
export async function getPerpetualTickers(): Promise<MarketTicker[]> {
  // Keep this endpoint uncached because its purpose is the live market snapshot.
  if (TICKERS_CACHE_TTL_MS > 0) {
    // The branch is intentionally disabled until a live ticker cache policy is defined.
  }

  // Validate every ticker before normalizing it.
  const response = await getJson(
    "/v2/tickers?contract_types=perpetual_futures",
    envelopeSchema(z.array(tickerSchema)),
  );

  // Normalize provider fields and discard records without a usable live price.
  return (response.result ?? []).flatMap((ticker) => {
    // Convert optional provider values into safe numbers.
    const lastPrice = ticker.close ?? 0;
    const change24h = ticker.ltp_change_24h ?? 0;
    const volume24h = ticker.volume ?? 0;
    const turnover24h = ticker.turnover_usd ?? ticker.turnover ?? 0;

    // Reject non-finite or non-positive market values before ranking.
    if (
      !Number.isFinite(lastPrice) ||
      lastPrice <= 0 ||
      !Number.isFinite(change24h) ||
      !Number.isFinite(volume24h) ||
      !Number.isFinite(turnover24h) ||
      turnover24h < 0
    ) {
      return [];
    }

    // Return only fields needed by the scanner.
    return [
      {
        symbol: ticker.symbol,
        lastPrice,
        change24h,
        volume24h,
        turnover24h,
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

  // Use a stable cache key for each symbol/timeframe/lookback combination.
  const cacheKey = `${symbol}:${resolution}:${lookbackCandles}`;
  const cached = candlesCache.get(cacheKey);

  // Reuse history until the next timeframe boundary plus a short provider-publish grace period.
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // End the request at the current Unix timestamp.
  const end = Math.floor(Date.now() / 1000);

  // Keep each request within Delta's documented candle response limit.
  const count = Math.min(Math.max(lookbackCandles, 200), 2000);

  // Calculate the start timestamp from the requested number of candles.
  const start = end - secondsPerCandle * count;

  // Encode query parameters safely instead of concatenating user-controlled values.
  const params = new URLSearchParams({
    resolution,
    symbol,
    start: String(start),
    end: String(end),
  });

  // Validate the historical OHLC response at the exchange boundary.
  const response = await getJson(
    `/v2/history/candles?${params.toString()}`,
    envelopeSchema(z.array(candleSchema)),
  );

  // Normalize and sort candles from oldest to newest.
  const normalized = (response.result ?? [])
    .map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume ?? 0,
    }))
    .filter(
      (candle) =>
        Number.isFinite(candle.time) &&
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close) &&
        Number.isFinite(candle.volume),
    )
    .sort((a, b) => a.time - b.time);

  // Refresh shortly after the next timeframe boundary so a newly closed candle can arrive.
  const nextBoundarySeconds = (Math.floor(end / secondsPerCandle) + 1) * secondsPerCandle;
  candlesCache.set(cacheKey, {
    value: normalized,
    expiresAt: nextBoundarySeconds * 1000 + CANDLE_CACHE_GRACE_MS,
  });

  // Return the validated and chronologically ordered candle series.
  return normalized;
}
