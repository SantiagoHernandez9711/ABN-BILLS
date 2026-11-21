// Genera el Excel con el formato del reporte de horas:
//   C2 "Invoice No"  | D2:G2 combinado y centrado → INV-013
//   C3 "Name"        | D3:G3 combinado y centrado → nombre completo
//   Fila 4 encabezados, luego un turno por fila y al final TOTAL
import ExcelJS from 'exceljs';
import { auDate } from './dates.mjs';

export async function buildExcel(draft) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Example', {
    // Al imprimir, todo el ancho cabe en una página
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [
    { width: 6 },  // A
    { width: 6 },  // B
    { width: 18 }, // C Date
    { width: 60 }, // D Building
    { width: 14 }, // E Rate
    { width: 14 }, // F Hours
    { width: 16 }, // G Total
  ];

  const fullName = (process.env.INVOICE_FULL_NAME || draft.name).trim().replace(/\.$/, '');

  ws.getCell('C2').value = 'Invoice No';
  ws.mergeCells('D2:G2');
  ws.getCell('D2').value = draft.invoice;
  ws.getCell('D2').alignment = { horizontal: 'center' };

  ws.getCell('C3').value = 'Name';
  ws.mergeCells('D3:G3');
  ws.getCell('D3').value = fullName;
  ws.getCell('D3').alignment = { horizontal: 'center' };

  ws.getRow(4).values = [null, null, 'Date', 'Building', 'Rate', 'Hours', 'Total'];

  let r = 5;
  for (const l of draft.lines) {
    const building = l.holiday ? `${l.building} (Public Holiday - ${l.holiday})` : l.building;
    ws.getRow(r).values = [null, null, auDate(l.date), building, l.rate, l.hours, l.total];
    r++;
  }
  ws.getCell(`E${r}`).value = 'TOTAL';
  ws.getCell(`F${r}`).value = draft.totalHours;
  ws.getCell(`G${r}`).value = draft.totalAmount;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
