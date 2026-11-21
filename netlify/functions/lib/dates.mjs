// Utilidades de fechas con zona horaria, sin librerías externas.
// Una "fecha" (day) es siempre un string 'YYYY-MM-DD' en la zona configurada.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Partes de fecha/hora de un instante (ms UTC) vistas en una zona horaria
export function zonedParts(ms, timeZone) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

// Convierte una hora "de pared" en una zona horaria a ms UTC
export function zonedToUtc(y, m, d, h, min, s, timeZone) {
  const guess = Date.UTC(y, m - 1, d, h, min, s);
  // Dos pasadas para cubrir cambios de horario de verano
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(ts, timeZone);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    ts = guess - (asUtc - ts);
  }
  return ts;
}

export function dayOf(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function diffDays(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pa[0], pa[1] - 1, pa[2]) - Date.UTC(pb[0], pb[1] - 1, pb[2])) / 86400000);
}

// 'YYYY-MM-DD' → 'Oct 26'
export function shortDate(day) {
  const [, m, d] = day.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY'
export function auDate(day) {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}
