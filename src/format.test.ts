import {
  formatDate,
  formatDuration,
  formatElapsed,
  formatMoney,
  formatNumber,
  formatPercent,
  formatTimer,
  formatUnitCost,
  parseDateInput,
  parseNumber,
} from './format';

describe('formatting es-EC', () => {
  it('groups thousands with dot and uses decimal comma', () => {
    expect(formatNumber(10_000)).toBe('10.000');
    expect(formatNumber(1_234_567.891, 2)).toBe('1.234.567,89');
    expect(formatNumber(275.58, 2)).toBe('275,58');
    expect(formatNumber(-0.001, 2)).toBe('0,00');
  });
  it('money totals with 2 decimals and unit costs with 4', () => {
    expect(formatMoney(200)).toBe('200,00 USD');
    expect(formatUnitCost(0.02)).toBe('0,0200 USD');
    expect(formatUnitCost(0.026666)).toBe('0,0267 USD');
  });
  it('percent from fraction', () => {
    expect(formatPercent(0.035)).toBe('3,5 %');
    expect(formatPercent(0.067, 1)).toBe('6,7 %');
  });
  it('dates and durations', () => {
    expect(formatDate('2026-11-02')).toBe('02/11/2026');
    expect(formatTimer(5_430_000)).toBe('01:30:30');
    expect(formatDuration(50 * 60_000)).toBe('50 min');
    expect(formatDuration(90 * 60_000)).toBe('1 h 30 min');
    expect(formatDuration(27.25 * 3_600_000)).toBe('27 h 15 min');
    expect(formatElapsed(557 * 3_600_000)).toBe('23 d 5 h');
    expect(formatElapsed(48 * 3_600_000)).toBe('2 d');
    expect(formatElapsed(90 * 60_000)).toBe('1 h 30 min');
  });
  it('parses dd/mm/aaaa dates and rejects impossible ones', () => {
    expect(parseDateInput('2/11/2026')).toBe('2026-11-02');
    expect(parseDateInput('31/02/2026')).toBe('');
    expect(parseDateInput('2026-11-02')).toBe('');
  });
  it('parses comma or dot decimals', () => {
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('12.5')).toBe(12.5);
    expect(parseNumber('10.000')).toBe(10_000);
    expect(parseNumber('1.234.567')).toBe(1_234_567);
    expect(parseNumber('0,0125')).toBe(0.0125);
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('')).toBeNaN();
  });
});
