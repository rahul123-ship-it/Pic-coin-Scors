import { describe, expect, it } from "vitest";
import { calculateTrend } from "./trend-engine";
import { qualifyTrend } from "./trend-qualification";
import type { Candle } from "../../types/market";

// Create deterministic market history for end-to-end trend screening tests.
function makeCandles(direction: "up" | "down" | "flat"): Candle[] {
  // Generate enough closed candles for EMA-200, ATR, and relative-volume windows.
  return Array.from({ length: 240 }, (_, index) => {
    // Keep flat markets stable while directional markets gain a deterministic slope.
    const slope = direction === "up" ? 0.5 : direction === "down" ? -0.5 : 0;
    const close = 100 + index * slope;

    // Give every candle a valid OHLC range around its close.
    return {
      time: index * 900,
      open: close - 0.2,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: direction === "flat" ? 100 : 1_000,
    };
  });
}

describe("trend screening pipeline", () => {
  // Strong deterministic direction should survive both trend calculation and qualification.
  it("accepts a strong directional market", () => {
    const trend = calculateTrend("TESTUSD", makeCandles("up"));
    const qualification = qualifyTrend(trend);

    expect(trend.direction).toBe("bullish");
    expect(qualification.qualified).toBe(true);
    expect(qualification.regime).toBe("trending");
  });

  // Flat prices should never become a directional candidate merely because the scanner has data.
  it("rejects a flat market", () => {
    const trend = calculateTrend("TESTUSD", makeCandles("flat"));
    const qualification = qualifyTrend(trend);

    expect(trend.direction).toBe("neutral");
    expect(qualification.qualified).toBe(false);
    expect(qualification.regime).toBe("choppy");
  });
});
