// Cliente mínimo de la API de Telegram (usa fetch nativo de Node)
const api = (method) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

async function call(method, payload) {
  const res = await fetch(api(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description}`);
  return json.result;
}

export const tg = {
  send: (chatId, text, extra = {}) =>
    call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }),
  edit: (chatId, messageId, text, extra = {}) =>
    call('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra }),
  answer: (callbackId, text) => call('answerCallbackQuery', { callback_query_id: callbackId, text }),
  async document(chatId, filename, buffer, caption) {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) form.append('caption', caption);
    form.append('document', new Blob([buffer]), filename);
    const res = await fetch(api('sendDocument'), { method: 'POST', body: form });
    const json = await res.json();
    if (!json.ok) throw new Error(`Telegram sendDocument: ${json.description}`);
    return json.result;
  },
};

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
