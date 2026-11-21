// Prueba local SIN enviar nada: lee el calendario, arma el invoice y guarda el Excel/Word en salida-prueba/
// Uso:  node scripts/probar.mjs <link-o-archivo.ics> [inicio-del-período AAAA-MM-DD] [número]
// Ej.:  node scripts/probar.mjs https://.../calendario.ics 2026-10-26 12
import fs from 'node:fs';
import { config } from '../netlify/functions/lib/config.mjs';
import { parseIcs, fetchIcs } from '../netlify/functions/lib/ics.mjs';
import { periodFromStart, upcomingPeriod, todayLocal, rateFor, composeDraft } from '../netlify/functions/lib/invoice.mjs';
import { buildExcel } from '../netlify/functions/lib/excel.mjs';
import { buildWord } from '../netlify/functions/lib/word.mjs';

const [src, start, num] = process.argv.slice(2);
if (!src) {
  console.log('Uso: node scripts/probar.mjs <link-o-archivo.ics> [AAAA-MM-DD] [número]');
  process.exit(1);
}

const text = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : await fetchIcs(src);
const period = start ? periodFromStart(start) : upcomingPeriod(todayLocal());
const lines = parseIcs(text, config.timezone)
  .filter((e) => e.day >= period.start && e.day <= period.end)
  .map((e) => {
    const { rate, matched } = rateFor(e.summary);
    return { date: e.day, building: e.summary, rate, hours: e.hours, total: Math.round(rate * e.hours * 100) / 100, matched };
  });
const draft = composeDraft(period, Number(num) || 1, lines);

console.log(`Período ${period.start} → ${period.end} | aviso ${period.notifyDay} | envío ${period.sendDay}\n`);
console.table(lines.map((l) => ({ fecha: l.date, turno: l.building, horas: l.hours, tarifa: l.rate + (l.matched ? '' : ' ⚠️'), total: l.total })));
console.log(`Total: ${draft.totalHours} h · $${draft.totalAmount.toFixed(2)}\n`);
console.log(`Asunto: ${draft.subject}\n\n${draft.body}\n`);

fs.mkdirSync('salida-prueba', { recursive: true });
fs.writeFileSync(`salida-prueba/${draft.fileBase}.xlsx`, buildExcel(draft));
const word = buildWord(draft);
if (word) fs.writeFileSync(`salida-prueba/${draft.fileBase}.docx`, word);
console.log(`Archivos guardados en salida-prueba/ ${word ? '(Excel + Word)' : '(solo Excel: falta la plantilla Word)'}`);
