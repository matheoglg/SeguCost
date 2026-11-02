import { unitsToWeight } from './conversion';
import { can } from './permissions';
import { round2, round4 } from './rounding';
import { buildRoute } from './routing';

describe('unitsToWeight (RF-10)', () => {
  it('10.000 fundas de 4 g -> 40,00 kg / 88,18 lb', () => {
    expect(unitsToWeight(10_000, 4)).toEqual({ kg: 40, lb: 88.18 });
  });
  it('10.000 fundas de 12,5 g -> 125,00 kg / 275,58 lb', () => {
    expect(unitsToWeight(10_000, 12.5)).toEqual({ kg: 125, lb: 275.58 });
  });
});

describe('buildRoute (RF-11)', () => {
  it('natural -> EXT, SEL, EMP', () => {
    expect(buildRoute('natural')).toEqual(['extrusion', 'sealing', 'packing']);
  });
  it('impresa -> EXT, IMP, SEL, EMP', () => {
    expect(buildRoute('printed')).toEqual(['extrusion', 'printing', 'sealing', 'packing']);
  });
  it('vivero -> EXT, SEL, TRQ, EMP', () => {
    expect(buildRoute('nursery')).toEqual(['extrusion', 'sealing', 'dieCutting', 'packing']);
  });
});

describe('can (RF-03, Tabla 5.1)', () => {
  it('operario no ve costos ni precios', () => {
    expect(can('ope', 'orderCosts')).toBe(false);
    expect(can('ope', 'priceLookup')).toBe(false);
    expect(can('ope', 'laborCost')).toBe(false);
    expect(can('ope', 'mobileRecording', 'full')).toBe(true);
  });
  it('solo administración y RR. HH. ven el costo de mano de obra (RF-29)', () => {
    const roles = (['adm', 'ven', 'con', 'fac', 'rrhh', 'sup', 'ope'] as const).filter((r) => can(r, 'laborCost'));
    expect(roles).toEqual(['adm', 'rrhh']);
  });
  it('consulta (C) no permite edición', () => {
    expect(can('ven', 'catalog')).toBe(true);
    expect(can('ven', 'catalog', 'full')).toBe(false);
    expect(can('fac', 'priceLookup', 'full')).toBe(false);
  });
});

describe('rounding (RNF-20)', () => {
  it('rounds totals to 2 and unit values to 4 decimals', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(88.1848)).toBe(88.18);
    expect(round4(0.0365 * 1.3)).toBe(0.0475);
    expect(round4(0.02 / 0.75)).toBe(0.0267);
  });
});
