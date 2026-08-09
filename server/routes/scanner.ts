// GOAL: Orchestrate provider data and the pure trend engine for the scanner API.
// RESPONSIBILITY: Select liquid markets, calculate trends, and return safe DTOs.
// DOES NOT: Render UI or expose provider-specific response shapes.
import { Hono } from "hono";
import { calculateTrend } from "../../core/trend/trend-engine";
import {
  getCandles,
  getPerpetualProducts,
  getPerpetualTickers,
} from "../services/delta/client";

// Create a small router so the Hono application stays modular.
export const scannerRoute = new Hono();

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

  // Sort by turnover because raw contract volume is not comparable across instruments.
  eligible.sort((a, b) => b.ticker.turnover24h - a.ticker.turnover24h);

  // Limit candle analysis to the most liquid 12 markets for predictable latency.
  const candidates = eligible.slice(0, 12);

  // Calculate each market independently so one malformed market does not kill the scan.
  const results = await Promise.all(
    candidates.map(async ({ product, ticker }) => {
      try {
        // Use 15-minute candles for the first trend-ranking version.
        const candles = await getCandles(product.symbol, "15m", 240);

        // Require enough data for EMA-200.
        if (candles.length < 200) return null;

        // Run the framework-independent trend engine.
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
