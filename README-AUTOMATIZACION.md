# Invoice automático por Telegram

Cada 2 semanas, **un día antes del envío a las 6pm (Melbourne)**, el bot de Telegram te manda:
- vista previa del correo (destinatarios, asunto, turnos, total y cuerpo)
- el Excel y el Word adjuntos (`INV-0XX Santiago Hernandez`)
- botones **✅ Aprobar y enviar · 🔄 Regenerar · ❌ Cancelar**

Al aprobar, el correo sale desde tu Gmail con los dos archivos y el número de invoice sube solo.
Si el día de envío a las 9am todavía no aprobaste, te llega un recordatorio.

## Comandos del bot
| Comando | Qué hace |
|---|---|
| `/preview` | Genera ya la vista previa del próximo invoice |
| `/preview 2026-11-09` | Vista previa del período que empieza ese día |
| `/estado` | Próximo período, estado y número |
| `/numero 13` | Cambia el próximo número de invoice |

## Configuración (una sola vez)

### 1. Conectar Netlify con GitHub
Las funciones necesitan instalar librerías, así que el sitio debe desplegarse desde este repositorio
(Netlify → *Site configuration → Build & deploy → Link repository*). Build command: vacío. Publish directory: `.`

### 2. Crear el bot
1. En Telegram abre **@BotFather** → `/newbot` → ponle nombre → copia el **token**.

### 3. Contraseña de aplicación de Gmail
1. Activa la verificación en 2 pasos en tu cuenta de Google.
2. Ve a https://myaccount.google.com/apppasswords → crea una llamada "ABN Bills" → copia las 16 letras.

### 4. Variables de entorno en Netlify
*Site configuration → Environment variables*:

| Variable | Valor |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token de BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | cualquier clave larga inventada (letras, números, `-` o `_`) |
| `TELEGRAM_CHAT_ID` | lo obtienes en el paso 5 |
| `ICS_URL` | link del calendario `.ics` |
| `GMAIL_USER` | tu dirección de Gmail |
| `GMAIL_APP_PASSWORD` | la contraseña de aplicación |
| `EMAIL_TO` | destinatarios, separados por coma |
| `EMAIL_CC` | (opcional) copia, separados por coma |
| `INVOICE_NEXT_NUMBER` | número del próximo invoice (solo se usa la primera vez) |

### 5. Conectar el bot
1. Despliega el sitio.
2. Abre `https://abn-bill.netlify.app/.netlify/functions/telegram-setup?key=TU_TELEGRAM_WEBHOOK_SECRET`
3. Escríbele `/start` al bot → te responde tu chat id → ponlo en `TELEGRAM_CHAT_ID` y vuelve a desplegar.
4. `/start` otra vez → "Listo, este chat está conectado". Prueba con `/preview`.

## Ajustes
Todo lo no privado está en `netlify/functions/lib/config.mjs`: tarifas por nombre de turno, fechas de las
quincenas, hora del aviso, texto del correo y nombre de los archivos.

## Probar en tu computador (no envía nada)
```
npm install
npm run probar -- "<link .ics>" 2026-10-26 12
```
Genera los archivos en `salida-prueba/` y muestra el correo en pantalla.
