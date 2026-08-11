import type { Candle } from "../../types/market";

// GOAL: Extract simple swing structure from closed candles.
// RESPONSIBILITY: Identify higher highs, higher lows, lower highs, lower lows, and structure breaks.
// DOES NOT: Predict price or place trades.
export type StructureDirection = "bullish" | "bearish" | "neutral";

// Describe the most recent confirmed swing structure.
export interface MarketStructure {
  direction: StructureDirection;
  higherHigh: boolean;
  higherLow: boolean;
  lowerHigh: boolean;
  lowerLow: boolean;
  breakOfStructure: "bullish" | "bearish" | "none";
}

// Detect a recent swing using a configurable lookback on both sides.
function isSwingHigh(candles: Candle[], index: number, lookback: number): boolean {
  // Read the candidate candle's high once for the comparisons below.
  const high = candles[index].high;

  // Every surrounding candle must have a lower high for a confirmed swing high.
  for (let offset = 1; offset <= lookback; offset += 1) {
    if (candles[index - offset].high >= high) return false;
    if (candles[index + offset].high >= high) return false;
  }

  // The candidate survived both sides of the swing test.
  return true;
}

// Detect a recent swing low using a configurable lookback on both sides.
function isSwingLow(candles: Candle[], index: number, lookback: number): boolean {
  // Read the candidate candle's low once for the comparisons below.
  const low = candles[index].low;

  // Every surrounding candle must have a higher low for a confirmed swing low.
  for (let offset = 1; offset <= lookback; offset += 1) {
    if (candles[index - offset].low <= low) return false;
    if (candles[index + offset].low <= low) return false;
  }

  // The candidate survived both sides of the swing test.
  return true;
}

// Analyze the most recent confirmed swing sequence.
export function detectMarketStructure(candles: Candle[], lookback = 2): MarketStructure {
  // Reject invalid configuration before indexing the candle array.
  if (!Number.isInteger(lookback) || lookback <= 0) {
    throw new Error("Market-structure lookback must be a positive integer");
  }

  // Swing detection needs candles on both sides of a candidate.
  const minimumCandles = lookback * 2 + 3;
  if (candles.length < minimumCandles) {
    return {
      direction: "neutral",
      higherHigh: false,
      higherLow: false,
      lowerHigh: false,
      lowerLow: false,
      breakOfStructure: "none",
    };
  }

  // Store confirmed swing highs and lows as [index, price] pairs.
  const highs: Array<[number, number]> = [];
  const lows: Array<[number, number]> = [];

  // Only inspect candles that have enough candles on both sides for confirmation.
  for (let index = lookback; index < candles.length - lookback; index += 1) {
    if (isSwingHigh(candles, index, lookback)) highs.push([index, candles[index].high]);
    if (isSwingLow(candles, index, lookback)) lows.push([index, candles[index].low]);
  }

  // Read the two most recent confirmed swings of each type.
  const previousHigh = highs.at(-2);
  const latestHigh = highs.at(-1);
  const previousLow = lows.at(-2);
  const latestLow = lows.at(-1);

  // Without two comparable swings we cannot make a directional structure claim.
  if (!previousHigh || !latestHigh || !previousLow || !latestLow) {
    return {
      direction: "neutral",
      higherHigh: false,
      higherLow: false,
      lowerHigh: false,
      lowerLow: false,
      breakOfStructure: "none",
    };
  }

  // Compare the most recent swing to the preceding swing of the same type.
  const higherHigh = latestHigh[1] > previousHigh[1];
  const higherLow = latestLow[1] > previousLow[1];
  const lowerHigh = latestHigh[1] < previousHigh[1];
  const lowerLow = latestLow[1] < previousLow[1];

  // Confirm bullish structure only when both highs and lows are advancing.
  const bullish = higherHigh && higherLow;

  // Confirm bearish structure only when both highs and lows are declining.
  const bearish = lowerHigh && lowerLow;

  // A structure break is confirmed when the latest closed price crosses the most recent opposite swing.
  const latestClose = candles.at(-1)?.close ?? 0;
  const breakOfStructure =
    bullish && latestClose > latestHigh[1]
      ? "bullish"
      : bearish && latestClose < latestLow[1]
        ? "bearish"
        : "none";

  // Return only deterministic structural facts.
  return {
    direction: bullish ? "bullish" : bearish ? "bearish" : "neutral",
    higherHigh,
    higherLow,
    lowerHigh,
    lowerLow,
    breakOfStructure,
  };
}
