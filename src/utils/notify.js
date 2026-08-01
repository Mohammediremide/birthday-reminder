import emailjs from "@emailjs/browser";

// All of these come from your .env file (copy .env.example -> .env and fill
// in real values). Vite only exposes variables prefixed with VITE_ to the
// browser bundle — see README.md for where to get each one.
const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const EMAIL_TO = import.meta.env.VITE_EMAIL_TO;

/** Builds the shared plain-text summary used by both channels. */
export function buildSummary({ today, tomorrow }) {
  const lines = [];

  if (today.length) {
    lines.push("Birthdays TODAY:");
    today.forEach((p) => lines.push(`- ${p.fullName} (${p.email})`));
  } else {
    lines.push("No birthdays today.");
  }

  if (tomorrow.length) {
    lines.push("");
    lines.push("Birthdays TOMORROW (heads up):");
    tomorrow.forEach((p) => lines.push(`- ${p.fullName} (${p.email})`));
  }

  return lines.join("\n");
}

/** Sends a message straight to your Telegram chat via the Bot API. */
export async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error("Telegram bot token or chat ID missing from .env");
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram request failed: ${body}`);
  }
}

/** Sends the reminder email via EmailJS (no backend server needed). */
export async function sendEmail({ subject, message }) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    throw new Error("EmailJS service/template/public key missing from .env");
  }

  await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    {
      to_email: EMAIL_TO,
      subject,
      message,
    },
    { publicKey: EMAILJS_PUBLIC_KEY }
  );
}
