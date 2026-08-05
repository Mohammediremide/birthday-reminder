import { runReminderCheck } from "../lib/roster.js";
import { safeCompare } from "../lib/security.js";

/**
 * Vercel Cron hits this with a GET request on the schedule set in
 * vercel.json, and automatically attaches an "Authorization: Bearer
 * <CRON_SECRET>" header when the CRON_SECRET env var is set — so we check
 * for that to make sure random visitors can't trigger a send just by
 * knowing this URL.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!safeCompare(req.headers.authorization || "", expected)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await runReminderCheck();
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
