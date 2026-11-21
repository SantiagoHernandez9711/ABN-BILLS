// Recibe los mensajes y botones del bot de Telegram
import { upcomingPeriod, periodFromStart, todayLocal, formatInvoiceNo } from './lib/invoice.mjs';
import { createPreview, approve, cancel, getMeta, setMeta, getRecord, money } from './lib/flow.mjs';
import { tg, esc } from './lib/telegram.mjs';
import { config as settings } from './lib/config.mjs';
import { diffDays } from './lib/dates.mjs';

const HELP = `<b>Comandos</b>
/preview – genera la vista previa del próximo invoice
/preview AAAA-MM-DD – vista previa del período que empieza ese día
/estado – próximo período y número de invoice
/numero 13 – cambia el próximo número de invoice
/ayuda – este mensaje`;

export default async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  if (req.headers.get('x-telegram-bot-api-secret-token') !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  const update = await req.json();
  const allowed = String(process.env.TELEGRAM_CHAT_ID || '');

  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      if (String(cq.message?.chat?.id) !== allowed) {
        await tg.answer(cq.id, 'No autorizado');
        return new Response('ok');
      }
      const [action, start] = cq.data.split(':');
      let reply = '';
      if (action === 'approve') {
        await tg.answer(cq.id, 'Enviando…');
        reply = await approve(start, cq.message.message_id);
        if (!reply.startsWith('✅') && !reply.startsWith('❌')) await tg.send(allowed, esc(reply));
        return new Response('ok');
      }
      if (action === 'regen') {
        await tg.answer(cq.id, 'Regenerando…');
        await createPreview(periodFromStart(start), { reason: 'manual' });
        return new Response('ok');
      }
      if (action === 'cancel') reply = await cancel(start);
      await tg.answer(cq.id, reply);
      return new Response('ok');
    }

    const msg = update.message;
    if (!msg?.text) return new Response('ok');
    const chat = String(msg.chat.id);
    const [cmd, arg] = msg.text.trim().split(/\s+/);

    // /start funciona para cualquiera: sirve para descubrir tu chat id durante la configuración
    if (cmd === '/start') {
      await tg.send(chat, chat === allowed
        ? `👋 Listo, este chat está conectado.\n\n${HELP}`
        : `Tu chat id es <code>${chat}</code>.\nPonlo en la variable TELEGRAM_CHAT_ID de Netlify y vuelve a escribir /start.`);
      return new Response('ok');
    }
    if (chat !== allowed) return new Response('ok');

    switch (cmd.split('@')[0]) {
      case '/preview': {
        let period;
        if (arg) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(arg)) { await tg.send(chat, 'Usa el formato /preview 2026-11-09'); break; }
          if (diffDays(arg, settings.periodAnchor) % settings.periodDays !== 0) {
            await tg.send(chat, `⚠️ ${arg} no es inicio de una quincena (empiezan cada ${settings.periodDays} días desde ${settings.periodAnchor}).`);
            break;
          }
          period = periodFromStart(arg);
        } else {
          period = upcomingPeriod(todayLocal());
        }
        await tg.send(chat, '⏳ Leyendo el calendario…');
        await createPreview(period, { reason: 'manual' });
        break;
      }
      case '/estado': {
        const p = upcomingPeriod(todayLocal());
        const meta = await getMeta();
        const rec = await getRecord(p.start);
        const status = { pending: 'esperando aprobación', sent: 'enviado', cancelled: 'cancelado', sending: 'enviando' }[rec?.status] || 'sin generar';
        await tg.send(chat, [
          `<b>Próximo período:</b> ${p.start} → ${p.end}`,
          `<b>Vista previa:</b> ${p.notifyDay} a las ${settings.notifyHour}:00`,
          `<b>Estado:</b> ${status}${rec?.draft ? ` (${esc(rec.draft.invoice)}, ${money(rec.draft.totalAmount)})` : ''}`,
          `<b>Próximo número:</b> ${formatInvoiceNo(meta.nextNumber)}`,
        ].join('\n'));
        break;
      }
      case '/numero': {
        const n = parseInt(arg, 10);
        if (!n || n < 1) { await tg.send(chat, 'Usa: /numero 13'); break; }
        const meta = await getMeta();
        meta.nextNumber = n;
        await setMeta(meta);
        await tg.send(chat, `✓ El próximo invoice será <b>${formatInvoiceNo(n)}</b>.\n(Si ya hay una vista previa pendiente, toca 🔄 Regenerar.)`);
        break;
      }
      default:
        await tg.send(chat, HELP);
    }
  } catch (err) {
    console.error(err);
    if (allowed) await tg.send(allowed, `❌ Error:\n<code>${esc(err.message)}</code>`).catch(() => {});
  }
  return new Response('ok');
};
