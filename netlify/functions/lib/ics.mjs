// Lector de calendarios .ics (versión servidor, con zonas horarias correctas)
import { zonedToUtc, dayOf } from './dates.mjs';

export async function fetchIcs(url) {
  // Algunos calendarios se comparten como webcal://
  const res = await fetch(url.replace(/^webcal:/i, 'https:'));
  if (!res.ok) throw new Error(`No se pudo descargar el calendario (HTTP ${res.status})`);
  const text = await res.text();
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('El link no devolvió un calendario .ics válido');
  return text;
}

// Devuelve [{ summary, day, startMs, endMs, hours }] ordenados por inicio
export function parseIcs(text, timeZone) {
  // Desdoblar líneas largas (RFC 5545: las continuaciones empiezan con espacio o tab)
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let cur = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
    } else if (line === 'END:VEVENT' && cur) {
      if (cur.start && cur.end && cur.summary && !cur.allDay && cur.status !== 'CANCELLED') {
        const hours = (cur.end - cur.start) / 3600000;
        events.push({
          summary: cur.summary,
          day: dayOf(cur.start, timeZone),
          startMs: cur.start,
          endMs: cur.end,
          hours: Math.round(hours * 4) / 4,
        });
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const head = line.slice(0, idx);
      const value = line.slice(idx + 1).trim();
      const [name, ...params] = head.split(';');
      if (name === 'DTSTART' || name === 'DTEND') {
        const d = parseIcsDate(value, params, timeZone);
        if (d.allDay) cur.allDay = true;
        cur[name === 'DTSTART' ? 'start' : 'end'] = d.ms;
      } else if (name === 'SUMMARY') {
        cur.summary = unescapeText(value);
      } else if (name === 'STATUS') {
        cur.status = value.toUpperCase();
      }
    }
  }

  events.sort((a, b) => a.startMs - b.startMs);
  return events;
}

function parseIcsDate(value, params, defaultTz) {
  const tzParam = params.find((p) => p.startsWith('TZID='));
  const isDateOnly = params.includes('VALUE=DATE') || /^\d{8}$/.test(value);
  const y = +value.slice(0, 4);
  const m = +value.slice(4, 6);
  const d = +value.slice(6, 8);
  if (isDateOnly) return { allDay: true, ms: zonedToUtc(y, m, d, 0, 0, 0, defaultTz) };

  const h = +value.slice(9, 11) || 0;
  const min = +value.slice(11, 13) || 0;
  const s = +value.slice(13, 15) || 0;

  if (value.endsWith('Z')) return { ms: Date.UTC(y, m - 1, d, h, min, s) };

  let tz = tzParam ? tzParam.slice(5).replace(/^"|"$/g, '') : defaultTz;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
  } catch {
    tz = defaultTz; // TZID desconocido (p.ej. nombres de Windows) → usar la zona configurada
  }
  return { ms: zonedToUtc(y, m, d, h, min, s, tz) };
}

function unescapeText(v) {
  return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}
