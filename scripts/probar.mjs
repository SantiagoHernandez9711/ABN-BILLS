// Prueba local SIN enviar nada: lee el calendario, arma el invoice y guarda el Excel y el Word en salida-prueba/
// Uso:  node scripts/probar.mjs <link-o-archivo.ics> [inicio-del-período AAAA-MM-DD] [número]
// Ej.:  node scripts/probar.mjs https://.../calendario.ics 2026-10-26 12
// Los datos del Word (ABN, banco...) se leen de variables de entorno, ver README-AUTOMATIZACION.md
import fs from 'node:fs';
import { config } from '../netlify/functions/lib/config.mjs';
import { parseIcs, fetchIcs } from '../netlify/functions/lib/ics.mjs';
import { periodFromStart, upcomingPeriod, todayLocal, linesFromEvents, composeDraft } from '../netlify/functions/lib/invoice.mjs';
import { buildExcel } from '../netlify/functions/lib/excel.mjs';
import { buildWord, missingProfileVars } from '../netlify/functions/lib/word.mjs';

const [src, start, num] = process.argv.slice(2);
if (!src) {
  console.log('Uso: node scripts/probar.mjs <link-o-archivo.ics> [AAAA-MM-DD] [número]');
  process.exit(1);
}

const text = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : await fetchIcs(src);
const period = start ? periodFromStart(start) : upcomingPeriod(todayLocal());
const lines = linesFromEvents(parseIcs(text, config.timezone), period);
const draft = composeDraft(period, Number(num) || 1, lines);

console.log(`Período ${period.start} → ${period.end} | aviso ${period.notifyDay} ${config.notifyHour}:00 | envío ${period.sendDay} ${config.sendHour}:00\n`);
console.table(lines.map((l) => ({ fecha: l.date, turno: l.building, horas: l.hours, tarifa: l.rate, feriado: l.holiday || '', total: l.total })));
console.log(`Total: ${draft.totalHours} h · $${draft.totalAmount.toFixed(2)}\n`);
console.log(`Asunto: ${draft.subject}\n\n${draft.body}\n`);
const missing = missingProfileVars();
if (missing.length) console.log(`⚠️  Faltan datos para el Word: ${missing.join(', ')}\n`);

fs.mkdirSync('salida-prueba', { recursive: true });
fs.writeFileSync(`salida-prueba/${draft.fileBase}.xlsx`, await buildExcel(draft));
fs.writeFileSync(`salida-prueba/${draft.fileBase}.docx`, await buildWord(draft));
console.log('Excel y Word guardados en salida-prueba/');
