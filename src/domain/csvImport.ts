// Initial data import from SeguCost's own CSV template (RF-50): customers, materials and products.
// The file is validated first; if any row has an error nothing is imported (all or nothing).
import type { Customer, Material, MaterialType, MaterialUnit } from './types';

export const IMPORT_COLUMNS = [
  'tipo',
  'codigo',
  'nombre',
  'categoria',
  'unidad',
  'ruc',
  'ancho_cm',
  'largo_cm',
  'calibre',
  'material',
  'peso_unitario_g',
  'exclusivo',
] as const;
type Column = (typeof IMPORT_COLUMNS)[number];

/** How each column appears in the error table. */
const FIELD_LABEL: Record<Column, string> = {
  tipo: 'tipo',
  codigo: 'código',
  nombre: 'nombre',
  categoria: 'categoría',
  unidad: 'unidad',
  ruc: 'ruc',
  ancho_cm: 'ancho_cm',
  largo_cm: 'largo_cm',
  calibre: 'calibre',
  material: 'material',
  peso_unitario_g: 'peso_unitario_g',
  exclusivo: 'exclusivo',
};

/** Template with one instruction line per column (lines starting with # are ignored). */
export const IMPORT_TEMPLATE =
  [
    '# Plantilla de carga inicial de SeguCost. Guarde el archivo como CSV UTF-8 separado por comas.',
    '# tipo: cliente, insumo o producto (obligatorio).',
    '# codigo: obligatorio en insumo y producto; no puede repetirse.',
    '# nombre: obligatorio.',
    '# categoria: solo insumos: resina, pigmento, tinta, aditivo o reciclado.',
    '# unidad: solo insumos: kg, lb o litro.',
    '# ruc: solo clientes: 13 dígitos.',
    '# ancho_cm, largo_cm, calibre: solo productos, números mayores que cero (use punto o coma decimal).',
    '# material: solo productos, por ejemplo PEBD o PEBD/PEAD.',
    '# peso_unitario_g: solo productos: peso calibrado de una funda en gramos (pese 100 y divida para 100).',
    '# exclusivo: solo productos: si (medida exclusiva del cliente) o no (estándar).',
    IMPORT_COLUMNS.join(','),
    'cliente,,Cliente Ejemplo S.A.,,,0990000099001,,,,,,',
    'insumo,ADT-02,Aditivo deslizante,aditivo,kg,,,,,,,',
    'producto,FN-3040,Funda natural 30x40,,,,30,40,1.5,PEBD,6.5,no',
  ].join('\n') + '\n';

export interface ImportError {
  row: number;
  type: string;
  field: string;
  problem: string;
  value: string;
}

export interface ImportedProduct {
  code: string;
  name: string;
  widthCm: number;
  lengthCm: number;
  gauge: number;
  material: string;
  weightG: number;
  exclusive: boolean;
}

export interface CatalogImport {
  customers: Omit<Customer, 'id'>[];
  materials: Omit<Material, 'id'>[];
  products: ImportedProduct[];
  errors: ImportError[];
  /** Data rows in the file (without header and instruction lines). */
  totalRows: number;
}

