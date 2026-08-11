import { describe, expect, it } from "vitest";
import { qualifyTrend } from "./trend-qualification";
import type { TrendResult } from "../../types/market";

// Build a complete deterministic trend result so qualification tests do not depend on an exchange.
function makeTrend(overrides: Partial<TrendResult> = {}): TrendResult {
  // Start with a strong bearish candidate and override only the property under test.
  return {
    symbol: "TESTUSD",
    direction: "bearish",
    crossover: "neutral",
    score: 80,
    trendStrength: 50,
    ema9: 99,
    ema15: 100,
    ema200: 110,
    emaSpreadPercent: 1,
    emaSpreadAtr: 1.5,
    atrPercent: 1,
    rvol: 1,
    reasons: [],
    ...overrides,
  };
}

describe("qualifyTrend", () => {
  // A market passing every gate should be classified as a tradable trend candidate.
  it("qualifies a strong directional trend", () => {
    const result = qualifyTrend(makeTrend());

    expect(result.qualified).toBe(true);
    expect(result.regime).toBe("trending");
    expect(result.failed).toEqual([]);
  });

  // Neutral markets must never qualify as directional opportunities.
  it("rejects neutral markets", () => {
    const result = qualifyTrend(makeTrend({ direction: "neutral" }));

    expect(result.qualified).toBe(false);
    expect(result.regime).toBe("choppy");
    expect(result.failed).toContain("direction is neutral");
  });

  // A low score should fail even when the other quality measurements look healthy.
  it("rejects weak scores", () => {
    const result = qualifyTrend(makeTrend({ score: 59 }));

    expect(result.qualified).toBe(false);
    expect(result.failed).toContain("score < 60");
  });

  // A small EMA separation should prevent a nominal crossover from being called a strong trend.
  it("rejects weak EMA separation", () => {
    const result = qualifyTrend(makeTrend({ emaSpreadAtr: 0.2, trendStrength: 4 }));

    expect(result.qualified).toBe(false);
    expect(result.failed).toContain("EMA spread ATR < 0.75");
    expect(result.failed).toContain("trend strength < 20");
  });

  // The threshold is configurable so the scanner can be tuned without changing the engine.
  it("supports custom thresholds", () => {
    const result = qualifyTrend(makeTrend({ score: 55 }), {
      minimumScore: 50,
      minimumTrendStrength: 10,
      minimumEmaSpreadAtr: 0.5,
      minimumRvol: 0.5,
    });

    expect(result.qualified).toBe(true);
  });
});
