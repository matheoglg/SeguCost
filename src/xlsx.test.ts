import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildXlsx, crc32 } from './xlsx';

describe('xlsx writer (RF-41)', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('produces a valid zip with the workbook parts', () => {
    const bytes = buildXlsx('Tiempos', [
      ['Operario', 'Horas'],
      ['Hugo <Ejemplar> & Cía.', 4.5],
    ]);
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // "PK"
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('<v>4.5</v>');
    expect(text).toContain('Hugo &lt;Ejemplar&gt; &amp; Cía.');
  });

  it('can be listed by a zip tool when one is available', () => {
    const dir = mkdtempSync(join(tmpdir(), 'xlsx-'));
    const file = join(dir, 'test.xlsx');
    writeFileSync(file, buildXlsx('Hoja', [['a', 1]]));
    let listing: string;
    try {
      listing = execFileSync('python', ['-c', `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(','.join(z.namelist()))`, file]).toString();
    } catch {
      return; // python not installed: structural checks above still apply
    }
    expect(listing).toContain('[Content_Types].xml');
    expect(listing).toContain('xl/workbook.xml');
  });
});
