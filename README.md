# Birthday Roll Call Dashboard (Vercel + Cron)

Sends you a Telegram message and email every morning if anyone in the
community database has a birthday — fully automatic once deployed, no
browser or PC needs to be open. There's also a small dashboard you can open
any time to see who's coming up, or trigger a send manually.

## How it works

- `data/roster.json` is a snapshot of your Excel file, committed to the
  project. Vercel's servers read this — they can't reach your local Excel
  file directly, so this JSON is the "source of truth" once deployed.
- `api/cron-send.js` is a serverless function Vercel calls automatically
  every day (see `vercel.json` for the schedule) — this is what actually
  sends the reminder, with zero input from you.
- `api/roster.js` powers the dashboard: viewing today's/tomorrow's
  birthdays, and a manual "Send reminder now" button, both protected by a
  passphrase so a stranger with your URL can't see the roster or trigger
  a send.
- Your Telegram token and EmailJS keys live only on Vercel's servers now —
  never in the browser, never visible to site visitors.

## 1. Update the roster (whenever the Excel file changes)

```bash
npm install
npm run convert-roster -- "path/to/Excel_With_Dikky_-_Community_Database.xlsx"
```

This overwrites `data/roster.json`. Commit and push it — Vercel redeploys
automatically and the cron job picks up the new roster on its next run.

## 2. Deploy to Vercel

```bash
npx vercel
```

Follow the prompts (link or create a project). Then set your real secrets
as **Environment Variables** in the Vercel dashboard (Project → Settings →
Environment Variables) — NOT in a `.env` file, since that never gets
uploaded to Vercel:

| Variable | Value |
|---|---|
| `APP_PASSPHRASE` | Any password you'll type to open the dashboard |
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `TELEGRAM_CHAT_ID` | From the `getUpdates` step |
| `EMAILJS_SERVICE_ID` | From EmailJS → Email Services |
| `EMAILJS_TEMPLATE_ID` | From EmailJS → Email Templates |
| `EMAILJS_PUBLIC_KEY` | From EmailJS → Account → General |
| `EMAILJS_PRIVATE_KEY` | From EmailJS → Account → General (needed since your account has "Use Private Key" enabled) |
| `CRON_SECRET` | Any random string, e.g. generate one at randomkeygen.com |

After adding them, redeploy (Vercel does this automatically on the next
push, or click "Redeploy" in the dashboard) so the functions can see them.

**Important — EmailJS domain restriction:** by default EmailJS may block
requests from origins it doesn't recognize. In EmailJS → Account →
Security, either turn off "Allow requests from the API only from this
domain," or add your `*.vercel.app` domain to the allowlist — otherwise
the email step will fail with a 403.

## 3. Confirm the cron schedule

`vercel.json` runs the check daily at `0 6 * * *` (6:00 AM UTC = 7:00 AM
Lagos time, since Lagos has no daylight saving). To change the time,
edit that line — cron format is `minute hour * * *`, always in UTC.

On Vercel's free (Hobby) plan, cron jobs run once per day, which is all
this needs.

## 4. Use the dashboard

Visit your deployed URL, enter the `APP_PASSPHRASE` you set, and you'll
see today's/tomorrow's birthdays plus the full roster sorted by who's
next. "Send reminder now" fires immediately, on top of the automatic
morning run.

## Local development

The dashboard's `/api` routes need a real server, not just Vite, so use
the Vercel CLI instead of `npm run dev` when testing locally:

```bash
npm install -g vercel   # once
cp .env.example .env
# fill in .env with your real values
vercel dev
```

## Notes

- `data/roster.json` contains names, emails, and phone numbers — the
  passphrase gate keeps casual visitors out, but for real sensitivity
  treat your Vercel project as you would any place holding that data
  (don't share the URL publicly, consider Vercel's paid password
  protection for a stronger lock).
- If you ever add new people to the Excel file, keep `Date of Birth` in
  `DD-Mon` format (e.g. `01-Dec`) — that's what the converter script
  expects.
