// Rounding rules (RNF-20): totals to 2 decimals, unit costs and prices to 4.

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  // EPSILON nudge avoids 1.005 -> 1.00 style binary rounding errors.
  return Math.round((value + Math.sign(value) * Number.EPSILON) * factor) / factor;
}

export const round2 = (value: number) => roundTo(value, 2);
export const round4 = (value: number) => roundTo(value, 4);
