// Flujo completo: crear borrador → vista previa en Telegram → aprobar → enviar correo
import { getStore } from '@netlify/blobs';
import { config } from './config.mjs';
import { buildDraft, formatInvoiceNo } from './invoice.mjs';
import { buildExcel } from './excel.mjs';
import { buildWord } from './word.mjs';
import { sendInvoiceEmail, recipientsSummary } from './email.mjs';
import { tg, esc } from './telegram.mjs';
import { auDate } from './dates.mjs';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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

export function buildAttachments(draft) {
  const files = [{ filename: `${draft.fileBase}.xlsx`, content: buildExcel(draft), contentType: XLSX_MIME }];
  const word = buildWord(draft);
  if (word) files.push({ filename: `${draft.fileBase}.docx`, content: word, contentType: DOCX_MIME });
  return files;
}

// Genera (o regenera) el borrador de un período y manda la vista previa a Telegram
export async function createPreview(period, { reason = 'auto' } = {}) {
  const existing = await getRecord(period.start);
  if (existing?.status === 'sent') {
    await tg.send(chatId(), `ℹ️ El invoice ${esc(existing.draft.invoice)} (${esc(existing.draft.periodText)}) ya fue enviado.`);
    return existing;
  }
  // Quitar los botones de la vista previa anterior, si había
  if (existing?.messageId) {
    await tg.edit(chatId(), existing.messageId, '🔁 <i>Reemplazado por una vista previa nueva.</i>').catch(() => {});
  }

  const meta = await getMeta();
  const number = existing?.draft?.invoiceNumber ?? meta.nextNumber;
  const draft = await buildDraft(period, number, requireEnv('ICS_URL'));
  const attachments = buildAttachments(draft);

  const msg = await tg.send(chatId(), previewText(draft, attachments, reason), {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Aprobar y enviar', callback_data: `approve:${period.start}` }],
        [
          { text: '🔄 Regenerar', callback_data: `regen:${period.start}` },
          { text: '❌ Cancelar', callback_data: `cancel:${period.start}` },
        ],
      ],
    },
  });
  for (const f of attachments) await tg.document(chatId(), f.filename, f.content);

  const rec = { status: 'pending', draft, messageId: msg.message_id, notifiedAt: new Date().toISOString() };
  await setRecord(period.start, rec);
  return rec;
}

export async function approve(start, messageId) {
  const rec = await getRecord(start);
  if (!rec) return '⚠️ No encontré ese borrador.';
  if (rec.status === 'sent') return `ℹ️ ${rec.draft.invoice} ya fue enviado.`;
  if (rec.status === 'sending') return '⏳ Ya se está enviando…';
  if (rec.status === 'cancelled') return 'Ese borrador fue cancelado. Usa /preview para generar otro.';
  if (messageId && rec.messageId !== messageId) return 'Esa vista previa es vieja; usa la más reciente.';

  await setRecord(start, { ...rec, status: 'sending' });
  try {
    const attachments = buildAttachments(rec.draft);
    const id = await sendInvoiceEmail(rec.draft, attachments);
    await setRecord(start, { ...rec, status: 'sent', sentAt: new Date().toISOString(), emailId: id });
    const meta = await getMeta();
    meta.nextNumber = Math.max(meta.nextNumber, rec.draft.invoiceNumber + 1);
    await setMeta(meta);
    await tg.edit(chatId(), rec.messageId, `✅ <b>${esc(rec.draft.invoice)} enviado</b>\n${esc(rec.draft.periodText)} · ${money(rec.draft.totalAmount)}\nPara: ${esc(recipientsSummary())}\nPróximo número: ${formatInvoiceNo(meta.nextNumber)}`);
    return '✅ Enviado';
  } catch (err) {
    await setRecord(start, { ...rec, status: 'pending' });
    await tg.send(chatId(), `❌ No se pudo enviar el correo:\n<code>${esc(err.message)}</code>\nLa vista previa sigue activa, puedes reintentar.`);
    return '❌ Error al enviar';
  }
}

export async function cancel(start) {
  const rec = await getRecord(start);
  if (!rec || rec.status !== 'pending') return 'Nada que cancelar.';
  await setRecord(start, { ...rec, status: 'cancelled' });
  await tg.edit(chatId(), rec.messageId, `❌ <s>${esc(rec.draft.invoice)} · ${esc(rec.draft.periodText)}</s>\nCancelado. Usa /preview para generarlo de nuevo.`);
  return 'Cancelado';
}

export async function remind(start) {
  const rec = await getRecord(start);
  if (!rec || rec.status !== 'pending' || rec.remindedAt) return;
  await tg.send(chatId(), `⏰ Recordatorio: el invoice <b>${esc(rec.draft.invoice)}</b> (${esc(rec.draft.periodText)}) está esperando tu aprobación.`, {
    reply_to_message_id: rec.messageId,
  });
  await setRecord(start, { ...rec, remindedAt: new Date().toISOString() });
}

function previewText(draft, attachments, reason) {
  const unmatched = draft.lines.filter((l) => !l.matched).length;
  const rows = draft.lines.map((l) =>
    `${l.matched ? '' : '⚠️ '}${auDate(l.date).slice(0, 5)}  ${esc(l.building)}  ${l.hours}h × $${l.rate} = ${money(l.total)}`);

  const parts = [
    reason === 'auto' ? '🔔 <b>Invoice listo para revisar</b>' : '📝 <b>Vista previa del invoice</b>',
    '',
    `<b>Para:</b> ${esc(recipientsSummary())}`,
    `<b>Asunto:</b> ${esc(draft.subject)}`,
    `<b>Adjuntos:</b> ${attachments.map((a) => esc(a.filename)).join(', ')}`,
    '',
    `<b>Turnos (${draft.lines.length}):</b>`,
    rows.length ? `<pre>${rows.join('\n')}</pre>` : '<i>No hay turnos en este período.</i>',
    `<b>Total:</b> ${draft.totalHours} h · <b>${money(draft.totalAmount)}</b>`,
  ];
  if (unmatched) parts.push(`⚠️ ${unmatched} turno(s) sin tarifa definida → se usó $${config.defaultRate}/h`);
  if (attachments.length < 2) parts.push('⚠️ Falta la plantilla Word: solo se adjunta el Excel.');
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

