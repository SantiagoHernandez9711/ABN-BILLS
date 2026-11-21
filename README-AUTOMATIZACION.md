# Invoice automático por Telegram

Cada 2 semanas (quincenas desde Oct 26 2026), en hora de Melbourne:

| Cuándo | Qué pasa |
|---|---|
| **Sábado 8pm** | El bot te manda la vista previa: destinatarios, asunto, turnos, total, cuerpo del correo y los adjuntos `INV-0XX Santiago Hernandez.xlsx` y `.docx` |
| Tú tocas **✅ Aprobar** | Queda programado |
| Domingo 12pm | Si no has aprobado, te llega un recordatorio |
| **Domingo 9pm** | Se envía el correo desde tu Gmail y el número de invoice sube solo |

Botones de la vista previa: **✅ Aprobar · 📤 Enviar ahora · 🔄 Regenerar** (vuelve a leer el calendario) **· ❌ Cancelar**.
Después de aprobar puedes **↩️ Deshacer** hasta las 9pm del domingo.

## Tarifas
- Turnos cuyo nombre contiene **"Tooronga"** y **"Night Shift"** → **$40/h**
- Cualquier otro turno → **$30/h**
- Si el turno **empieza** en un feriado de Victoria → **tarifa doble** (aparece con 🎉 en la vista previa y como
  "Public Holiday" en el Excel). Usa `/feriados` para ver la lista del año.
- El viernes de la Gran Final de la AFL cambia cada año: agrega la fecha en `grandFinalFridays`
  (`netlify/functions/lib/config.mjs`) cuando el gobierno la publique. El bot te avisa si falta.

## Comandos del bot
| Comando | Qué hace |
|---|---|
| `/preview` | Genera ya la vista previa del próximo invoice |
| `/preview 2026-11-09` | Vista previa del período que empieza ese día |
| `/estado` | Próximo período, fechas, estado y número |
| `/numero 13` | Cambia el próximo número de invoice |
| `/feriados` (o `/feriados 2027`) | Feriados de Victoria que se cobran doble |

## Configuración (una sola vez)

### 1. Crear el bot
En Telegram abre **@BotFather** → `/newbot` → ponle nombre → copia el **token**.

### 2. Contraseña de aplicación de Gmail
1. Activa la verificación en 2 pasos en tu cuenta de Google.
2. Entra a https://myaccount.google.com/apppasswords → crea una llamada "ABN Bills" → copia las 16 letras.

### 3. Variables de entorno en Netlify
*Site configuration → Environment variables → Add a variable*.
⚠️ El repositorio es **público**: estos datos van solo aquí, nunca en el código.

| Variable | Valor |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token de BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | una clave larga inventada (solo letras, números, `-` o `_`) |
| `TELEGRAM_CHAT_ID` | lo obtienes en el paso 4 |
| `ICS_URL` | link del calendario `.ics` |
| `GMAIL_USER` | tu dirección de Gmail |
| `GMAIL_APP_PASSWORD` | la contraseña de aplicación |
| `EMAIL_TO` | destinatarios, separados por coma |
| `EMAIL_CC` | (opcional) copia, separados por coma |
| `INVOICE_NEXT_NUMBER` | `13` (solo se usa la primera vez; luego sube solo) |
| `INVOICE_FULL_NAME` | nombre completo para el Word |
| `INVOICE_ABN` | ABN / ACN |
| `INVOICE_ADDRESS` | dirección |
| `INVOICE_PHONE` | teléfono |
| `INVOICE_EMAIL` | email que aparece en el Word |
| `INVOICE_BUSINESS_NAME` | (opcional) Business Name |
| `BANK_ACCOUNT_NAME` | Account Name |
| `BANK_BSB` | BSB |
| `BANK_ACCOUNT_NUMBER` | Account Number |

### 4. Conectar el bot
1. Haz *merge* de esta rama a `main` (o despliégala) para que Netlify publique las funciones.
2. Abre `https://abn-bill.netlify.app/.netlify/functions/telegram-setup?key=TU_TELEGRAM_WEBHOOK_SECRET`
3. Escríbele `/start` al bot → te responde tu chat id → ponlo en `TELEGRAM_CHAT_ID` y haz *Deploys → Trigger deploy*.
4. `/start` otra vez → "Listo, este chat está conectado". Prueba con `/preview` (no envía nada hasta que apruebes).

## Ajustes
Todo lo no privado está en `netlify/functions/lib/config.mjs`: tarifas, quincenas, horarios, feriados extra,
"Bill to", texto del correo y nombre de los archivos.

## Probar en tu computador (no envía nada)
```
npm install
npm run probar -- "<link .ics>" 2026-10-26 12
```
Genera el Excel y el Word en `salida-prueba/` y muestra el correo en pantalla.
