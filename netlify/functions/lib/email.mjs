// Envío del correo por Gmail (SMTP con contraseña de aplicación)
import nodemailer from 'nodemailer';

export async function sendInvoiceEmail(draft, attachments) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_TO, EMAIL_CC, EMAIL_BCC } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !EMAIL_TO) {
    throw new Error('Faltan variables GMAIL_USER, GMAIL_APP_PASSWORD o EMAIL_TO en Netlify');
  }

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s+/g, '') },
  });

  const info = await transport.sendMail({
    from: `"${draft.name}" <${GMAIL_USER}>`,
    to: EMAIL_TO,
    cc: EMAIL_CC || undefined,
    bcc: EMAIL_BCC || undefined,
    subject: draft.subject,
    text: draft.body,
    attachments,
  });
  return info.messageId;
}

export function recipientsSummary() {
  const { EMAIL_TO = '(sin configurar)', EMAIL_CC } = process.env;
  return EMAIL_CC ? `${EMAIL_TO}\nCC: ${EMAIL_CC}` : EMAIL_TO;
}
