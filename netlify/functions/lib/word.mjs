// Genera el Word a partir de la plantilla netlify/functions/templates/invoice-template.docx
// La plantilla usa marcadores tipo {invoice}, {date}, {period}, {total_amount}...
// TODO: ajustar los marcadores cuando tengamos la plantilla real.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { auDate } from './dates.mjs';
import { config } from './config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [
  path.join(here, '..', 'templates', 'invoice-template.docx'),
  path.join(process.cwd(), 'netlify', 'functions', 'templates', 'invoice-template.docx'),
];

export function templatePath() {
  return CANDIDATES.find((p) => fs.existsSync(p)) || null;
}

// Devuelve un Buffer, o null si todavía no hay plantilla
export function buildWord(draft) {
  const file = templatePath();
  if (!file) return null;

  const doc = new Docxtemplater(new PizZip(fs.readFileSync(file)), {
    paragraphLoop: true,
    linebreaks: true,
  });
  const money = (n) => '$' + n.toFixed(2);
  doc.render({
    invoice: draft.invoice,
    invoice_number: draft.invoiceNumber,
    name: draft.name,
    date: auDate(new Date().toLocaleDateString('en-CA', { timeZone: config.timezone })),
    period: draft.periodText,
    period_start: auDate(draft.period.start),
    period_end: auDate(draft.period.end),
    total_hours: draft.totalHours.toFixed(2),
    total_amount: money(draft.totalAmount),
    lines: draft.lines.map((l) => ({
      date: auDate(l.date),
      building: l.building,
      rate: money(l.rate),
      hours: l.hours.toFixed(2),
      total: money(l.total),
    })),
  });
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
