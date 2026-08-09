import fs from "fs";
import path from "path";
import { buildCelebrationMessage } from "./celebration.js";

/** Loads the committed roster snapshot (see scripts/convert-excel-to-json.js). */
export function loadRoster() {
  const filePath = path.join(process.cwd(), "data", "roster.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

/**
 * Returns the {year, month, day} calendar date in Africa/Lagos time for a
 * given moment. This matters because Vercel's servers run in UTC — without
 * this, "today" briefly disagrees with Lagos clocks around midnight.
 */
function lagosDateParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const map = {};
  parts.forEach((p) => (map[p.type] = p.value));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

/**
 * Splits the roster into today's and tomorrow's birthdays (both computed in
 * Lagos time, regardless of what timezone the server itself runs in), and
 * returns the full roster sorted by soonest upcoming birthday.
 */
export function computeBirthdays(people, referenceDate = new Date()) {
  const today = lagosDateParts(referenceDate);
  const tomorrowMoment = new Date(referenceDate.getTime() + 24 * 60 * 60 * 1000);
  const tomorrow = lagosDateParts(tomorrowMoment);

  const isMatch = (dob, parts) => dob.month === parts.month && dob.day === parts.day;

  const todays = people.filter((p) => isMatch(p.dob, today));
  const tomorrows = people.filter((p) => isMatch(p.dob, tomorrow));

  const sortedRoster = people
    .map((p) => {
      const next = new Date(today.year, p.dob.month - 1, p.dob.day);
      const todayAsDate = new Date(today.year, today.month - 1, today.day);
      if (next < todayAsDate) next.setFullYear(next.getFullYear() + 1);
      const daysAway = Math.round((next - todayAsDate) / (1000 * 60 * 60 * 24));
      return { ...p, daysAway };
    })
    .sort((a, b) => a.daysAway - b.daysAway);

  return { today: todays, tomorrow: tomorrows, sortedRoster };
}

/**
 * Flags likely data problems: exact duplicate names, same name with a
 * different birthday (probably a typo in one of the entries), and
 * impossible dates (e.g. day 31 in a month that doesn't have one).
 * Returns a list of short human-readable warning strings.
 */
export function findDataIssues(people) {
  const warnings = [];
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Feb=29 to allow leap-day entries

  const byName = new Map();
  for (const p of people) {
    const key = (p.fullName || "").trim().toLowerCase();
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(p);
  }

  for (const [, group] of byName) {
    if (group.length < 2) continue;
    const dates = new Set(group.map((p) => `${p.dob.month}/${p.dob.day}`));
    if (dates.size === 1) {
      warnings.push(`"${group[0].fullName}" appears ${group.length} times with the same birthday — likely an exact duplicate entry.`);
    } else {
      warnings.push(`"${group[0].fullName}" appears ${group.length} times with different birthdays (${[...dates].join(", ")}) — check which date is correct.`);
    }
  }

  for (const p of people) {
    const { month, day } = p.dob || {};
    if (!month || !day || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
      warnings.push(`"${p.fullName}" has an invalid date (day ${day}, month ${month}) — please fix.`);
    }
  }

  return warnings;
}

/** Formats one person's full profile as a readable block of lines. */
export function formatPerson(p) {
  const lines = [`- ${p.fullName} (${p.cohort})`];
  if (p.email) lines.push(`    Email: ${p.email}`);
  if (p.mobile) lines.push(`    Mobile: ${p.mobile}`);
  if (p.whatsapp) lines.push(`    WhatsApp: ${p.whatsapp}`);
  if (p.occupation) lines.push(`    Occupation: ${p.occupation}`);
  if (p.sex) lines.push(`    Sex: ${p.sex}`);
  if (p.ageBracket) lines.push(`    Age bracket: ${p.ageBracket}`);
  if (p.country || p.state) {
    lines.push(`    Location: ${[p.state, p.country].filter(Boolean).join(", ")}`);
  }
  if (p.trainingType) lines.push(`    Training: ${p.trainingType}`);
  return lines.join("\n");
}

/** Builds the plain-text summary shared by Telegram and email. */
export function buildSummary({ today, tomorrow }) {
  const lines = [];

  if (today.length) {
    lines.push("Birthdays TODAY:");
    today.forEach((p) => lines.push(formatPerson(p), ""));
  } else {
    lines.push("No birthdays today.");
  }

  if (tomorrow.length) {
    lines.push("Birthdays TOMORROW (heads up):");
    tomorrow.forEach((p) => lines.push(formatPerson(p), ""));
  }

  return lines.join("\n").trim();
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

/**
 * Runs the full check-and-send flow. Shared by the cron route and manual
 * send. Pass { includeTomorrow: true } to also send when nobody has a
 * birthday today but someone does tomorrow — used for the 3PM run, as an
 * evening heads-up ahead of the next day.
 */
export async function runReminderCheck({ includeTomorrow = false } = {}) {
  const people = loadRoster();
  const birthdays = computeBirthdays(people);

  const hasToday = birthdays.today.length > 0;
  const hasSomethingToReport = hasToday || (includeTomorrow && birthdays.tomorrow.length > 0);
  if (!hasSomethingToReport) {
    return { sent: false, summary: buildSummary(birthdays), birthdays };
  }

  // Today's birthdays get the warm celebration-style message. If there's
  // nothing today but tomorrow's included (the 3PM heads-up run), fall back
  // to the plain summary style instead — it's a heads-up, not a celebration.
  let message;
  if (hasToday) {
    const celebration = await buildCelebrationMessage(birthdays.today);

    // Full details block — one entry per today's person, in the same order
    // they appear in birthdays.today, so each name is paired with their own
    // correct details (never mixed up between people).
    const detailsBlock = birthdays.today.map((p) => formatPerson(p)).join("\n\n");

    message = `${celebration}\n\n— — —\nFull details:\n${detailsBlock}`;

    if (birthdays.tomorrow.length > 0) {
      message += `\n\nAlso coming up tomorrow:\n${birthdays.tomorrow
        .map((p) => `- ${p.fullName} @${p.whatsapp || p.mobile}`)
        .join("\n")}`;
    }
  } else {
    message = buildSummary(birthdays);
  }

  const subject = `Birthday Reminder - ${new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  })}`;

  const failures = [];
  try {
    await sendTelegram(`${subject}\n\n${message}`);
  } catch (e) {
    failures.push(`Telegram: ${e.message}`);
  }
  try {
    await sendEmail({ subject, message });
  } catch (e) {
    failures.push(`Email: ${e.message}`);
  }

  return { sent: failures.length === 0, failures, summary: message, birthdays };
}
