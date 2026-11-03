// Prices and hourly rates in force at a date (RF-26, RF-27, RF-29, RF-30).
import type { Origin, Supplier, SupplierPrice } from './types';

/** 'YYYY-MM-DD' or ISO timestamp -> comparable 'YYYY-MM-DD' (local date). */
export function dateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Latest record with validFrom <= date; later entries in the list win ties. */
export function inForce<T extends { validFrom: string }>(records: T[], at: string): T | undefined {
  const day = dateKey(at);
  let best: T | undefined;
  for (const r of records) {
    if (r.validFrom <= day && (!best || r.validFrom >= best.validFrom)) best = r;
  }
  return best;
}

/** Hourly cost in force for a position or machine. */
export function rateAt<T extends { validFrom: string; hourlyCost: number }>(
  rates: T[],
  match: (r: T) => boolean,
  at: string,
): number {
  return inForce(rates.filter(match), at)?.hourlyCost ?? 0;
}

export interface SupplierQuote {
  supplier: Supplier;
  price: SupplierPrice;
}

/** Price in force of each supplier of a material at a date. */
export function quotesFor(prices: SupplierPrice[], suppliers: Supplier[], materialId: string, at: string): SupplierQuote[] {
  return suppliers
    .map((supplier) => {
      const price = inForce(prices.filter((p) => p.materialId === materialId && p.supplierId === supplier.id), at);
      return price && { supplier, price };
    })
    .filter((q): q is SupplierQuote => Boolean(q));
}

const ORIGIN_RANK: Record<Origin, number> = { own: 0, local: 0, imported: 1 };

/**
 * Reference price of a material used for costing: the quote with the most recent validity (RF-26).
 * Ties (several suppliers updated the same day) prefer local or own supply, then the lowest price.
 */
export function referenceQuote(prices: SupplierPrice[], suppliers: Supplier[], materialId: string, at: string): SupplierQuote | undefined {
  return quotesFor(prices, suppliers, materialId, at).sort(
    (a, b) =>
      b.price.validFrom.localeCompare(a.price.validFrom) ||
      ORIGIN_RANK[a.supplier.origin] - ORIGIN_RANK[b.supplier.origin] ||
      a.price.price - b.price.price,
  )[0];
}

export function referencePrice(prices: SupplierPrice[], suppliers: Supplier[], materialId: string, at: string): number {
  return referenceQuote(prices, suppliers, materialId, at)?.price.price ?? 0;
}
