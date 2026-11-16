import { unitsToWeight } from './conversion';
import { can, MONEY_FEATURES, seesAmounts } from './permissions';
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

describe('can (RF-04, Tabla 6.1 del SRS v2.0)', () => {
  const ROLES = ['adm', 'ven', 'sup', 'ope'] as const;
  it('ope no ve montos', () => {
    expect(seesAmounts('ope')).toBe(false);
    for (const f of MONEY_FEATURES) expect(can('ope', f)).toBe(false);
    expect(can('ope', 'productionRecording', 'full')).toBe(true);
  });
  it('solo la Administradora autoriza excepciones y gestiona cuentas, parámetros y CSV', () => {
    for (const f of ['exceptions', 'users', 'costParams', 'csv', 'actualCost'] as const) {
      expect(ROLES.filter((r) => can(r, f))).toEqual(['adm']);
    }
  });
  it('el Supervisor edita fichas y fórmulas; Administradora y Ventas solo consultan', () => {
    expect(ROLES.filter((r) => can(r, 'productSheets', 'full'))).toEqual(['sup']);
    expect(ROLES.filter((r) => can(r, 'productSheets'))).toEqual(['adm', 'ven', 'sup']);
  });
  it('costo estimado: Administradora y Ventas', () => {
    expect(ROLES.filter((r) => can(r, 'estimatedCost'))).toEqual(['adm', 'ven']);
  });
  it('consulta (C) no permite edición', () => {
    expect(can('sup', 'commercial')).toBe(true);
    expect(can('sup', 'commercial', 'full')).toBe(false);
    expect(can('ven', 'materials', 'full')).toBe(false);
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
