// Feriados públicos de Victoria (aplican en Melbourne), según el Public Holidays Act 1993 (Vic).
// Todo se calcula con reglas fijas, excepto el viernes antes de la Gran Final de la AFL,
// que el gobierno anuncia cada año → se agrega en config.grandFinalFridays.
import { config } from './config.mjs';
import { addDays } from './dates.mjs';

const cache = new Map();

// Devuelve un Map 'YYYY-MM-DD' → nombre del feriado
export function victorianHolidays(year) {
  if (cache.has(year)) return cache.get(year);
  const h = new Map();
  const add = (day, name) => { if (!h.has(day)) h.set(day, name); };
  const d = (m, day) => `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Año Nuevo: 1 ene; si cae sábado o domingo, el lunes siguiente también es feriado
  add(d(1, 1), "New Year's Day");
  const ny = weekday(d(1, 1));
  if (ny === 6) add(d(1, 3), "New Year's Day (additional)");
  if (ny === 0) add(d(1, 2), "New Year's Day (additional)");

  // Australia Day: 26 ene; si cae fin de semana, el feriado pasa al lunes siguiente
  const ad = weekday(d(1, 26));
  add(ad === 6 ? d(1, 28) : ad === 0 ? d(1, 27) : d(1, 26), 'Australia Day');

  add(nthWeekday(year, 3, 1, 2), 'Labour Day'); // 2º lunes de marzo

  const easter = easterSunday(year);
  add(addDays(easter, -2), 'Good Friday');
  add(addDays(easter, -1), 'Easter Saturday');
  add(easter, 'Easter Sunday');
  add(addDays(easter, 1), 'Easter Monday');

  add(d(4, 25), 'ANZAC Day'); // en Victoria no se traslada

  add(nthWeekday(year, 6, 1, 2), "King's Birthday"); // 2º lunes de junio

  const gf = config.grandFinalFridays[year];
  if (gf) add(gf, 'Friday before AFL Grand Final');

  add(nthWeekday(year, 11, 2, 1), 'Melbourne Cup Day'); // 1er martes de noviembre

  // Navidad y Boxing Day, con días adicionales cuando caen en fin de semana
  add(d(12, 25), 'Christmas Day');
  add(d(12, 26), 'Boxing Day');
  const xmas = weekday(d(12, 25));
  if (xmas === 6) { add(d(12, 27), 'Christmas Day (additional)'); add(d(12, 28), 'Boxing Day (additional)'); }
  if (xmas === 0) add(d(12, 27), 'Christmas Day (additional)');
  if (xmas === 5) add(d(12, 28), 'Boxing Day (additional)');

  for (const [day, name] of Object.entries(config.extraHolidays || {})) {
    if (day.startsWith(String(year))) add(day, name);
  }
  cache.set(year, h);
  return h;
}

export function holidayName(day) {
  return victorianHolidays(+day.slice(0, 4)).get(day) || null;
}

// true si el período toca septiembre de un año sin fecha de Gran Final configurada
export function missingGrandFinal(start, end) {
  for (const y of new Set([+start.slice(0, 4), +end.slice(0, 4)])) {
    if (!config.grandFinalFridays[y] && start <= `${y}-10-15` && end >= `${y}-09-01`) return y;
  }
  return null;
}

function weekday(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
}

// n-ésimo día de la semana (0=dom … 6=sáb) de un mes
function nthWeekday(year, month, dow, n) {
  const first = weekday(`${year}-${String(month).padStart(2, '0')}-01`);
  const day = 1 + ((dow - first + 7) % 7) + (n - 1) * 7;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Algoritmo gregoriano anónimo (Meeus/Jones/Butcher)
function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
