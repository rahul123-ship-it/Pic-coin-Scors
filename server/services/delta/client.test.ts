import { afterEach, describe, expect, it, vi } from "vitest";
import { getPerpetualProducts } from "./client";

describe("Delta provider client", () => {
  // Restore the global fetch implementation after each isolated provider test.
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // A valid provider payload must be normalized into the application's product model.
  it("normalizes a valid product response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: [
            {
              id: 27,
              symbol: "BTCUSD",
              contract_type: "perpetual_futures",
              state: "live",
              trading_status: "operational",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    // Replace only the network boundary so the test remains deterministic.
    vi.stubGlobal("fetch", fetchMock);

    // Call the real normalization code against the fake provider response.
    await expect(getPerpetualProducts()).resolves.toEqual([
      {
        id: 27,
        symbol: "BTCUSD",
        contractType: "perpetual_futures",
        state: "live",
        tradingStatus: "operational",
      },
    ]);
  });

  // A temporary server failure should be retried instead of immediately breaking the scan.
  it("retries transient provider failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporary failure", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, result: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    // Replace the network boundary with the deterministic failure/success sequence.
    vi.stubGlobal("fetch", fetchMock);

    // The second attempt succeeds, proving the retry path is active.
    await expect(getPerpetualProducts()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // A malformed provider payload must fail closed rather than silently producing bad market data.
  it("rejects malformed provider responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: [{ unexpected: true }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    // Replace the network boundary with an invalid response.
    vi.stubGlobal("fetch", fetchMock);

    // The runtime schema must prevent malformed provider data from reaching the scanner.
    await expect(getPerpetualProducts()).rejects.toThrow(
      "Delta API returned an unexpected response shape",
    );
  });
});
