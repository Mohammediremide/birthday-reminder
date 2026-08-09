/**
 * Lets the dashboard add/edit/delete people without you needing to touch
 * git yourself. Since data/roster.json lives in your GitHub repo (and
 * Vercel's serverless functions can't permanently write to their own
 * filesystem), edits from the dashboard work by committing the updated
 * file straight to GitHub via their API — which then triggers Vercel to
 * redeploy automatically, same as any other push.
 *
 * Needs three env vars (see .env.example):
 *   GITHUB_TOKEN  - a Personal Access Token with "repo" scope
 *   GITHUB_REPO   - "yourusername/your-repo-name"
 *   GITHUB_BRANCH - usually "main"
 */

const API_BASE = "https://api.github.com";
const FILE_PATH = "data/roster.json";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

/** Fetches the current roster.json content + its git blob SHA (required to update it). */
export async function fetchRosterFromGitHub() {
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  const res = await fetch(
    `${API_BASE}/repos/${repo}/contents/${FILE_PATH}?ref=${branch}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`GitHub read failed: ${await res.text()}`);

  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { people: JSON.parse(content), sha: data.sha };
}

/** Commits an updated people array back to roster.json in the repo. */
export async function commitRosterToGitHub(people, sha, message) {
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  const content = Buffer.from(JSON.stringify(people, null, 2)).toString("base64");

  const res = await fetch(`${API_BASE}/repos/${repo}/contents/${FILE_PATH}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ message, content, sha, branch }),
  });
  if (!res.ok) throw new Error(`GitHub write failed: ${await res.text()}`);

  return res.json();
}
