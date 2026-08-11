import { describe, expect, it } from "vitest";
import { calculateTrend } from "./trend-engine";
import type { Candle } from "../../types/market";

// Build deterministic synthetic candles so trend tests never depend on live markets.
function makeCandles(direction: "up" | "down"): Candle[] {
  // Generate more than EMA-200's minimum so all windows have enough history.
  return Array.from({ length: 220 }, (_, index) => {
    // Create a smooth directional close series without random noise.
    const close = direction === "up" ? 100 + index * 0.5 : 200 - index * 0.5;

    // Keep OHLC internally consistent around the generated close.
    return {
      time: index * 900,
      open: close - 0.2,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 1_000 + index,
    };
  });
}

describe("calculateTrend", () => {
  // A strongly rising deterministic series should produce bullish evidence.
  it("recognizes an upward trend", () => {
    const result = calculateTrend("TESTUSD", makeCandles("up"));

    expect(result.direction).toBe("bullish");
    expect(result.score).toBeGreaterThan(0);
    expect(result.trendStrength).toBeGreaterThan(0);
    expect(result.emaSpreadPercent).toBeGreaterThan(0);
    expect(result.emaSpreadAtr).toBeGreaterThan(0);
    expect(Number.isFinite(result.ema9)).toBe(true);
    expect(Number.isFinite(result.ema15)).toBe(true);
    expect(Number.isFinite(result.ema200)).toBe(true);
  });

  // A strongly falling deterministic series should produce bearish evidence.
  it("recognizes a downward trend", () => {
    const result = calculateTrend("TESTUSD", makeCandles("down"));

    expect(result.direction).toBe("bearish");
    expect(result.score).toBeGreaterThan(0);
  });

  // A crossover should be detected only when the closed-candle EMA ordering changes.
  it("reports the current crossover state", () => {
    const result = calculateTrend("TESTUSD", makeCandles("up"));

    // The smooth rising series has already crossed, so the current state is neutral for 'new crossover'.
    expect(result.crossover).toBe("neutral");
  });

  // The engine must refuse insufficient history instead of inventing an EMA-200 state.
  it("requires enough candles", () => {
    expect(() => calculateTrend("TESTUSD", makeCandles("up").slice(0, 199))).toThrow(
      "at least 200 candles are required",
    );
  });
});
