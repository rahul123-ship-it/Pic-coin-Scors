import { describe, expect, it } from "vitest";
import { ema } from "./ema";

describe("ema", () => {
  // Verify the function preserves the input length and starts from the first price.
  it("calculates a deterministic EMA series", () => {
    expect(ema([10, 12, 14], 2)).toEqual([10, 11.333333333333334, 13.11111111111111]);
  });

  // Empty input is a valid boundary case for indicator pipelines.
  it("returns an empty series for empty input", () => {
    expect(ema([], 9)).toEqual([]);
  });

  // Invalid periods must fail instead of producing misleading calculations.
  it("rejects invalid periods", () => {
    expect(() => ema([1, 2, 3], 0)).toThrow();
    expect(() => ema([1, 2, 3], -1)).toThrow();
    expect(() => ema([1, 2, 3], 1.5)).toThrow();
  });
});
