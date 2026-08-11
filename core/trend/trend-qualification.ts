import type { Direction, TrendResult } from "../../types/market";

// GOAL: Decide whether a calculated trend is strong enough to be considered a tradable trend candidate.
// RESPONSIBILITY: Apply explicit, configurable quality gates without creating trade orders.
// DOES NOT: Fetch data, predict returns, or guarantee a profitable trade.
export type TrendRegime = "trending" | "weak-trend" | "choppy";

// Keep thresholds in one immutable object so the strategy can be tuned later without hidden constants.
export interface TrendQualificationConfig {
  minimumScore: number;
  minimumTrendStrength: number;
  minimumEmaSpreadAtr: number;
  minimumRvol: number;
}

// Return the default screening policy for the first live scanner version.
export const DEFAULT_TREND_QUALIFICATION: TrendQualificationConfig = {
  minimumScore: 60,
  minimumTrendStrength: 20,
  minimumEmaSpreadAtr: 0.75,
  minimumRvol: 0.75,
};

// Describe the result of every quality gate so the UI can explain why a market was rejected.
export interface TrendQualification {
  regime: TrendRegime;
  qualified: boolean;
  score: number;
  passed: string[];
  failed: string[];
}

// Evaluate trend quality using only the already-calculated normalized trend result.
export function qualifyTrend(
  trend: TrendResult,
  config: TrendQualificationConfig = DEFAULT_TREND_QUALIFICATION,
): TrendQualification {
  // A neutral direction cannot qualify as a directional trend regardless of volume.
  if (trend.direction === "neutral") {
    return {
      regime: "choppy",
      qualified: false,
      score: 0,
      passed: [],
      failed: ["direction is neutral"],
    };
  }

  // Record each independent gate so a rejected market remains explainable.
  const passed: string[] = [];
  const failed: string[] = [];

  // The trend score must clear the configured minimum.
  if (trend.score >= config.minimumScore) {
    passed.push(`score >= ${config.minimumScore}`);
  } else {
    failed.push(`score < ${config.minimumScore}`);
  }

  // EMA separation must be meaningful relative to volatility.
  if (trend.trendStrength >= config.minimumTrendStrength) {
    passed.push(`trend strength >= ${config.minimumTrendStrength}`);
  } else {
    failed.push(`trend strength < ${config.minimumTrendStrength}`);
  }

  // Require a minimum EMA distance in ATR units to reduce near-flat crossovers.
  if (trend.emaSpreadAtr >= config.minimumEmaSpreadAtr) {
    passed.push(`EMA spread ATR >= ${config.minimumEmaSpreadAtr}`);
  } else {
    failed.push(`EMA spread ATR < ${config.minimumEmaSpreadAtr}`);
  }

  // Require at least normal recent participation; the threshold remains deliberately modest.
  if (trend.rvol >= config.minimumRvol) {
    passed.push(`RVOL >= ${config.minimumRvol}`);
  } else {
    failed.push(`RVOL < ${config.minimumRvol}`);
  }

  // All gates must pass before the scanner labels the market as a trend candidate.
  const qualified = failed.length === 0;

  // Distinguish a useful trend from a directional but weak setup.
  const regime: TrendRegime = qualified ? "trending" : "weak-trend";

  // Keep the original trend score visible because qualification is a filter, not a replacement score.
  return {
    regime,
    qualified,
    score: trend.score,
    passed,
    failed,
  };
}
