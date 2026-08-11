import { describe, expect, it } from "vitest";
import { detectMarketStructure } from "./market-structure";
import type { Candle } from "../../types/market";

// Build candles whose final confirmed swings form a deterministic structure.
function makeCandles(values: Array<[number, number]>): Candle[] {
  // Convert [high, low] pairs into internally consistent OHLC candles.
  return values.map(([high, low], index) => ({
    time: index * 900,
    open: (high + low) / 2,
    high,
    low,
    close: (high + low) / 2,
    volume: 1000,
  }));
}

describe("detectMarketStructure", () => {
  // Rising confirmed highs and lows should produce bullish structure.
  it("detects higher highs and higher lows", () => {
    const candles = makeCandles([
      [10, 5], [9, 6], [12, 7], [11, 8], [14, 9], [13, 10], [16, 11],
    ]);

    const result = detectMarketStructure(candles, 1);

    expect(result.higherHigh).toBe(true);
    expect(result.higherLow).toBe(true);
    expect(result.direction).toBe("bullish");
  });

  // Falling confirmed highs and lows should produce bearish structure.
  it("detects lower highs and lower lows", () => {
    const candles = makeCandles([
      [16, 11], [15, 12], [14, 9], [13, 10], [12, 7], [11, 8], [10, 5],
    ]);

    const result = detectMarketStructure(candles, 1);

    expect(result.lowerHigh).toBe(true);
    expect(result.lowerLow).toBe(true);
    expect(result.direction).toBe("bearish");
  });

  // Insufficient history must produce neutral structure instead of an invented signal.
  it("returns neutral for insufficient history", () => {
    const result = detectMarketStructure(makeCandles([[10, 5], [11, 6], [12, 7]]), 2);

    expect(result.direction).toBe("neutral");
    expect(result.breakOfStructure).toBe("none");
  });

  // Invalid configuration must fail early so the swing algorithm cannot index incorrectly.
  it("rejects an invalid lookback", () => {
    expect(() => detectMarketStructure(makeCandles([[10, 5], [11, 6], [12, 7]]), 0)).toThrow();
  });
});
