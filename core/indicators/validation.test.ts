import { describe, expect, it } from "vitest";
import { closedCandles, isValidCandle, normalizeCandles } from "./validation";
import type { Candle } from "../../types/market";

const valid: Candle = {
  time: 1_000,
  open: 100,
  high: 110,
  low: 95,
  close: 105,
  volume: 500,
};

describe("candle validation", () => {
  // A structurally correct OHLCV candle must pass validation.
  it("accepts a valid candle", () => {
    expect(isValidCandle(valid)).toBe(true);
  });

  // Invalid OHLC relationships must never enter the indicator engine.
  it("rejects impossible OHLC values", () => {
    expect(isValidCandle({ ...valid, high: 90 })).toBe(false);
    expect(isValidCandle({ ...valid, low: 120 })).toBe(false);
    expect(isValidCandle({ ...valid, volume: -1 })).toBe(false);
    expect(isValidCandle({ ...valid, close: Number.NaN })).toBe(false);
  });

  // Duplicate timestamps are reduced to one deterministic candle.
  it("deduplicates timestamps and sorts chronologically", () => {
    const result = normalizeCandles([
      { ...valid, time: 2_000, close: 102 },
      { ...valid, time: 1_000, close: 101 },
      { ...valid, time: 2_000, close: 103 },
    ]);

    expect(result.map((candle) => candle.time)).toEqual([1_000, 2_000]);
    expect(result[1].close).toBe(103);
  });

  // A candle is usable for closed-candle strategy logic only after its interval ends.
  it("excludes a forming candle", () => {
    const result = closedCandles(
      [
        { ...valid, time: 0 },
        { ...valid, time: 900 },
      ],
      900,
      1_500,
    );

    expect(result.map((candle) => candle.time)).toEqual([0]);
  });
});
