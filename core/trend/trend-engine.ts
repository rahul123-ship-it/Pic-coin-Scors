// GOAL: Convert normalized candles into an explainable trend score.
// RESPONSIBILITY: Combine EMA alignment, price structure, volatility, and relative volume.
// DOES NOT: Fetch exchange data or emit trade orders.
import { atr } from "../indicators/atr";
import { ema } from "../indicators/ema";
import type { Candle, Direction, TrendResult } from "../../types/market";

// Keep scores inside the dashboard's 0-100 range.
function clamp(value: number, min: number, max: number): number {
  // Return the nearest boundary when the value falls outside the range.
  return Math.min(max, Math.max(min, value));
}

// Calculate one market's trend state from a closed-candle series.
export function calculateTrend(symbol: string, candles: Candle[]): TrendResult {
  // EMA-200 needs at least 200 observations to be meaningful.
  if (candles.length < 200) {
    throw new Error(`${symbol}: at least 200 candles are required`);
  }

  // Extract closes once because all EMAs use closing prices.
  const closes = candles.map((candle) => candle.close);

  // Calculate the three EMAs used by the scanner.
  const ema9Series = ema(closes, 9);
  const ema15Series = ema(closes, 15);
  const ema200Series = ema(closes, 200);

  // Calculate ATR so volatility can normalize EMA distance across different coins.
  const atrSeries = atr(candles, 14);

  // Read the latest closed candle as the current market state.
  const latest = candles[candles.length - 1];

  // Read the previous closed candle for short-term price direction and crossover state.
  const previous = candles[candles.length - 2];

  // Read the latest indicator values.
  const ema9 = ema9Series.at(-1) ?? latest.close;
  const ema15 = ema15Series.at(-1) ?? latest.close;
  const ema200 = ema200Series.at(-1) ?? latest.close;
  const previousEma9 = ema9Series.at(-2) ?? previous.close;
  const previousEma15 = ema15Series.at(-2) ?? previous.close;
  const latestAtr = atrSeries.at(-1) ?? 0;

  // Normalize ATR to price so different coins share the same volatility scale.
  const atrPercent = latest.close === 0 ? 0 : (latestAtr / latest.close) * 100;

  // Measure the absolute 9/15 EMA distance as a percentage of price.
  const emaSpreadPercent =
    latest.close === 0 ? 0 : (Math.abs(ema9 - ema15) / latest.close) * 100;

  // Express EMA distance in ATR units so weak and strong crossovers can be separated.
  const emaSpreadAtr = latestAtr > 0 ? Math.abs(ema9 - ema15) / latestAtr : 0;

  // Compare the latest volume with the previous 20 closed candles.
  const volumeWindow = candles.slice(-21, -1);
  const averageVolume =
    volumeWindow.reduce((sum, candle) => sum + candle.volume, 0) /
    Math.max(volumeWindow.length, 1);

  // Relative volume above 1 means the latest candle traded above its recent average.
  const rvol = averageVolume === 0 ? 0 : latest.volume / averageVolume;

  // A crossover exists only when the EMA ordering changed between closed candles.
  const crossover: Direction =
    previousEma9 <= previousEma15 && ema9 > ema15
      ? "bullish"
      : previousEma9 >= previousEma15 && ema9 < ema15
        ? "bearish"
        : "neutral";

  // Keep bullish and bearish evidence separate so the result remains explainable.
  let bullishPoints = 0;
  let bearishPoints = 0;

  // Store human-readable evidence for the dashboard.
  const reasons: string[] = [];

  // EMA 9 above EMA 15 is short-term bullish momentum.
  if (ema9 > ema15) bullishPoints += 25;

  // EMA 9 below EMA 15 is short-term bearish momentum.
  if (ema9 < ema15) bearishPoints += 25;

  // Price above EMA 200 is a broad bullish filter.
  if (latest.close > ema200) bullishPoints += 25;

  // Price below EMA 200 is a broad bearish filter.
  if (latest.close < ema200) bearishPoints += 25;

  // EMA 15 above EMA 200 strengthens bullish alignment.
  if (ema15 > ema200) bullishPoints += 20;

  // EMA 15 below EMA 200 strengthens bearish alignment.
  if (ema15 < ema200) bearishPoints += 20;

  // A higher latest close adds supporting bullish evidence.
  if (latest.close > previous.close) bullishPoints += 10;

  // A lower latest close adds supporting bearish evidence.
  if (latest.close < previous.close) bearishPoints += 10;

  // A confirmed bullish crossover gets a small ranking bonus.
  if (crossover === "bullish") bullishPoints += 10;

  // A confirmed bearish crossover gets a small ranking bonus.
  if (crossover === "bearish") bearishPoints += 10;

  // Strong EMA separation is more useful than a crossover where the lines remain almost identical.
  const separationPoints = clamp(emaSpreadAtr * 5, 0, 10);

  // Activity contributes to score but cannot create direction by itself.
  const activityPoints = clamp(rvol * 5, 0, 10);

  // Require a meaningful evidence gap before declaring a direction.
  const direction: Direction =
    bullishPoints > bearishPoints + 10
      ? "bullish"
      : bearishPoints > bullishPoints + 10
        ? "bearish"
        : "neutral";

  // Convert directional evidence into a stable ranking score.
  const directionScore = Math.abs(bullishPoints - bearishPoints);

  // Reward separation and activity without allowing either to dominate direction.
  const score = Math.round(clamp(directionScore + separationPoints + activityPoints, 0, 100));

  // Trend strength measures how far the EMA structure has separated in volatility units.
  const trendStrength = Number(clamp(emaSpreadAtr * 20, 0, 100).toFixed(2));

  // Explain the most important current conditions.
  if (ema9 > ema15) reasons.push("9 EMA is above 15 EMA");
  if (ema9 < ema15) reasons.push("9 EMA is below 15 EMA");
  if (crossover === "bullish") reasons.push("9/15 bullish crossover confirmed on a closed candle");
  if (crossover === "bearish") reasons.push("9/15 bearish crossover confirmed on a closed candle");
  if (latest.close > ema200) reasons.push("price is above 200 EMA");
  if (latest.close < ema200) reasons.push("price is below 200 EMA");
  if (emaSpreadAtr >= 1) reasons.push("9/15 EMA separation is at least 1 ATR");
  if (rvol >= 1.5) reasons.push("relative volume is elevated");
  if (atrPercent >= 1) reasons.push("volatility is active");

  // Return the complete analytical domain result.
  return {
    symbol,
    direction,
    crossover,
    score,
    trendStrength,
    ema9,
    ema15,
    ema200,
    emaSpreadPercent,
    emaSpreadAtr,
    atrPercent,
    rvol,
    reasons,
  };
}
