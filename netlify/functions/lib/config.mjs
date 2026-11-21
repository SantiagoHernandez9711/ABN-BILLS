// ============================================================
//  CONFIGURACIÓN DEL INVOICE AUTOMÁTICO
//  ⚠️ Este repositorio es PÚBLICO: los datos personales (ABN, teléfono, dirección,
//  cuenta bancaria), correos y claves van en variables de entorno de Netlify.
//  Ver README-AUTOMATIZACION.md
// ============================================================

export const config = {
  // Nombre en el asunto del correo, nombre de archivos y firma
  name: 'Santiago Hernandez',

  // Zona horaria de los turnos (todas las fechas y horas se calculan aquí)
  timezone: 'Australia/Melbourne',

  // Quincenas: inicio de UN período conocido (YYYY-MM-DD). Oct 26 – Nov 8 2026,
  // luego Nov 9 – Nov 22, Nov 23 – Dec 6, ...
  periodAnchor: '2026-10-26',
  periodDays: 14,

  // Envío: el último día del período (domingo) a las 21:00.
  // Aviso por Telegram: el día anterior (sábado) a las 20:00.
  sendOffsetDays: 0, // días después del último día del período
  sendHour: 21,
  notifyDaysBefore: 1,
  notifyHour: 20,
  reminderHour: 12, // el día de envío, si no has aprobado, recordatorio a esta hora

  // Número de invoice: INV-013 en archivos/asunto, "13" en el Word
  invoicePrefix: 'INV-',
  invoicePad: 3,

  // Tarifas según el NOMBRE del turno (SUMMARY del calendario).
  // Coincide si el nombre contiene TODAS las palabras de `all` (sin importar mayúsculas).
  // Gana la primera regla que coincida.
  rates: [
    { all: ['tooronga', 'night shift'], rate: 40 },
  ],
  defaultRate: 30,

  // Turnos en feriado de Victoria (por la fecha en que EMPIEZA el turno) se multiplican por esto
  holidayMultiplier: 2,

  // Viernes antes de la Gran Final de la AFL (lo anuncia el gobierno de Victoria cada año).
  // Agrega el año nuevo apenas se publique en https://business.vic.gov.au (Victorian public holidays)
  grandFinalFridays: {
    2026: '2026-09-25',
  },
  // Feriados extra puntuales, p.ej. { '2027-01-01': 'Nombre' }
  extraHolidays: {},

  // Solo se incluyen turnos cuyo nombre contenga alguno de estos textos (vacío = todos)
  includeOnly: [],

  // Datos del cliente en el Word ("BILL TO") — son datos públicos de la empresa
  billTo: [
    'Aligned Property Services Pty',
    'G.03 762 Toorak Road, Glen Iris - 3146',
    'Phone: 03 9063 1179',
    'Email: info@alignedpropertyservices.com.au',
    'Website: www.alignedpropertyservices.com.au',
  ],
  // Texto de la línea del Word. {period_year} = "Oct 26 to Nov 8 2026"
  wordDescription: 'Cleaning services provided from {period_year}',

  email: {
    subject: '{invoice} {name}',
    body: `Dear Team,

I hope this message finds you well.
Please find attached the required documents corresponding to the invoice for the period of {period}. Kindly review them at your earliest convenience and do not hesitate to contact me should you require any additional information.

Thank you for your time and assistance.

Kind regards,
{name}`,
  },

  // Nombre de los adjuntos (sin extensión): "INV-013 Santiago Hernandez"
  fileName: '{invoice} {name}',
};

export function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
