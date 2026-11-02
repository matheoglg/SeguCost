// Stage route by product type (RF-11).
import type { MachineSection, ProductType, StageType } from './types';

/** natural: EXT, SEL, EMP; printed adds IMP after EXT; nursery adds TRQ after SEL. */
export function buildRoute(type: ProductType): StageType[] {
  const route: StageType[] = ['extrusion'];
  if (type === 'printed') route.push('printing');
  route.push('sealing');
  if (type === 'nursery') route.push('dieCutting');
  route.push('packing');
  return route;
}

/** Machine section for a stage; packing is manual and has none. */
export function sectionOf(stage: StageType): MachineSection | undefined {
  return stage === 'packing' ? undefined : stage;
}
