// GOAL: Calculate EMA values from a deterministic price series.
// RESPONSIBILITY: Pure EMA mathematics only.
// DOES NOT: Fetch prices, write data, or make trading decisions.
export function ema(values: number[], period: number): number[] {
  // Reject invalid periods early so callers get a predictable failure.
  if (period <= 0 || !Number.isInteger(period)) {
    throw new Error("EMA period must be a positive integer");
  }

  // Return an empty series when there is no input data.
  if (values.length === 0) return [];

  // The smoothing factor gives newer prices more weight.
  const multiplier = 2 / (period + 1);

  // Seed the EMA with the first available price.
  const result = [values[0]];

  // Calculate each later EMA from the previous EMA and current price.
  for (let index = 1; index < values.length; index += 1) {
    // Read the previous EMA so the recurrence is explicit.
    const previous = result[index - 1];

    // Apply the standard EMA recurrence.
    result.push((values[index] - previous) * multiplier + previous);
  }

  // Return one EMA value for every input price.
  return result;
}
