// Función programada: corre cada hora (hora de Melbourne) y:
//  1) el sábado a las 20:00 manda la vista previa a Telegram
//  2) el domingo a las 12:00 recuerda si no has aprobado
//  3) el domingo a las 21:00 envía el correo si lo aprobaste
import { config as settings } from './lib/config.mjs';
import { periodToNotifyOn, upcomingPeriod, periodFromStart, todayLocal } from './lib/invoice.mjs';
import { createPreview, getRecord, remind, sendIfDue } from './lib/flow.mjs';
import { zonedParts, addDays } from './lib/dates.mjs';
import { tg, esc } from './lib/telegram.mjs';

export default async () => {
  const today = todayLocal();
  const hour = zonedParts(Date.now(), settings.timezone).h;

  try {
    const period = periodToNotifyOn(today);
    if (period && hour >= settings.notifyHour && !(await getRecord(period.start))) {
      await createPreview(period, { reason: 'auto' });
      console.log('Vista previa enviada para', period.start);
    }

    const current = upcomingPeriod(today);
    const previous = periodFromStart(addDays(current.start, -settings.periodDays));
    if (current.sendDay === today && hour >= settings.reminderHour && hour < settings.sendHour) await remind(current.start);
    for (const p of [previous, current]) await sendIfDue(p);
  } catch (err) {
    console.error(err);
    if (process.env.TELEGRAM_CHAT_ID) {
      await tg.send(process.env.TELEGRAM_CHAT_ID, `❌ Error en el invoice automático:\n<code>${esc(err.message)}</code>\nPuedes intentar con /preview`).catch(() => {});
    }
  }
  return new Response('ok');
};

export const config = { schedule: '@hourly' };
