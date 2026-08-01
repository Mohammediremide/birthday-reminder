import fs from "fs";
import path from "path";

/** Loads the committed roster snapshot (see scripts/convert-excel-to-json.js). */
export function loadRoster() {
  const filePath = path.join(process.cwd(), "data", "roster.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

/**
 * Splits the roster into today's and tomorrow's birthdays, and returns the
 * full roster sorted by soonest upcoming birthday (for the dashboard table).
 * `referenceDate` defaults to now, but is accepted as a param for testing.
 */
export function computeBirthdays(people, referenceDate = new Date()) {
  const today = referenceDate;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isMatch = (dob, date) =>
    dob.month === date.getMonth() + 1 && dob.day === date.getDate();

  const todays = people.filter((p) => isMatch(p.dob, today));
  const tomorrows = people.filter((p) => isMatch(p.dob, tomorrow));

  const sortedRoster = people
    .map((p) => {
      const next = new Date(today.getFullYear(), p.dob.month - 1, p.dob.day);
      if (next < today) next.setFullYear(next.getFullYear() + 1);
      const daysAway = Math.round((next - today) / (1000 * 60 * 60 * 24));
      return { ...p, daysAway };
    })
    .sort((a, b) => a.daysAway - b.daysAway);

  return { today: todays, tomorrow: tomorrows, sortedRoster };
}

/** Builds the plain-text summary shared by Telegram and email. */
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

/** Sends a message to your Telegram chat via the Bot API (server-side). */
export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Telegram env vars missing on the server");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) throw new Error(`Telegram request failed: ${await res.text()}`);
}

/** Sends the reminder email via the EmailJS REST API (server-side, no browser needed). */
export async function sendEmail({ subject, message }) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !templateId || !publicKey) {
    throw new Error("EmailJS env vars missing on the server");
  }

  const body = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: { subject, message },
  };
  // Your EmailJS account has "Use Private Key" enabled, which requires this
  // extra field to authorize server-side (non-browser) requests.
  if (privateKey) body.accessToken = privateKey;

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`EmailJS request failed: ${await res.text()}`);
}

/** Runs the full check-and-send flow. Shared by the cron route and manual send. */
export async function runReminderCheck() {
  const people = loadRoster();
  const birthdays = computeBirthdays(people);
  const summary = buildSummary(birthdays);

  const hasSomethingToReport = birthdays.today.length > 0;
  if (!hasSomethingToReport) {
    return { sent: false, summary, birthdays };
  }

  const subject = `Birthday Reminder - ${new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;

  const failures = [];
  try {
    await sendTelegram(`${subject}\n\n${summary}`);
  } catch (e) {
    failures.push(`Telegram: ${e.message}`);
  }
  try {
    await sendEmail({ subject, message: summary });
  } catch (e) {
    failures.push(`Email: ${e.message}`);
  }

  return { sent: failures.length === 0, failures, summary, birthdays };
}
