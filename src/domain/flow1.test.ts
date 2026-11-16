// Domain rules used by flow 1 (W-15, W-20) and the price over cost of the quotes (RF-17, RF-18).
import { createSeed } from '@/data/seed';
import { IMPORT_TEMPLATE, SAMPLE_FILE_CORRECTED, validateImport, validRows } from './csvImport';
import { normalizedPrice, priceComparison } from './prices';
import { isException, lineEconomics, priceOnCost } from './pricing';

const NOW = new Date(2026, 10, 9, 12, 24);
const db = createSeed(NOW);

describe('priceOnCost (RF-17)', () => {
  it('0,0371 al 25 % -> 0,0464', () => {
    expect(priceOnCost(0.0371, 0.25)).toBe(0.0464);
  });
  it('uses exact decimals: 0,1 + 0,2 style errors do not appear', () => {
    expect(priceOnCost('0.0103', '0.15')).toBe(0.0118);
  });
});

describe('isException (RF-18)', () => {
  it('15 % con mínimo 20 % -> true; 20 % -> false', () => {
    expect(isException(0.15, 0.2)).toBe(true);
    expect(isException(0.2, 0.2)).toBe(false);
  });
});

describe('lineEconomics (W-08 figures)', () => {
  it('FI-4060 10.000 u: 205,28 + 166,15 = 371,43; 0,0371 por funda; 25 % -> 0,0464; ganancia 92,86', () => {
    expect(lineEconomics({ quantity: 10_000, materials: 205.28, transformation: 166.15, marginPct: 0.25 })).toEqual({
      estimatedCost: 371.43,
      unitCost: 0.0371,
      price: 0.0464,
      profit: 92.86,
    });
  });
  it('FN-2030 50.000 u at 15 %: price from the unrounded unit cost -> 0,0119; ganancia 77,57', () => {
    expect(lineEconomics({ quantity: 50_000, materials: 296.4, transformation: 220.75, marginPct: 0.15 })).toMatchObject({
      estimatedCost: 517.15,
      unitCost: 0.0103,
      price: 0.0119,
      profit: 77.57,
    });
  });
});

describe('priceComparison (RF-44)', () => {
  const rows = priceComparison(db.supplierPrices, db.suppliers, db.referencePrices, 'm-pebd', 'kg', NOW.toISOString());
  it('lists local first, then imported, each by price, with the reference marked', () => {
    expect(rows.map((r) => [r.supplier.name, r.unitPrice, r.isReference])).toEqual([
      ['Plásticos del Litoral', 1.58, true],
      ['Distribuidora Polímeros GYE', 1.61, false],
      ['Resinas Andinas Import.', 1.4, false],
      ['Global Resins (demo)', 1.44, false],
    ]);
  });
  it('difference against the best local price: —, +1,9 %, −11,4 %, −8,9 %', () => {
    expect(rows.map((r) => (r.vsBestLocal === undefined ? undefined : Math.round(r.vsBestLocal * 1000) / 10))).toEqual([undefined, 1.9, -11.4, -8.9]);
  });
  it('a price per lb is shown per kg', () => {
    expect(normalizedPrice({ price: 0.7, priceUnit: 'lb' })).toBeCloseTo(1.5432, 4);
    expect(normalizedPrice({ price: 9.8 }, 'l')).toBe(9.8);
  });
});

describe('validateImport (RF-50)', () => {
  it('the template parses without errors and without data beyond its examples', () => {
    const r = validateImport(IMPORT_TEMPLATE, { customers: [], materials: [], products: [] });
    expect(r.errors).toEqual([]);
    expect(validRows(r)).toBe(3);
  });
  it('rejects a file whose header is not the template', () => {
    expect(validateImport('a,b,c\n1,2,3\n', db).errors[0].problem).toMatch(/encabezado/);
  });
  it('checks RUC, categories, units, numbers and duplicates inside the file', () => {
    const file = [
      'tipo,codigo,nombre,categoria,unidad,ruc,ancho_cm,largo_cm,calibre,material,peso_unitario_g,exclusivo',
      'cliente,,Cliente X,,,123,,,,,,',
      'insumo,ZZ-1,Algo,colorante,galón,,,,,,,',
      'producto,PX-1,Funda,,,,0,40,1.5,PEBD,6,talvez',
      'producto,PX-1,Funda repetida,,,,30,40,1.5,PEBD,6,no',
      'servicio,,X,,,,,,,,,',
    ].join('\n');
    const problems = validateImport(file, db).errors.map((e) => `${e.row}:${e.field}`);
    expect(problems).toEqual(['2:ruc', '3:categoría', '3:unidad', '4:ancho_cm', '4:exclusivo', '5:código', '6:tipo']);
  });
  it('the corrected demo file is fully valid', () => {
    const r = validateImport(SAMPLE_FILE_CORRECTED, db);
    expect(r.errors).toEqual([]);
    expect(validRows(r)).toBe(50);
  });
});
