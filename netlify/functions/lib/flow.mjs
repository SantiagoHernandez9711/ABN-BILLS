// Flujo: borrador → vista previa en Telegram → aprobar (programa envío) → envío del correo
import { getStore } from '@netlify/blobs';
import { config } from './config.mjs';
import { buildDraft, formatInvoiceNo, todayLocal } from './invoice.mjs';
import { buildExcel } from './excel.mjs';
import { buildWord, missingProfileVars } from './word.mjs';
import { missingGrandFinal } from './holidays.mjs';
import { sendInvoiceEmail, recipientsSummary } from './email.mjs';
import { tg, esc } from './telegram.mjs';
import { auDate, zonedParts } from './dates.mjs';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const store = () => getStore({ name: 'invoice-bot', consistency: 'strong' });
const chatId = () => process.env.TELEGRAM_CHAT_ID;

export async function getMeta() {
  const meta = (await store().get('meta', { type: 'json' })) || {};
  if (!meta.nextNumber) meta.nextNumber = Number(process.env.INVOICE_NEXT_NUMBER) || 1;
  return meta;
}
export const setMeta = (meta) => store().setJSON('meta', meta);
export const getRecord = (start) => store().get(`period/${start}`, { type: 'json' });
const setRecord = (start, rec) => store().setJSON(`period/${start}`, rec);

export async function buildAttachments(draft) {
  return [
    { filename: `${draft.fileBase}.xlsx`, content: buildExcel(draft), contentType: XLSX_MIME },
    { filename: `${draft.fileBase}.docx`, content: await buildWord(draft), contentType: DOCX_MIME },
  ];
}

// ¿Ya llegó la hora de envío del período? (domingo 21:00 Melbourne)
export function isDue(period, now = Date.now()) {
  const today = todayLocal();
  if (today !== period.sendDay) return today > period.sendDay;
  return zonedParts(now, config.timezone).h >= config.sendHour;
}

