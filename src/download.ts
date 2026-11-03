// File downloads (CSV, Excel, PDF). On the web the browser saves the file; on Android the prototype
// only confirms, since files are taken from the office computer.
import { Platform } from 'react-native';

import { showToast } from '@/components/Toast';

export function downloadFile(fileName: string, content: BlobPart, mime: string) {
  if (Platform.OS !== 'web') {
    showToast('info', `Archivo ${fileName} generado. La descarga está disponible en la versión web.`);
    return;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('success', `Archivo descargado: ${fileName}`);
}

/** CSV with BOM so Excel opens accents correctly. */
export const downloadCsv = (fileName: string, csv: string) => downloadFile(fileName, `﻿${csv}`, 'text/csv;charset=utf-8');

/** Opens a printable HTML report; the browser's "Guardar como PDF" produces the PDF (RF-41). */
export function printHtml(title: string, bodyHtml: string) {
  if (Platform.OS !== 'web') {
    showToast('info', 'El PDF está disponible en la versión web.');
    return;
  }
  const w = window.open('', '_blank');
  if (!w) {
    showToast('error', 'El navegador bloqueó la ventana del reporte. Permita ventanas emergentes.');
    return;
  }
  w.document.title = title;
  const style = w.document.createElement('style');
  style.textContent =
    'body{font-family:Segoe UI,Arial,sans-serif;color:#1A1F29;margin:32px}h1{color:#002855;font-size:20px}' +
    'p{color:#4A5568}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #C9D1DE;padding:6px 8px;text-align:left}' +
    'th{background:#EEF1F6}td.n{text-align:right}';
  w.document.head.appendChild(style);
  w.document.body.innerHTML = bodyHtml;
  setTimeout(() => w.print(), 300);
}

/** Escapes text for the printable report. */
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
