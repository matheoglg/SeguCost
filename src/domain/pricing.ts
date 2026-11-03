// Pricing and purchasing rules (RF-28, RF-36 to RF-38).
import { round2, round4 } from './rounding';
import type { MarginMethod, PriceProposal } from './types';

/** On cost: P = CU × (1 + m). On price: P = CU / (1 − m). 4 decimals. */
export function priceFromMargin(unitCost: number, margin: number, method: MarginMethod): number {
  if (method === 'onCost') return round4(unitCost * (1 + margin));
  if (margin >= 1) return NaN;
  return round4(unitCost / (1 - margin));
}

/** Margin under the line minimum needs a justification to be approved (RF-37). */
export function belowMinimum(margin: number, minMargin: number): boolean {
  return margin < minMargin;
}

/** Profit per unit (4 decimals) and per order (2 decimals). */
export function profit(price: number, unitCost: number, quantity: number) {
  return { perUnit: round4(price - unitCost), perOrder: round2((price - unitCost) * quantity) };
}

export type PurchaseSuggestion = 'local' | 'import';

/**
 * Compares the best local and imported prices (RF-28). The difference is measured over the local price:
 * 1,50 vs 1,40 -> 6,7 %. Below the threshold (10 % by default) buying local is suggested.
 */
export function suggestPurchase(bestLocal: number, bestImported: number, threshold: number) {
  const difference = bestLocal > 0 ? (bestLocal - bestImported) / bestLocal : 0;
  const suggestion: PurchaseSuggestion = difference < threshold ? 'local' : 'import';
  return { difference, suggestion };
}

/** Approved reference price in force for a product: the most recently approved proposal (RF-38). */
export function currentReferencePrice(proposals: PriceProposal[], productId: string): PriceProposal | undefined {
  return proposals
    .filter((p) => p.productId === productId && p.status === 'approved')
    .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''))[0];
}
