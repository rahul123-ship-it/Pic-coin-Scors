// GOAL: Orchestrate provider data and the pure trend engine for the scanner API.
// RESPONSIBILITY: Select liquid markets, validate candle quality, calculate trends, and return safe DTOs.
// DOES NOT: Render UI or expose provider-specific response shapes.
import { Hono } from "hono";
import { closedCandles, normalizeCandles } from "../../core/indicators/validation";
import { calculateTrend } from "../../core/trend/trend-engine";
import {
  getCandles,
  getPerpetualProducts,
  getPerpetualTickers,
} from "../services/delta/client";

// Create a small router so the Hono application stays modular.
export const scannerRoute = new Hono();

// Keep the first production scan bounded so provider latency remains predictable.
const MAX_MARKETS_PER_SCAN = 12;

// Return ranked live markets for the dashboard.
scannerRoute.get("/", async (context) => {
  // Load the exchange universe and current liquidity snapshot in parallel.
  const [products, tickers] = await Promise.all([
    getPerpetualProducts(),
    getPerpetualTickers(),
  ]);

  // Index tickers by symbol so joining products stays O(n).
  const tickerBySymbol = new Map(tickers.map((ticker) => [ticker.symbol, ticker]));

  // Keep only markets that exist in both datasets.
  const eligible = products
    .map((product) => {
      // Locate the corresponding live ticker.
      const ticker = tickerBySymbol.get(product.symbol);

      // Return a compact selection object for ranking.
      return ticker ? { product, ticker } : null;
    })
    .filter(
      (
        item,
      ): item is {
        product: (typeof products)[number];
        ticker: (typeof tickers)[number];
      } => item !== null,
    );

  // Sort by Delta turnover because raw contract volume is not comparable across coins.
  eligible.sort((a, b) => b.ticker.turnover24h - a.ticker.turnover24h);

  // Limit candle analysis so one scan cannot create unbounded provider work.
  const candidates = eligible.slice(0, MAX_MARKETS_PER_SCAN);

  // Calculate each market independently so one bad market cannot kill the entire scan.
  const results = await Promise.all(
    candidates.map(async ({ product, ticker }) => {
      try {
        // Request 15-minute history because this first scanner uses 15m as market context.
        const rawCandles = await getCandles(product.symbol, "15m", 240);

        // Remove malformed records and duplicate timestamps before calculations.
        const normalizedCandles = normalizeCandles(rawCandles);

        // Exclude the currently forming candle so signals cannot repaint before candle close.
        const candles = closedCandles(normalizedCandles, 15 * 60);

        // Require enough closed data for EMA-200 and the trend engine's other windows.
        if (candles.length < 200) return null;

        // Run the framework-independent trend engine only on trusted closed data.
        const trend = calculateTrend(product.symbol, candles);

        // Return market context together with the analytical result.
        return {
          ...trend,
          price: ticker.lastPrice,
          change24h: ticker.change24h,
          turnover24h: ticker.turnover24h,
        };
      } catch (error) {
        // Log the symbol but keep provider errors out of the client response.
        console.warn(`Scanner skipped ${product.symbol}`, error);

        // Ignore a single market failure and keep the scanner useful.
        return null;
      }
    }),
  );

  // Remove failed market calculations and rank strongest trends first.
  const ranked = results
    .filter((item): item is NonNullable<(typeof results)[number]> => item !== null)
    .sort((a, b) => b.score - a.score);

  // Return a stable API envelope for TanStack Query.
  return context.json({
    success: true,
    generatedAt: new Date().toISOString(),
    markets: ranked,
  });
});
