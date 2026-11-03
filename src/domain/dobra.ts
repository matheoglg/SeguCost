// File exchange with Dobra (RF-43, RF-44). Provisional format until spike SP-01 closes.
import type { Material, MaterialType, MaterialUnit, Origin, Product, ProductLine, ProductType, Supplier } from './types';

export const EXPORT_HEADER = 'codigo,nombre,costo_unitario,precio_referencial,fecha';

export interface ExportRow {
  code: string;
  name: string;
  unitCost: number;
  price: number;
  date: string; // YYYY-MM-DD
}

const csvField = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV for Dobra: dot decimals, 4 decimals for unit values (machine-readable). */
export function buildExportCsv(rows: ExportRow[]): string {
  const lines = rows.map((r) => [r.code, r.name, r.unitCost.toFixed(4), r.price.toFixed(4), r.date].map(csvField).join(','));
  return [EXPORT_HEADER, ...lines].join('\n') + '\n';
}

// ---- catalog import ----

export const IMPORT_HEADER = ['entidad', 'codigo', 'nombre', 'tipo', 'unidad', 'ancho_cm', 'largo_cm', 'calibre', 'peso_g', 'linea', 'origen'] as const;

export const IMPORT_TEMPLATE = [
  IMPORT_HEADER.join(','),
  'insumo,ADT-A,Aditivo antiestático,aditivo,kg,,,,,,',
  'funda,FN-3040,Funda natural 30x40,natural,,30,40,1.5,6.5,Comercial,',
  'proveedor,,Resinas Muestra Andina S.A.,,,,,,,,local',
].join('\n') + '\n';

/** Parses simple CSV (comma separated, optional double quotes). */
export function parseCsv(text: string): string[][] {
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const out: string[] = [];
      let cur = '';
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') quoted = false;
          else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') {
          out.push(cur.trim());
          cur = '';
        } else cur += ch;
      }
      out.push(cur.trim());
      return out;
    });
}

const MATERIAL_TYPES: Record<string, MaterialType> = { resina: 'resin', pigmento: 'pigment', tinta: 'ink', aditivo: 'additive', reciclado: 'recycled' };
const UNITS: Record<string, MaterialUnit> = { kg: 'kg', lb: 'lb', litro: 'l', l: 'l' };
const PRODUCT_TYPES: Record<string, ProductType> = { natural: 'natural', impresa: 'printed', vivero: 'nursery' };
const ORIGINS: Record<string, Origin> = { local: 'local', importado: 'imported' };

export interface ImportCatalog {
  materials: Material[];
  products: Product[];
  suppliers: Supplier[];
  productLines: ProductLine[];
}

export interface ImportResult {
  materials: Omit<Material, 'id'>[];
  products: Omit<Product, 'id'>[];
  suppliers: Omit<Supplier, 'id'>[];
  rejected: { row: number; reason: string }[];
  skipped: { row: number; reason: string }[];
  totalRows: number;
}

/**
 * Validates an import file: valid rows are returned to be loaded, rows with errors are listed
 * with their number (row 1 is the header) and reason, and rows that already exist are skipped (RF-44).
 */
