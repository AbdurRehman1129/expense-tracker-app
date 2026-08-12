import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

/** Escapes a value for safe inclusion in a CSV cell. */
function csvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  return lines.join('\n');
}

async function writeAndShare(filename: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(content);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Export Report' });
}

export async function exportCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): Promise<void> {
  const csv = rowsToCsv(headers, rows);
  await writeAndShare(filename, csv, 'text/csv');
}

export async function exportPdf(filename: string, title: string, subtitle: string, html: string): Promise<void> {
  const fullHtml = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, Arial, sans-serif; padding: 24px; color: #111; }
          h1 { font-size: 20px; margin-bottom: 2px; }
          .subtitle { font-size: 12px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th, td { text-align: left; padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #eee; }
          th { background: #f3f4f6; font-weight: 700; }
          .section-title { font-size: 15px; font-weight: 700; margin: 18px 0 8px; }
          .summary { display: flex; gap: 16px; margin-bottom: 20px; }
          .summary-box { border: 1px solid #eee; border-radius: 8px; padding: 10px 14px; }
          .summary-label { font-size: 11px; color: #666; }
          .summary-amount { font-size: 16px; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="subtitle">${subtitle}</div>
        ${html}
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html: fullHtml, base64: false });
  const target = new File(Paths.cache, filename);
  if (target.exists) target.delete();
  const generated = new File(uri);
  generated.copy(target);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', dialogTitle: 'Export Report', UTI: 'com.adobe.pdf' });
}