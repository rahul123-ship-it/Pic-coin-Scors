import type { Candle } from "../../types/market";

// GOAL: Keep invalid market candles out of indicator calculations.
// RESPONSIBILITY: Validate OHLCV values and candle ordering.
// DOES NOT: Fetch data or decide whether a market is tradable.

// Define the minimum shape required for a candle to be analytically safe.
export function isValidCandle(candle: Candle): boolean {
  // Every numeric field must be finite before mathematics can use it.
  const numericValues = [
    candle.time,
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume,
  ];

  // Reject NaN and Infinity because they poison every downstream indicator.
  if (!numericValues.every(Number.isFinite)) return false;

  // OHLC prices must be positive for this crypto market model.
  if ([candle.open, candle.high, candle.low, candle.close].some((value) => value <= 0)) {
    return false;
  }

  // The high cannot be below either the open, close, or low.
  if (candle.high < Math.max(candle.open, candle.close, candle.low)) return false;

  // The low cannot be above either the open, close, or high.
  if (candle.low > Math.min(candle.open, candle.close, candle.high)) return false;

  // Negative volume is never meaningful in the normalized domain model.
  if (candle.volume < 0) return false;

  // The candle passed all structural checks.
  return true;
}

// Remove malformed records and duplicate timestamps while preserving chronological order.
export function normalizeCandles(candles: Candle[]): Candle[] {
  // Use a map so a duplicated timestamp cannot be counted twice.
  const byTime = new Map<number, Candle>();

  // Validate each provider record before storing it.
  for (const candle of candles) {
    if (isValidCandle(candle)) byTime.set(candle.time, candle);
  }

  // Return deterministic oldest-to-newest data for every indicator.
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

// Determine whether the final candle is closed for the requested timeframe.
export function closedCandles(
  candles: Candle[],
  timeframeSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): Candle[] {
  // A candle is closed when the next candle's boundary has already passed.
  return candles.filter(
    (candle) => candle.time + timeframeSeconds <= nowSeconds,
  );
}
