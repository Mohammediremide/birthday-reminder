import { runReminderCheck, sendTelegram } from "../lib/roster.js";
import { safeCompare } from "../lib/security.js";

/**
 * Vercel Cron hits this with a GET request on the schedule set in
 * vercel.json, and automatically attaches an "Authorization: Bearer
 * <CRON_SECRET>" header when the CRON_SECRET env var is set — so we check
 * for that to make sure random visitors can't trigger a send just by
 * knowing this URL.
 *
 * The `run` query param (set per schedule in vercel.json) identifies which
 * of the three daily runs this is — used only for the once-a-day heartbeat
 * below, so it fires once, not three times.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!safeCompare(req.headers.authorization || "", expected)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const includeTomorrow = req.query.includeTomorrow === "1";
  const run = req.query.run || "unspecified";

  try {
    const result = await runReminderCheck({ includeTomorrow });

    // Peace of mind #1: if a send genuinely failed, tell you about it right
    // away instead of it silently sitting unnoticed in a log nobody reads.
    if (result.failures && result.failures.length > 0) {
      try {
        await sendTelegram(
          `⚠️ Birthday app error (${run} run)\n\n${result.failures.join("\n")}`
        );
      } catch {
        // If even the alert fails to send, there's nothing more we can do
        // here — the cron response below still records the failure.
      }
    }

    // Peace of mind #2: a quiet once-a-day confirmation that the whole
    // pipeline is actually alive, sent only on the morning run and only
    // when there was nothing else to report — so it never adds noise on
    // top of a real birthday message, but you'll notice if a morning ever
    // goes by with total silence (a sign the cron itself stopped running).
    if (run === "morning" && !result.sent && (!result.failures || result.failures.length === 0)) {
      try {
        await sendTelegram("✅ Birthday app checked in — no birthdays today, all systems fine.");
      } catch {
        // Non-critical — skip silently if this one message fails to send.
      }
    }

    return res.status(200).json({ ...result, run });
  } catch (e) {
    // A hard crash (not just a send failure) — try to alert about this too,
    // since it means the whole check never even ran.
    try {
      await sendTelegram(`⚠️ Birthday app crashed (${run} run): ${e.message}`);
    } catch {
      // best effort only
    }
    return res.status(500).json({ error: e.message, run });
  }
}
