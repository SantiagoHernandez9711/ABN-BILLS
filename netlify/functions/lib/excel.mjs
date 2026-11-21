// Genera el Excel con el mismo formato que la página web (js/data.js → generateExcel)
import * as XLSX from 'xlsx';
import { auDate } from './dates.mjs';

export function buildExcel(draft) {
  const ws = [
    [null, null, null, null, null, null, null],
    [null, null, 'Invoice No', draft.invoice, null, null, null],
    [null, null, 'Name', draft.name, null, null, null],
    [null, null, null, null, null, null, null],
    [null, null, 'Date', 'Building', 'Rate', 'Hours', 'Total'],
  ];
  for (const l of draft.lines) ws.push([null, null, auDate(l.date), l.building, l.rate, l.hours, l.total]);
  ws.push([null, null, null, null, 'TOTAL', draft.totalHours, draft.totalAmount]);

  const sheet = XLSX.utils.aoa_to_sheet(ws);
  sheet['!cols'] = [{ wch: 4 }, { wch: 4 }, { wch: 14 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Example');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
