// Ecuadorian number and date formatting: '.' for thousands, ',' for decimals (RNF-03, RNF-20).
// Implemented by hand so web (browser Intl) and Android (Hermes) render exactly the same,
// and so 4-digit amounts are grouped too ("10.000", which es-EC Intl leaves as "10000").
import { round2, round4 } from '@/domain/rounding';

export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  return sign + grouped + (dec ? `,${dec}` : '');
}

/** Totals in USD with 2 decimals: "1.234,56 USD". */
export const formatMoney = (value: number) => `${formatNumber(round2(value), 2)} USD`;

/** Unit costs and prices with 4 decimals: "0,0200 USD". */
export const formatUnitCost = (value: number) => `${formatNumber(round4(value), 4)} USD`;

/** Fraction to percent: 0.035 -> "3,5 %". */
export const formatPercent = (fraction: number, decimals = 1) => `${formatNumber(fraction * 100, decimals)} %`;

export const formatKg = (value: number, decimals = 2) => `${formatNumber(value, decimals)} kg`;

export const formatLb = (value: number) => `${formatNumber(value, 2)} lb`;

/**
 * Parses user input in Ecuadorian format: "1.234,5", "10.000" (thousands) or "12,5".
 * A dot is read as decimal only when it cannot be a thousands separator ("12.5"). NaN if invalid.
 */
export function parseNumber(input: string): number {
  const s = input.trim().replace(/\s/g, '');
  if (!s) return NaN;
  const thousandsOnly = /^-?\d{1,3}(\.\d{3})+$/.test(s);
  const normalized = s.includes(',') || thousandsOnly ? s.replace(/\./g, '').replace(',', '.') : s;
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' or ISO timestamp -> "dd/mm/aaaa" (local time). */
export function formatDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(value);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "02/11/2026" -> "2026-11-02"; "" when the date is not valid. */
export function parseDateInput(input: string): string {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const [, d, mo, y] = m.map(Number);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return '';
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** Today (or today + days) as "dd/mm/aaaa" for date inputs. */
export function todayInput(days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatTime(value: string): string {
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const formatDateTime = (value: string) => `${formatDate(value)} ${formatTime(value)}`;

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'YYYY-MM' -> "nov 2026". */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Stopwatch: 5_430_000 ms -> "01:30:30". */
export function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Worked time: "45 min", "1 h 30 min", "27 h 15 min" (always in hours). */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Elapsed calendar time for "time in state": like formatDuration, but days from 24 h on ("23 d 5 h"). */
export function formatElapsed(ms: number): string {
  const h = Math.floor(Math.max(0, Math.round(ms / 60_000)) / 60);
  if (h < 24) return formatDuration(ms);
  return h % 24 === 0 ? `${h / 24} d` : `${Math.floor(h / 24)} d ${h % 24} h`;
}