export function validateCatalogImport(text: string, catalog: ImportCatalog): ImportResult {
  const result: ImportResult = { materials: [], products: [], suppliers: [], rejected: [], skipped: [], totalRows: 0 };
  const [header, ...rows] = parseCsv(text);
  if (!header || header[0]?.toLowerCase() !== 'entidad') {
    result.rejected.push({ row: 1, reason: 'El encabezado no corresponde a la plantilla' });
    return result;
  }
  result.totalRows = rows.length;
  const seen = new Set<string>();
  const num = (v: string) => (v === '' ? NaN : Number(v.replace(',', '.')));
  const lower = (v: string) => v.toLowerCase();

  rows.forEach((cells, index) => {
    const row = index + 2;
    const [entidad, codigo, nombre, tipo, unidad, ancho, largo, calibre, peso, linea, origen] = IMPORT_HEADER.map((_, i) => cells[i] ?? '');
    const reject = (reason: string) => result.rejected.push({ row, reason });
    const skip = (reason: string) => result.skipped.push({ row, reason });
    if (!nombre) return reject('Falta el nombre');

    switch (lower(entidad)) {
      case 'insumo': {
        const type = MATERIAL_TYPES[lower(tipo)];
        const unit = UNITS[lower(unidad)];
        if (!codigo) return reject('Falta el código del insumo');
        if (!type) return reject(`Tipo de insumo no válido: "${tipo}"`);
        if (!unit) return reject(`Unidad no válida: "${unidad}" (use kg, lb o litro)`);
        const key = `m:${lower(codigo)}`;
        if (seen.has(key) || catalog.materials.some((m) => lower(m.code) === lower(codigo) || lower(m.name) === lower(nombre))) return skip('El insumo ya existe');
        seen.add(key);
        result.materials.push({ code: codigo.toUpperCase(), name: nombre, type, unit, active: true });
        return;
      }
      case 'funda': {
        const type = PRODUCT_TYPES[lower(tipo)];
        const weightG = num(peso);
        const line = catalog.productLines.find((l) => lower(l.name) === lower(linea) || l.id === linea);
        if (!codigo) return reject('Falta el código de la funda');
        if (!type) return reject(`Tipo de funda no válido: "${tipo}" (use natural, impresa o vivero)`);
        if (!(weightG > 0)) return reject('El peso por unidad debe ser mayor que cero');
        if (!(num(ancho) > 0) || !(num(largo) > 0)) return reject('Ancho y largo deben ser mayores que cero');
        if (!line) return reject(`Línea no encontrada: "${linea}"`);
        const key = `p:${lower(codigo)}`;
        if (seen.has(key) || catalog.products.some((p) => lower(p.code) === lower(codigo))) return skip('La funda ya existe');
        seen.add(key);
        result.products.push({
          code: codigo.toUpperCase(),
          name: nombre,
          widthCm: num(ancho),
          lengthCm: num(largo),
          gauge: num(calibre) || 0,
          weightG,
          type,
          lineId: line.id,
          active: true,
        });
        return;
      }
      case 'proveedor': {
        const origin = ORIGINS[lower(origen)];
        if (!origin) return reject(`Origen no válido: "${origen}" (use local o importado)`);
        const key = `s:${lower(nombre)}`;
        if (seen.has(key) || catalog.suppliers.some((s) => lower(s.name) === lower(nombre))) return skip('El proveedor ya existe');
        seen.add(key);
        result.suppliers.push({ name: nombre, origin });
        return;
      }
      default:
        return reject(`Entidad no válida: "${entidad}" (use insumo, funda o proveedor)`);
    }
  });
  return result;
}

/** Demo file for the import tab: 10 rows, 2 with errors and 1 already loaded. */
export const IMPORT_SAMPLE_WITH_ERRORS = [
  IMPORT_HEADER.join(','),
  'insumo,ADT-A,Aditivo antiestático,aditivo,kg,,,,,,',
  'insumo,PIG-B,Pigmento blanco (masterbatch),pigmento,kg,,,,,,',
  'insumo,PIG-V,Pigmento verde (masterbatch),colorante,kg,,,,,,',
  'insumo,PEBD,Polietileno de baja densidad (pepitas),resina,kg,,,,,,',
  'funda,FN-3040,Funda natural 30x40,natural,,30,40,1.5,6.5,Comercial,',
  'funda,FI-3045,Funda impresa 30x45 con logo,impresa,,30,45,1.8,8.2,Impresas personalizadas,',
  'funda,FV-2025,Funda de vivero 20x25,vivero,,20,25,2.5,0,Agrícola,',
  'funda,FB-3040,Funda de basura negra 30x40,natural,,30,40,1.2,9.5,Reciclada,',
  'proveedor,,Resinas Muestra Andina S.A.,,,,,,,,local',
  'proveedor,,Polymer Sample Trading Ltd.,,,,,,,,importado',
].join('\n') + '\n';
