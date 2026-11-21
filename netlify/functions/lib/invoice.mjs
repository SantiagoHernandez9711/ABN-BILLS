// Arma el invoice: período, turnos, tarifas, totales y textos del correo
import { config, fill } from './config.mjs';
import { addDays, diffDays, shortDate, dayOf } from './dates.mjs';
import { fetchIcs, parseIcs } from './ics.mjs';

const OFFSET_TO_NOTIFY = () => config.periodDays - 1 + config.sendOffsetDays - config.notifyDaysBefore;

export function periodFromStart(start) {
  const end = addDays(start, config.periodDays - 1);
  const sendDay = addDays(end, config.sendOffsetDays);
  return { start, end, sendDay, notifyDay: addDays(sendDay, -config.notifyDaysBefore) };
}

// Período cuya notificación toca HOY (o null)
export function periodToNotifyOn(today) {
  const start = addDays(today, -OFFSET_TO_NOTIFY());
  const k = diffDays(start, config.periodAnchor);
  return k % config.periodDays === 0 ? periodFromStart(start) : null;
}

// Próximo período pendiente de enviar (para /preview)
export function upcomingPeriod(today) {
  const k = Math.ceil(diffDays(today, config.periodAnchor) / config.periodDays);
  let p = periodFromStart(addDays(config.periodAnchor, (k - 1) * config.periodDays));
  while (p.sendDay < today) p = periodFromStart(addDays(p.start, config.periodDays));
  return p;
}

export function previousPeriod(p) {
  return periodFromStart(addDays(p.start, -config.periodDays));
}

export function todayLocal() {
  return dayOf(Date.now(), config.timezone);
}

export function rateFor(summary) {
  const s = summary.toLowerCase();
  const rule = config.rates.find((r) => s.includes(r.match.toLowerCase()));
  return rule ? { rate: rule.rate, matched: true } : { rate: config.defaultRate, matched: false };
}

export function formatInvoiceNo(n) {
  return config.invoicePrefix + String(n).padStart(config.invoicePad, '0');
}

export async function buildDraft(period, invoiceNumber, icsUrl) {
  const all = parseIcs(await fetchIcs(icsUrl), config.timezone);
  const include = config.includeOnly.map((x) => x.toLowerCase());
  const lines = all
    .filter((e) => e.day >= period.start && e.day <= period.end)
    .filter((e) => include.length === 0 || include.some((x) => e.summary.toLowerCase().includes(x)))
    .map((e) => {
      const { rate, matched } = rateFor(e.summary);
      return { date: e.day, building: e.summary, rate, hours: e.hours, total: round2(rate * e.hours), matched };
    });

  return composeDraft(period, invoiceNumber, lines);
}

export function composeDraft(period, invoiceNumber, lines) {
  const invoice = formatInvoiceNo(invoiceNumber);
  const periodText = `${shortDate(period.start)} to ${shortDate(period.end)}`;
  const vars = { invoice, name: config.name, period: periodText };
  return {
    period,
    invoiceNumber,
    invoice,
    name: config.name,
    periodText,
    lines,
    totalHours: round2(lines.reduce((s, l) => s + l.hours, 0)),
    totalAmount: round2(lines.reduce((s, l) => s + l.total, 0)),
    subject: fill(config.email.subject, vars),
    body: fill(config.email.body, vars),
    fileBase: fill(config.fileName, vars),
    createdAt: new Date().toISOString(),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