export function sendTimeText(period) {
  const [y, m, d] = period.sendDay.split('-').map(Number);
  const dow = DAYS_ES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow} ${auDate(period.sendDay).slice(0, 5)} a las ${config.sendHour}:00`;
}

const previewKeyboard = (period) => ({
  inline_keyboard: [
    [{ text: `✅ Aprobar (se envía ${sendTimeText(period)})`, callback_data: `approve:${period.start}` }],
    [{ text: '📤 Enviar ahora', callback_data: `now:${period.start}` }],
    [
      { text: '🔄 Regenerar', callback_data: `regen:${period.start}` },
      { text: '❌ Cancelar', callback_data: `cancel:${period.start}` },
    ],
  ],
});

// Genera (o regenera) el borrador de un período y manda la vista previa a Telegram
export async function createPreview(period, { reason = 'auto' } = {}) {
  const existing = await getRecord(period.start);
  if (existing?.status === 'sent' || existing?.status === 'sending') {
    await tg.send(chatId(), `ℹ️ El invoice ${esc(existing.draft.invoice)} (${esc(existing.draft.periodText)}) ya fue enviado.`);
    return existing;
  }
  if (existing?.messageId) {
    await tg.edit(chatId(), existing.messageId, '🔁 <i>Reemplazado por una vista previa nueva.</i>').catch(() => {});
  }

  const meta = await getMeta();
  const number = existing?.draft?.invoiceNumber ?? meta.nextNumber;
  const draft = await buildDraft(period, number, requireEnv('ICS_URL'));
  const attachments = await buildAttachments(draft);

  const msg = await tg.send(chatId(), previewText(draft, attachments, reason), { reply_markup: previewKeyboard(period) });
  for (const f of attachments) await tg.document(chatId(), f.filename, f.content);

  const rec = { status: 'pending', draft, messageId: msg.message_id, notifiedAt: new Date().toISOString() };
  await setRecord(period.start, rec);
  return rec;
}

// ✅ Aprobar: queda programado para la hora de envío (o se envía ya si la hora pasó)
export async function approve(start, messageId) {
  const rec = await getRecord(start);
  const problem = checkActionable(rec, messageId);
  if (problem) return problem;
  if (rec.status === 'approved') return 'Ya estaba aprobado.';
  if (isDue(rec.draft.period)) return sendNow(start, messageId);

  await setRecord(start, { ...rec, status: 'approved', approvedAt: new Date().toISOString() });
  await tg.edit(chatId(), rec.messageId,
    `✅ <b>${esc(rec.draft.invoice)} aprobado</b>\n${esc(rec.draft.periodText)} · ${money(rec.draft.totalAmount)}\n🕘 Se enviará el ${sendTimeText(rec.draft.period)} a:\n${esc(recipientsSummary())}`,
    { reply_markup: { inline_keyboard: [[
      { text: '📤 Enviar ahora', callback_data: `now:${start}` },
      { text: '↩️ Deshacer', callback_data: `undo:${start}` },
    ]] } });
  return `Programado: ${sendTimeText(rec.draft.period)}`;
}

export async function undo(start) {
  const rec = await getRecord(start);
  if (rec?.status !== 'approved') return 'No hay nada que deshacer.';
  await setRecord(start, { ...rec, status: 'pending' });
  await tg.edit(chatId(), rec.messageId,
    `↩️ <b>Aprobación deshecha</b> — ${esc(rec.draft.invoice)} (${esc(rec.draft.periodText)}) no se enviará hasta que lo apruebes.`,
    { reply_markup: previewKeyboard(rec.draft.period) });
  return 'Deshecho';
}

// 📤 Envía el correo ya mismo (desde pendiente o aprobado)
export async function sendNow(start, messageId) {
  const rec = await getRecord(start);
  const problem = checkActionable(rec, messageId);
  if (problem) return problem;

  await setRecord(start, { ...rec, status: 'sending' });
  try {
    const attachments = await buildAttachments(rec.draft);
    const id = await sendInvoiceEmail(rec.draft, attachments);
    await setRecord(start, { ...rec, status: 'sent', sentAt: new Date().toISOString(), emailId: id });
    const meta = await getMeta();
    meta.nextNumber = Math.max(meta.nextNumber, rec.draft.invoiceNumber + 1);
    await setMeta(meta);
    await tg.edit(chatId(), rec.messageId,
      `📨 <b>${esc(rec.draft.invoice)} enviado</b>\n${esc(rec.draft.periodText)} · ${money(rec.draft.totalAmount)}\nPara: ${esc(recipientsSummary())}\nPróximo número: ${formatInvoiceNo(meta.nextNumber)}`);
    return '✅ Enviado';
  } catch (err) {
    await setRecord(start, rec); // vuelve al estado anterior (pendiente o aprobado)
    await tg.send(chatId(), `❌ No se pudo enviar el correo:\n<code>${esc(err.message)}</code>\n${rec.status === 'approved' ? 'Sigue aprobado: se reintentará en la próxima hora.' : 'Puedes reintentar desde la vista previa.'}`);
    return '❌ Error al enviar';
  }
}

export async function cancel(start) {
  const rec = await getRecord(start);
  if (!rec || !['pending', 'approved'].includes(rec.status)) return 'Nada que cancelar.';
  await setRecord(start, { ...rec, status: 'cancelled' });
  await tg.edit(chatId(), rec.messageId, `❌ <s>${esc(rec.draft.invoice)} · ${esc(rec.draft.periodText)}</s>\nCancelado. Usa /preview para generarlo de nuevo.`);
  return 'Cancelado';
}

// Lo llama la función programada: envía los aprobados cuya hora ya llegó
export async function sendIfDue(period) {
  const rec = await getRecord(period.start);
  if (rec?.status === 'approved' && isDue(period)) await sendNow(period.start);
}

export async function remind(start) {
  const rec = await getRecord(start);
  if (!rec || rec.status !== 'pending' || rec.remindedAt) return;
  await tg.send(chatId(), `⏰ Recordatorio: el invoice <b>${esc(rec.draft.invoice)}</b> (${esc(rec.draft.periodText)}) está esperando tu aprobación. Si lo apruebas antes de las ${config.sendHour}:00 sale a esa hora.`, {
    reply_to_message_id: rec.messageId,
  });
  await setRecord(start, { ...rec, remindedAt: new Date().toISOString() });
}

function checkActionable(rec, messageId) {
  if (!rec) return '⚠️ No encontré ese borrador.';
  if (rec.status === 'sent') return `ℹ️ ${rec.draft.invoice} ya fue enviado.`;
  if (rec.status === 'sending') return '⏳ Ya se está enviando…';
  if (rec.status === 'cancelled') return 'Ese borrador fue cancelado. Usa /preview para generar otro.';
  if (messageId && rec.messageId !== messageId) return 'Esa vista previa es vieja; usa la más reciente.';
  return null;
}

function previewText(draft, attachments, reason) {
  const rows = draft.lines.map((l) => {
    const rate = l.holiday ? `$${l.baseRate}×${config.holidayMultiplier}` : `$${l.rate}`;
    return `${l.holiday ? '🎉 ' : ''}${auDate(l.date).slice(0, 5)}  ${esc(l.building)}  ${l.hours}h × ${rate} = ${money(l.total)}`;
  });
  const holidays = [...new Set(draft.lines.filter((l) => l.holiday).map((l) => `${auDate(l.date).slice(0, 5)} ${l.holiday}`))];

  const parts = [
    reason === 'auto' ? '🔔 <b>Invoice listo para revisar</b>' : '📝 <b>Vista previa del invoice</b>',
    '',
    `<b>Para:</b> ${esc(recipientsSummary())}`,
    `<b>Asunto:</b> ${esc(draft.subject)}`,
    `<b>Adjuntos:</b> ${attachments.map((a) => esc(a.filename)).join(', ')}`,
    `<b>Envío:</b> ${sendTimeText(draft.period)} (si lo apruebas)`,
    '',
    `<b>Turnos (${draft.lines.length}):</b>`,
    rows.length ? `<pre>${rows.join('\n')}</pre>` : '<i>No hay turnos en este período.</i>',
    `<b>Total:</b> ${draft.totalHours} h · <b>${money(draft.totalAmount)}</b>`,
  ];
  if (holidays.length) parts.push(`🎉 Feriados (tarifa ×${config.holidayMultiplier}): ${esc(holidays.join(', '))}`);
  const gf = missingGrandFinal(draft.period.start, draft.period.end);
  if (gf) parts.push(`⚠️ Falta la fecha del feriado de la Gran Final AFL ${gf} en la configuración.`);
  const missing = missingProfileVars();
  if (missing.length) parts.push(`⚠️ Faltan datos para el Word en Netlify: ${missing.join(', ')}`);
  parts.push('', '<b>Cuerpo del correo:</b>', `<blockquote>${esc(draft.body)}</blockquote>`);

  let text = parts.join('\n');
  if (text.length > 4000) text = text.slice(0, 3990) + '…';
  return text;
}

export function money(n) {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`Falta la variable de entorno ${name} en Netlify`);
  return process.env[name];
}
