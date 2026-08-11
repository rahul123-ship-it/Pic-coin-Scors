// GOAL: Calculate ATR as a normalized volatility measure.
// RESPONSIBILITY: Compute true range and Wilder-style ATR from candles.
// DOES NOT: Decide whether volatility is good or bad.
import type { Candle } from "../../types/market";

// Calculate one ATR value per candle so indexes remain aligned.
export function atr(candles: Candle[], period: number): number[] {
  // Validate the requested lookback.
  if (period <= 0 || !Number.isInteger(period)) {
    throw new Error("ATR period must be a positive integer");
  }

  // Return no values when there are no candles.
  if (candles.length === 0) return [];

  // Build true-range values from high, low, and previous close.
  const ranges = candles.map((candle, index) => {
    // The first candle has no previous close.
    if (index === 0) return candle.high - candle.low;

    // Read the previous close for gap-aware true range.
    const previousClose = candles[index - 1].close;

    // True range is the largest of the three standard components.
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });

  // Seed the ATR with the average of the first lookback window.
  const seedCount = Math.min(period, ranges.length);
  const seed =
    ranges.slice(0, seedCount).reduce((sum, value) => sum + value, 0) /
    seedCount;

  // Store one ATR for each candle.
  const result = [seed];

  // Apply Wilder smoothing to every later true range.
  for (let index = 1; index < ranges.length; index += 1) {
    // Read the previous ATR for the recursive calculation.
    const previous = result[index - 1];

    // Apply Wilder's recursive moving-average formula.
    result.push((previous * (period - 1) + ranges[index]) / period);
  }

  // Return the volatility series.
  return result;
}
