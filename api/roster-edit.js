import crypto from "crypto";
import { fetchRosterWithHealedIds, commitRosterToGitHub } from "../lib/github.js";
import { findDataIssues } from "../lib/roster.js";
import { safeCompare } from "../lib/security.js";

/**
 * Lets the dashboard add, edit, or delete people without you touching git
 * yourself. Every change here commits straight to data/roster.json in your
 * GitHub repo, which triggers Vercel to redeploy automatically (usually
 * live within ~30-60 seconds) — same end result as editing the file and
 * pushing manually, just done for you.
 *
 * POST   -> add a new person
 * PUT    -> edit an existing person (matched by id)
 * DELETE -> remove a person (matched by id)
 */
export default async function handler(req, res) {
  const passphrase = req.headers["x-app-passphrase"] || "";
  if (!process.env.APP_PASSPHRASE || !safeCompare(passphrase, process.env.APP_PASSPHRASE)) {
    return res.status(401).json({ error: "Wrong or missing passphrase" });
  }

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return res.status(500).json({
      error: "GitHub isn't configured yet — set GITHUB_TOKEN and GITHUB_REPO in Vercel's environment variables.",
    });
  }

  try {
    const { people, sha } = await fetchRosterWithHealedIds();

    if (req.method === "POST") {
      const person = { id: crypto.randomUUID(), ...req.body };
      if (!person.fullName || !person.dob?.day || !person.dob?.month) {
        return res.status(400).json({ error: "fullName and dob {day, month} are required" });
      }
      people.push(person);
      await commitRosterToGitHub(people, sha, `Add ${person.fullName} via dashboard`);
      return res.status(200).json({ ok: true, warnings: findDataIssues(people) });
    }

    if (req.method === "PUT") {
      const { id, ...updates } = req.body;
      const index = people.findIndex((p) => p.id === id);
      if (index === -1) return res.status(404).json({ error: "Person not found" });

      people[index] = { ...people[index], ...updates, id };
      await commitRosterToGitHub(people, sha, `Edit ${people[index].fullName} via dashboard`);
      return res.status(200).json({ ok: true, warnings: findDataIssues(people) });
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      const person = people.find((p) => p.id === id);
      if (!person) return res.status(404).json({ error: "Person not found" });

      const updated = people.filter((p) => p.id !== id);
      await commitRosterToGitHub(updated, sha, `Remove ${person.fullName} via dashboard`);
      return res.status(200).json({ ok: true, warnings: findDataIssues(updated) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
