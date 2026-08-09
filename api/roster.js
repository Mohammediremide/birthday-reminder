import { loadRoster, computeBirthdays, findDataIssues, runReminderCheck } from "../lib/roster.js";
import { fetchRosterWithHealedIds } from "../lib/github.js";
import { safeCompare } from "../lib/security.js";

/**
 * Used by the dashboard. Requires the shared app passphrase (set as
 * APP_PASSPHRASE in Vercel's project settings) so a stranger who finds your
 * URL can't see your community's names/emails/phone numbers or trigger a
 * send. The passphrase is typed by you in the browser each session — it's
 * never baked into the JS bundle.
 *
 * GET  -> returns the roster + today/tomorrow birthdays (read-only, view)
 * POST -> actually sends the reminder right now (manual trigger)
 */
export default async function handler(req, res) {
  const passphrase = req.headers["x-app-passphrase"] || "";
  if (!process.env.APP_PASSPHRASE || !safeCompare(passphrase, process.env.APP_PASSPHRASE)) {
    return res.status(401).json({ error: "Wrong or missing passphrase" });
  }

  if (req.method === "GET") {
    // If GitHub is configured, read the LIVE file — the same source
    // Add/Edit/Delete operate on — instead of the bundle from your last
    // deploy. Without this, the dashboard could show someone that an edit
    // request can no longer find, if a change landed on GitHub before the
    // next redeploy caught up. Falls back to the bundled copy if GitHub
    // isn't set up (read-only viewing still works either way).
    let people;
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
      try {
        ({ people } = await fetchRosterWithHealedIds());
      } catch {
        people = loadRoster(); // GitHub hiccup — fall back rather than break the view
      }
    } else {
      people = loadRoster();
    }

    const { today, tomorrow, sortedRoster } = computeBirthdays(people);
    const warnings = findDataIssues(people);
    return res.status(200).json({ today, tomorrow, roster: sortedRoster, warnings });
  }

  if (req.method === "POST") {
    try {
      const result = await runReminderCheck();
      return res.status(200).json(result);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
