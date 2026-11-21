// ============================================================
//  CONFIGURACIÓN DEL INVOICE AUTOMÁTICO
//  Lo que es privado (correos, claves, link del .ics) va en
//  variables de entorno de Netlify, NO aquí. Ver README-AUTOMATIZACION.md
// ============================================================

export const config = {
  // Nombre que aparece en el invoice, en el nombre de los archivos y en la firma
  name: 'Santiago Hernandez',

  // Zona horaria de los turnos (todas las fechas se calculan en esta zona)
  timezone: 'Australia/Melbourne',

  // Quincenas: fecha de inicio de UN período conocido (YYYY-MM-DD).
  // Oct 26 – Nov 8 2026 → los siguientes son Nov 9 – Nov 22, Nov 23 – Dec 6, ...
  periodAnchor: '2026-10-26',
  periodDays: 14,

  // El invoice se "envía" este número de días después del último día del período
  // (1 = el día siguiente al cierre). La notificación llega 1 día antes del envío.
  sendOffsetDays: 1,
  notifyDaysBefore: 1,
  notifyHour: 18, // hora local (Melbourne) a la que llega la vista previa a Telegram

  // Formato del número de invoice: INV-013
  invoicePrefix: 'INV-',
  invoicePad: 3,

  // Tarifas según el NOMBRE del turno (el SUMMARY del calendario).
  // Se busca el texto dentro del nombre, sin importar mayúsculas.
  // Gana la primera coincidencia de arriba hacia abajo.
  // TODO: reemplazar con la lista real de turnos/tarifas.
  rates: [
    // { match: 'Tooronga', rate: 30 },
  ],
  // Si un turno no coincide con ninguna regla se usa esta tarifa y se marca ⚠️ en Telegram
  defaultRate: 30,

  // Solo se incluyen turnos cuyo nombre contenga alguno de estos textos.
  // Vacío = se incluyen todos los eventos del calendario (menos los de "todo el día").
  includeOnly: [],

  email: {
    subject: '{invoice} {name}',
    body: `Dear Team,

I hope this message finds you well.
Please find attached the required documents corresponding to the invoice for the period of {period}. Kindly review them at your earliest convenience and do not hesitate to contact me should you require any additional information.

Thank you for your time and assistance.

Kind regards,
{name}`,
  },

  // Nombre de los archivos adjuntos (sin extensión): "INV-013 Santiago Hernandez"
  fileName: '{invoice} {name}',
};

export function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
