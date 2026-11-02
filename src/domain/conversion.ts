// Units to weight conversion (RF-10).
import { round2 } from './rounding';

export const LB_PER_KG = 2.20462;

/** kg = quantity × weight_g / 1000; lb = kg × 2.20462. Both rounded to 2 decimals. */
export function unitsToWeight(quantity: number, weightG: number): { kg: number; lb: number } {
  const kg = (quantity * weightG) / 1000;
  return { kg: round2(kg), lb: round2(kg * LB_PER_KG) };
}
