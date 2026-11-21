// Función programada: corre cada hora y decide si toca mandar la vista previa
// (1 día antes del envío, a la hora configurada en settings.notifyHour, hora de Melbourne)
import { config as settings } from './lib/config.mjs';
import { periodToNotifyOn, upcomingPeriod, todayLocal } from './lib/invoice.mjs';
import { createPreview, getRecord, remind } from './lib/flow.mjs';
import { zonedParts } from './lib/dates.mjs';
import { tg, esc } from './lib/telegram.mjs';

export default async () => {
  const today = todayLocal();
  const hour = zonedParts(Date.now(), settings.timezone).h;

  try {
    // 1) Vista previa el día de notificación
    const period = periodToNotifyOn(today);
    if (period && hour >= settings.notifyHour) {
      const rec = await getRecord(period.start);
      if (!rec) {
        await createPreview(period, { reason: 'auto' });
        console.log('Vista previa enviada para', period.start);
      }
    }

    // 2) Recordatorio el día de envío (9am) si todavía no se aprobó
    if (hour >= 9) {
      const p = upcomingPeriod(today);
      if (p.sendDay === today) await remind(p.start);
    }
  } catch (err) {
    console.error(err);
    if (process.env.TELEGRAM_CHAT_ID) {
      await tg.send(process.env.TELEGRAM_CHAT_ID, `❌ Error generando el invoice automático:\n<code>${esc(err.message)}</code>\nPuedes intentar con /preview`).catch(() => {});
    }
  }
  return new Response('ok');
};

export const config = { schedule: '@hourly' };
