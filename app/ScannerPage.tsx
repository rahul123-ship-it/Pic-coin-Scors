// GOAL: Define the scanner page as a normal React component.
// RESPONSIBILITY: Fetch scanner DTOs and render the ranked market table.
// DOES NOT: Know Delta API endpoints or calculate indicators.
import { useQuery } from "@tanstack/react-query";

type ScannerMarket = {
  symbol: string;
  direction: "bullish" | "bearish" | "neutral";
  score: number;
  price: number;
  change24h: number;
  turnover24h: number;
  ema9: number;
  ema15: number;
  ema200: number;
  atrPercent: number;
  rvol: number;
  reasons: string[];
};

type ScannerResponse = {
  success: boolean;
  generatedAt: string;
  markets: ScannerMarket[];
};

// Fetch only the application API; provider details stay server-side.
async function fetchScanner(): Promise<ScannerResponse> {
  // Request the latest ranking from our Hono route.
  const response = await fetch("/api/scanner");

  // Fail loudly so TanStack Query can show its error state.
  if (!response.ok) {
    throw new Error(`Scanner request failed: ${response.status}`);
  }

  // Parse the JSON response once.
  return (await response.json()) as ScannerResponse;
}

// Format large turnover values without destroying useful precision.
function formatTurnover(value: number): string {
  // Use compact notation for dashboard readability.
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

// Render the complete first scanner screen.
export function ScannerPage() {
  // Keep server state in TanStack Query instead of global UI state.
  const query = useQuery({
    queryKey: ["scanner"],
    queryFn: fetchScanner,
    refetchInterval: 60_000,
  });

  // Render a clear loading state while the first scan runs.
  if (query.isLoading) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">PIC-COIN-SCORS</p>
          <h1>Finding the strongest trends.</h1>
          <p>
            Loading live Delta Exchange market data and calculating the 15m trend
            engine.
          </p>
        </section>
        <div className="panel loading">Scanning the market universe…</div>
      </main>
    );
  }

  // Render the actual error without exposing internal stack traces.
  if (query.isError) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">SCANNER ERROR</p>
          <h1>We could not complete the scan.</h1>
          <p>
            {query.error instanceof Error
              ? query.error.message
              : "Unknown error"}
          </p>
          <button onClick={() => query.refetch()}>Retry scan</button>
        </section>
      </main>
    );
  }

  // Keep the UI defensive even after the loading/error guards because query data is optional by type.
  if (!query.data) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">SCANNER ERROR</p>
          <h1>No scanner data was returned.</h1>
          <button onClick={() => query.refetch()}>Retry scan</button>
        </section>
      </main>
    );
  }

  // Read the validated response after all defensive guards have passed.
  const markets = query.data.markets;

  // Render the dashboard.
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">DELTA EXCHANGE · LIVE SCANNER</p>
          <h1>Which coins are actually trending?</h1>
          <p>
            15m context first. EMA 9/15 momentum is evaluated inside the broader
            trend rather than treated as a standalone signal.
          </p>
        </div>
        <div className="hero-actions">
          <span className="status-dot" />
          <span>Live data</span>
          <button onClick={() => query.refetch()}>Refresh</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Trend ranking</h2>
            <p>{markets.length} liquid perpetual markets analyzed</p>
          </div>
          <span className="timestamp">
            Updated {new Date(query.data.generatedAt).toLocaleTimeString()}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Market</th>
                <th>Direction</th>
                <th>Score</th>
                <th>24h</th>
                <th>Price</th>
                <th>EMA 9 / 15</th>
                <th>EMA 200</th>
                <th>RVOL</th>
                <th>ATR</th>
                <th>Turnover</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market, index) => (
                <tr key={market.symbol}>
                  <td className="rank">{index + 1}</td>
                  <td>
                    <strong>{market.symbol}</strong>
                    <div className="reason">
                      {market.reasons[0] ?? "No dominant evidence"}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${market.direction}`}>
                      {market.direction}
                    </span>
                  </td>
                  <td>
                    <strong>{market.score}</strong>
                    <div className="score-track">
                      <span style={{ width: `${market.score}%` }} />
                    </div>
                  </td>
                  <td className={market.change24h >= 0 ? "positive" : "negative"}>
                    {market.change24h.toFixed(2)}%
                  </td>
                  <td>
                    {market.price.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}
                  </td>
                  <td>
                    {market.ema9.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                    <br />
                    <span className="muted">
                      {market.ema15.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  </td>
                  <td>
                    {market.ema200.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td>{market.rvol.toFixed(2)}×</td>
                  <td>{market.atrPercent.toFixed(2)}%</td>
                  <td>{formatTurnover(market.turnover24h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {markets.length === 0 && (
          <div className="empty">
            No markets produced a valid trend calculation yet.
          </div>
        )}
      </section>

      <section className="notes">
        <div>
          <strong>How this version works</strong>
          <span>
            Market liquidity → 15m candles → EMA alignment → volatility/activity
            → explainable score.
          </span>
        </div>
        <div>
          <strong>Important</strong>
          <span>This is analysis only. It does not place orders.</span>
        </div>
      </section>
    </main>
  );
}
