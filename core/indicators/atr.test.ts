import { describe, expect, it } from "vitest";
import { atr } from "./atr";
import type { Candle } from "../../types/market";

const candles: Candle[] = [
  { time: 1, open: 9, high: 12, low: 8, close: 10, volume: 100 },
  { time: 2, open: 10, high: 13, low: 9, close: 12, volume: 120 },
  { time: 3, open: 12, high: 14, low: 10, close: 11, volume: 90 },
];

describe("atr", () => {
  // Verify the output stays aligned with the candle series.
  it("returns one value per candle", () => {
    expect(atr(candles, 2)).toHaveLength(candles.length);
  });

  // The first ATR seed is based on the configured initial window.
  it("produces finite volatility values", () => {
    expect(atr(candles, 2).every(Number.isFinite)).toBe(true);
  });

  // Invalid periods must fail before any division or smoothing occurs.
  it("rejects invalid periods", () => {
    expect(() => atr(candles, 0)).toThrow();
    expect(() => atr(candles, 1.5)).toThrow();
  });

  // Empty market history should not crash the indicator pipeline.
  it("returns an empty series for empty candles", () => {
    expect(atr([], 14)).toEqual([]);
  });
});
