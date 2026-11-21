// Arma el invoice: período, turnos, tarifas (con feriados), totales y textos del correo
import { config, fill } from './config.mjs';
import { addDays, diffDays, shortDate, dayOf } from './dates.mjs';
import { fetchIcs, parseIcs } from './ics.mjs';
import { holidayName } from './holidays.mjs';

export function periodFromStart(start) {
  const end = addDays(start, config.periodDays - 1);
  const sendDay = addDays(end, config.sendOffsetDays);
  return { start, end, sendDay, notifyDay: addDays(sendDay, -config.notifyDaysBefore) };
}

const isPeriodStart = (day) => ((diffDays(day, config.periodAnchor) % config.periodDays) + config.periodDays) % config.periodDays === 0;

// Período cuya notificación toca HOY (o null)
export function periodToNotifyOn(today) {
  const start = addDays(today, -(config.periodDays - 1 + config.sendOffsetDays - config.notifyDaysBefore));
  return isPeriodStart(start) ? periodFromStart(start) : null;
}

// Período cuyo día de envío es hoy o el más próximo en el futuro
export function upcomingPeriod(today) {
  const k = Math.floor(diffDays(today, config.periodAnchor) / config.periodDays);
  let p = periodFromStart(addDays(config.periodAnchor, (k - 1) * config.periodDays));
  while (p.sendDay < today) p = periodFromStart(addDays(p.start, config.periodDays));
  return p;
}

export { isPeriodStart };

export function todayLocal() {
  return dayOf(Date.now(), config.timezone);
}

export function rateFor(summary, day) {
  const s = summary.toLowerCase();
  const rule = config.rates.find((r) => r.all.every((w) => s.includes(w.toLowerCase())));
  const baseRate = rule ? rule.rate : config.defaultRate;
  const holiday = day ? holidayName(day) : null;
  return { baseRate, rate: holiday ? baseRate * config.holidayMultiplier : baseRate, holiday };
}

export function formatInvoiceNo(n) {
  return config.invoicePrefix + String(n).padStart(config.invoicePad, '0');
}

export function linesFromEvents(events, period) {
  const include = config.includeOnly.map((x) => x.toLowerCase());
  return events
    .filter((e) => e.day >= period.start && e.day <= period.end)
    .filter((e) => include.length === 0 || include.some((x) => e.summary.toLowerCase().includes(x)))
    .map((e) => {
      const { rate, baseRate, holiday } = rateFor(e.summary, e.day);
      return { date: e.day, building: e.summary, rate, baseRate, holiday, hours: e.hours, total: round2(rate * e.hours) };
    });
}

export async function buildDraft(period, invoiceNumber, icsUrl) {
  const events = parseIcs(await fetchIcs(icsUrl), config.timezone);
  return composeDraft(period, invoiceNumber, linesFromEvents(events, period));
}

export function composeDraft(period, invoiceNumber, lines) {
  const invoice = formatInvoiceNo(invoiceNumber);
  const periodText = `${shortDate(period.start)} to ${shortDate(period.end)}`;
  const sy = period.start.slice(0, 4), ey = period.end.slice(0, 4);
  const periodYearText = sy === ey
    ? `${periodText} ${ey}`
    : `${shortDate(period.start)} ${sy} to ${shortDate(period.end)} ${ey}`;
  const vars = { invoice, name: config.name, period: periodText, period_year: periodYearText };
  return {
    period,
    invoiceNumber,
    invoice,
    name: config.name,
    periodText,
    periodYearText,
    invoiceDate: period.sendDay,
    lines,
    totalHours: round2(lines.reduce((s, l) => s + l.hours, 0)),
    totalAmount: round2(lines.reduce((s, l) => s + l.total, 0)),
    subject: fill(config.email.subject, vars),
    body: fill(config.email.body, vars),
    description: fill(config.wordDescription, vars),
    fileBase: fill(config.fileName, vars),
    createdAt: new Date().toISOString(),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