/** Parses simple CSV (comma separated, optional double quotes). Keeps the physical line number. */
export function parseCsvLines(text: string): { line: number; cells: string[] }[] {
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((raw, i) => ({ raw, line: i + 1 }))
    .filter(({ raw }) => raw.trim() !== '' && !raw.trim().startsWith('#'))
    .map(({ raw, line }) => {
      const cells: string[] = [];
      let cur = '';
      let quoted = false;
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (quoted) {
          if (ch === '"' && raw[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') quoted = false;
          else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') {
          cells.push(cur.trim());
          cur = '';
        } else cur += ch;
      }
      cells.push(cur.trim());
      return { line, cells };
    });
}

const CATEGORIES: Record<string, MaterialType> = { resina: 'resin', pigmento: 'pigment', tinta: 'ink', aditivo: 'additive', reciclado: 'recycled' };
const UNITS: Record<string, MaterialUnit> = { kg: 'kg', lb: 'lb', litro: 'l', l: 'l' };
const TYPE_LABEL: Record<string, string> = { cliente: 'Cliente', insumo: 'Insumo', producto: 'Producto' };

const num = (v: string) => (v === '' ? NaN : Number(v.replace(',', '.')));
const lower = (v: string) => v.trim().toLowerCase();

export interface ExistingCatalog {
  customers: Pick<Customer, 'name' | 'ruc'>[];
  materials: Pick<Material, 'code' | 'active'>[];
  products: { code: string }[];
}

/**
 * Validates the whole file (RF-50): required fields, types, allowed values and duplicates against the
 * catalog and inside the file. Every problem is listed with its line, type, field, reason and value.
 */
export function validateImport(text: string, catalog: ExistingCatalog): CatalogImport {
  const result: CatalogImport = { customers: [], materials: [], products: [], errors: [], totalRows: 0 };
  const [header, ...rows] = parseCsvLines(text);
  const columns = header?.cells.map(lower) ?? [];
  const missing = IMPORT_COLUMNS.filter((c) => !columns.includes(c));
  if (!header || missing.length) {
    result.errors.push({
      row: header?.line ?? 1,
      type: '—',
      field: missing[0] ?? 'tipo',
      problem: 'El encabezado no corresponde a la plantilla. Descargue la plantilla y copie sus datos en ella.',
      value: header?.cells.slice(0, 3).join(',') || '—',
    });
    return result;
  }
  result.totalRows = rows.length;
  const seen = new Set<string>();

  for (const { line, cells } of rows) {
    const get = (c: Column) => cells[columns.indexOf(c)]?.trim() ?? '';
    const kind = lower(get('tipo'));
    const type = TYPE_LABEL[kind] ?? '—';
    const errorsBefore = result.errors.length;
    const err = (field: Column, problem: string, value = get(field)) => result.errors.push({ row: line, type, field: FIELD_LABEL[field], problem, value: value || '—' });
    const required = (fields: Column[]) => fields.forEach((f) => !get(f) && err(f, 'Campo obligatorio vacío.'));
    const positive = (fields: Column[]) =>
      fields.forEach((f) => get(f) && !(num(get(f)) > 0) && err(f, 'Debe ser un número mayor que cero.'));
    const unique = (key: string, field: Column, existsInCatalog: boolean, what: string) => {
      if (existsInCatalog) err(field, `Ya existe ${what} con este ${FIELD_LABEL[field]}.`);
      else if (seen.has(key)) err(field, `El ${FIELD_LABEL[field]} se repite en el archivo.`);
      seen.add(key);
    };

    switch (kind) {
      case 'cliente': {
        required(['nombre', 'ruc']);
        const ruc = get('ruc');
        if (ruc && !/^\d{13}$/.test(ruc)) err('ruc', 'El RUC debe tener 13 dígitos.');
        else if (ruc) unique(`c:${ruc}`, 'ruc', catalog.customers.some((c) => c.ruc === ruc), 'un cliente');
        if (result.errors.length === errorsBefore) result.customers.push({ name: get('nombre'), ruc });
        break;
      }
      case 'insumo': {
        required(['codigo', 'nombre', 'categoria', 'unidad']);
        const category = CATEGORIES[lower(get('categoria'))];
        const unit = UNITS[lower(get('unidad'))];
        if (get('categoria') && !category) err('categoria', 'Use resina, pigmento, tinta, aditivo o reciclado.');
        if (get('unidad') && !unit) err('unidad', 'Use kg, lb o litro.');
        const code = get('codigo').toUpperCase();
        // RF-06: a code may not repeat an active material.
        if (code) unique(`m:${code}`, 'codigo', catalog.materials.some((m) => m.active && m.code.toUpperCase() === code), 'un insumo activo');
        if (result.errors.length === errorsBefore) result.materials.push({ code, name: get('nombre'), type: category!, unit: unit!, active: true });
        break;
      }
      case 'producto': {
        required(['codigo', 'nombre', 'ancho_cm', 'largo_cm', 'calibre', 'material', 'peso_unitario_g']);
        positive(['ancho_cm', 'largo_cm', 'calibre', 'peso_unitario_g']);
        const exclusive = lower(get('exclusivo'));
        if (exclusive && !['si', 'sí', 'no'].includes(exclusive)) err('exclusivo', 'Use si o no.');
        const code = get('codigo').toUpperCase();
        if (code) unique(`p:${code}`, 'codigo', catalog.products.some((p) => p.code.toUpperCase() === code), 'un producto');
        if (result.errors.length === errorsBefore) {
          result.products.push({
            code,
            name: get('nombre'),
            widthCm: num(get('ancho_cm')),
            lengthCm: num(get('largo_cm')),
            gauge: num(get('calibre')),
            material: get('material').toUpperCase(),
            weightG: num(get('peso_unitario_g')),
            exclusive: exclusive === 'si' || exclusive === 'sí',
          });
        }
        break;
      }
      default:
        err('tipo', 'Use cliente, insumo o producto.');
    }
  }
  return result;
}

/** Rows that would be imported once the file has no errors. */
export const validRows = (r: CatalogImport) => r.customers.length + r.materials.length + r.products.length;

// ---- demo files for the prototype (W-20) ----

const CLIENT_NAMES = [
  'Comercializadora Andina Demo', 'Distribuidora del Puerto', 'Mercado Central Ficticio', 'Panificadora La Muestra', 'Florícola Valle Demo',
  'Agroexportadora Prueba', 'Supermercado El Ejemplo', 'Hielo Polar Demo', 'Farmacias Modelo', 'Restaurante Ficticio',
  'Bananera Costa Demo', 'Ferretería Muestra', 'Cacao Fino Ejemplo', 'Camaronera Demo', 'Librería Prueba',
  'Minimarket Ficticio', 'Textiles Demo', 'Avícola Muestra', 'Lácteos del Ejemplo', 'Panadería Demo',
  'Frutas Tropicales Prueba', 'Distribuidora Litoral Demo', 'Plásticos Reventa Ficticia', 'Comisariato Muestra', 'Hotel Ejemplo',
  'Pescadería Demo', 'Vivero Ficticio', 'Bazar Muestra', 'Tienda Escolar Demo', 'Importadora Prueba',
  'Catering Ejemplo', 'Carnicería Demo', 'Heladería Muestra',
];

function clientRows(from: number, count: number): string[] {
  return CLIENT_NAMES.slice(from, from + count).map(
    (name, i) => `cliente,,${name} S.A.,,,09900${String(from + i + 10).padStart(3, '0')}00001,,,,,,`,
  );
}

/**
 * The initial load of flow 1: 50 rows. Line 14 repeats PEAD and line 27 has no unit weight, so the
 * first upload is rejected entirely (capture W-20). The corrected file fixes both lines.
 */
function sampleRows(corrected: boolean): string[] {
  return [
    ...clientRows(0, 10), // lines 2-11
    'insumo,ADT-01,Aditivo antiestático,aditivo,kg,,,,,,,', // 12
    'insumo,ADT-02,Aditivo deslizante,aditivo,kg,,,,,,,', // 13
    corrected ? 'insumo,PEAD-R,Polietileno alta densidad recuperado,reciclado,kg,,,,,,,' : 'insumo,PEAD,Polietileno alta densidad,resina,kg,,,,,,,', // 14
    'insumo,PIG-B,Pigmento blanco,pigmento,kg,,,,,,,', // 15
    'insumo,PIG-V,Pigmento verde,pigmento,kg,,,,,,,', // 16
    ...clientRows(10, 10), // 17-26
    `producto,FN-3040,Funda natural 30x40,,,,30,40,1.5,PEBD,${corrected ? '6.5' : ''},no`, // 27
    'producto,FV-2025,Funda de vivero 20x25,,,,20,25,2.5,PEBD,7.2,no', // 28
    ...clientRows(20, 13), // 29-41
  ].concat(
    // 42-51: more customers to complete the 50 rows of the capture.
    Array.from({ length: 10 }, (_, i) => `cliente,,Cliente Regional ${String(i + 1).padStart(2, '0')} Demo S.A.,,,09901${String(i + 50).padStart(3, '0')}00001,,,,,,`),
  );
}

export const SAMPLE_FILE_WITH_ERRORS = [IMPORT_COLUMNS.join(','), ...sampleRows(false)].join('\n') + '\n';
export const SAMPLE_FILE_CORRECTED = [IMPORT_COLUMNS.join(','), ...sampleRows(true)].join('\n') + '\n';
