// Prices and hourly rates in force at a date (RF-41, RF-43, RF-44).
import { LB_PER_KG } from './conversion';
import type { MaterialUnit, Origin, ReferencePrice, Supplier, SupplierPrice } from './types';

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

/** Supplier chosen as reference for a material at a date (RF-44). */
export function referenceSupplierAt(references: ReferencePrice[], materialId: string, at: string): string | undefined {
  const day = dateKey(at);
  return references
    .filter((r) => r.materialId === materialId && dateKey(r.since) <= day)
    .sort((a, b) => a.since.localeCompare(b.since))
    .pop()?.supplierId;
}

/**
 * Reference price of a material used for costing. When the Administradora chose a supplier (RF-44),
 * its price in force is used; otherwise the quote with the most recent validity, preferring local or
 * own supply and then the lowest price.
 */
export function referenceQuote(
  prices: SupplierPrice[],
  suppliers: Supplier[],
  materialId: string,
  at: string,
  references: ReferencePrice[] = [],
): SupplierQuote | undefined {
  const quotes = quotesFor(prices, suppliers, materialId, at);
  const chosen = referenceSupplierAt(references, materialId, at);
  const chosenQuote = chosen && quotes.find((q) => q.supplier.id === chosen);
  if (chosenQuote) return chosenQuote;
  return quotes.sort(
    (a, b) =>
      b.price.validFrom.localeCompare(a.price.validFrom) ||
      ORIGIN_RANK[a.supplier.origin] - ORIGIN_RANK[b.supplier.origin] ||
      a.price.price - b.price.price,
  )[0];
}

export function referencePrice(prices: SupplierPrice[], suppliers: Supplier[], materialId: string, at: string, references: ReferencePrice[] = []): number {
  const quote = referenceQuote(prices, suppliers, materialId, at, references);
  return quote ? normalizedPrice(quote.price) : 0;
}

/** Price per material unit; a price per lb becomes a price per kg (× 2,20462) (RF-44). */
export function normalizedPrice(price: Pick<SupplierPrice, 'price' | 'priceUnit'>, materialUnit: MaterialUnit = 'kg'): number {
  if (price.priceUnit === 'lb' && materialUnit === 'kg') return price.price * LB_PER_KG;
  return price.price;
}

export interface PriceComparisonRow {
  supplier: Supplier;
  price: SupplierPrice;
  /** Price per kg (or per material unit when it is not kg). */
  unitPrice: number;
  /** Difference against the best local price: +0,019 = 1,9 % more expensive. Undefined for the best local. */
  vsBestLocal?: number;
  isReference: boolean;
}

/**
 * Comparison table of W-15 (RF-44): each supplier's price in force, normalized to USD/kg, with the
 * difference against the best local price and arrival days. Local and own supply first, then imported,
 * each by price.
 */
export function priceComparison(
  prices: SupplierPrice[],
  suppliers: Supplier[],
  references: ReferencePrice[],
  materialId: string,
  materialUnit: MaterialUnit,
  at: string,
): PriceComparisonRow[] {
  const quotes = quotesFor(prices, suppliers.filter((s) => s.active !== false), materialId, at).map((q) => ({
    ...q,
    unitPrice: normalizedPrice(q.price, materialUnit),
  }));
  const locals = quotes.filter((q) => q.supplier.origin !== 'imported');
  const bestLocal = locals.length ? Math.min(...locals.map((q) => q.unitPrice)) : undefined;
  const bestLocalId = locals.find((q) => q.unitPrice === bestLocal)?.supplier.id;
  const reference = referenceQuote(prices, suppliers, materialId, at, references)?.supplier.id;
  return quotes
    .map((q) => ({
      ...q,
      vsBestLocal: bestLocal === undefined || q.supplier.id === bestLocalId ? undefined : (q.unitPrice - bestLocal) / bestLocal,
      isReference: q.supplier.id === reference,
    }))
    .sort((a, b) => ORIGIN_RANK[a.supplier.origin] - ORIGIN_RANK[b.supplier.origin] || a.unitPrice - b.unitPrice);
}
