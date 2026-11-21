// Conecta el bot con la página (se usa una sola vez).
// Abre en el navegador: https://abn-bill.netlify.app/.netlify/functions/telegram-setup?key=TU_TELEGRAM_WEBHOOK_SECRET
export default async (req) => {
  const key = new URL(req.url).searchParams.get('key');
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || key !== secret) return new Response('Clave incorrecta', { status: 403 });

  const site = process.env.URL || new URL(req.url).origin;
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: `${site}/.netlify/functions/telegram-webhook`,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
    }),
  });
  const json = await res.json();
  return new Response(json.ok
    ? '✅ Bot conectado. Ahora escríbele /start en Telegram.'
    : `❌ Telegram respondió: ${json.description}`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
