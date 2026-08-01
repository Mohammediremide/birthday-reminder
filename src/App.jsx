import { useEffect, useMemo, useState } from "react";

const DATE_LABEL = new Date().toLocaleDateString("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Remembered only for this browser tab/session — never written to the JS
// bundle, never stored long-term. Closing the browser clears it, so you'll
// re-enter it next visit.
const SESSION_KEY = "birthday-dashboard:passphrase";

export default function App() {
  const [passphrase, setPassphrase] = useState(
    () => sessionStorage.getItem(SESSION_KEY) || ""
  );
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [data, setData] = useState(null); // { today, tomorrow, roster }
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  async function loadRoster(pass) {
    setLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/roster", {
        headers: { "x-app-passphrase": pass },
      });
      if (res.status === 401) {
        setAuthError("Wrong passphrase.");
        setAuthed(false);
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }
      const json = await res.json();
      setData(json);
      setAuthed(true);
      sessionStorage.setItem(SESSION_KEY, pass);
    } catch (e) {
      setAuthError(`Couldn't reach the server: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  // If a passphrase is already remembered for this session, use it right away.
  useEffect(() => {
    if (passphrase) loadRoster(passphrase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "x-app-passphrase": passphrase },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed");

      if (!json.sent && (!json.failures || json.failures.length === 0)) {
        setSendResult({ ok: true, message: "Nothing to send — no birthdays today." });
      } else if (json.sent) {
        setSendResult({ ok: true, message: "Sent to Telegram and Email." });
      } else {
        setSendResult({ ok: false, message: json.failures.join(" | ") });
      }
    } catch (e) {
      setSendResult({ ok: false, message: e.message });
    } finally {
      setSending(false);
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-ledger-bg text-ledger-card font-body flex items-center justify-center px-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadRoster(passphrase);
          }}
          className="w-full max-w-sm bg-ledger-surface border border-ledger-line rounded-lg p-6"
        >
          <p className="uppercase tracking-[0.2em] text-xs text-amber-soft/80 mb-2">
            Excel With Dikky — Community Roll Call
          </p>
          <h1 className="font-display text-xl font-semibold mb-4">Enter passphrase</h1>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="w-full rounded-md bg-ledger-bg border border-ledger-line px-3 py-2 mb-3 text-ledger-card outline-none focus:border-amber"
            autoFocus
          />
          {authError && <p className="text-sm text-rose mb-3">{authError}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber text-ledger-ink font-medium px-4 py-2 rounded-md hover:bg-amber-soft transition-colors disabled:opacity-50"
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    );
  }

  const totalToday = data?.today?.length || 0;

  return (
    <div className="min-h-screen bg-ledger-bg text-ledger-card font-body">
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        <header className="mb-8">
          <p className="uppercase tracking-[0.2em] text-xs text-amber-soft/80 mb-2">
            Excel With Dikky — Community Roll Call
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ledger-card">
            {DATE_LABEL}
          </h1>
          <p className="text-sm text-ledger-card/50 mt-2">
            A cron job checks and sends automatically every morning — this page is for
            viewing, or sending on demand.
          </p>
        </header>

        {data && (
          <>
            <div className="flex items-center gap-5 mb-8 bg-ledger-surface rounded-lg px-6 py-5 border border-ledger-line">
              <div className="shrink-0 w-16 h-16 rounded-full bg-amber text-ledger-ink flex items-center justify-center font-display text-2xl font-semibold">
                {totalToday}
              </div>
              <div>
                <p className="font-display text-xl font-semibold text-ledger-card">
                  {totalToday === 0
                    ? "No birthdays today"
                    : totalToday === 1
                    ? "1 birthday today"
                    : `${totalToday} birthdays today`}
                </p>
                <p className="text-sm text-ledger-card/60">
                  {data.tomorrow.length > 0
                    ? `${data.tomorrow.length} more tomorrow`
                    : "Nothing scheduled for tomorrow"}
                </p>
              </div>
            </div>

            {totalToday > 0 && (
              <Section title="Today">
                {data.today.map((p) => (
                  <PersonRow key={p.email} person={p} highlight />
                ))}
              </Section>
            )}

            {data.tomorrow.length > 0 && (
              <Section title="Tomorrow">
                {data.tomorrow.map((p) => (
                  <PersonRow key={p.email} person={p} />
                ))}
              </Section>
            )}

            <div className="mt-10 flex flex-col items-start gap-3">
              <button
                onClick={handleSend}
                disabled={sending}
                className="bg-amber text-ledger-ink font-medium px-5 py-2.5 rounded-md hover:bg-amber-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sending…" : "Send reminder now"}
              </button>
              {sendResult && (
                <p className={`text-sm ${sendResult.ok ? "text-amber-soft" : "text-rose"}`}>
                  {sendResult.message}
                </p>
              )}
            </div>

            <div className="mt-14">
              <h2 className="font-display text-lg font-semibold text-ledger-card mb-3">
                Full roster ({data.roster.length})
              </h2>
              <RosterTable roster={data.roster} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-lg font-semibold text-ledger-card mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function PersonRow({ person, highlight }) {
  return (
    <div
      className={`flex items-center justify-between rounded-md px-4 py-3 border ${
        highlight
          ? "bg-ledger-card text-ledger-ink border-amber"
          : "bg-ledger-surface text-ledger-card border-ledger-line"
      }`}
    >
      <div>
        <p className="font-medium">{person.fullName}</p>
        <p className={`text-xs ${highlight ? "text-ledger-ink/60" : "text-ledger-card/60"}`}>
          {person.cohort} · {person.email}
        </p>
      </div>
      {person.whatsapp && (
        <a
          href={`https://wa.me/${String(person.whatsapp).replace(/[^\d]/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className={`text-xs underline shrink-0 ml-4 ${
            highlight ? "text-ledger-ink/70" : "text-ledger-card/70"
          }`}
        >
          Message on WhatsApp
        </a>
      )}
    </div>
  );
}

function RosterTable({ roster }) {
  const rows = useMemo(() => roster, [roster]);
  return (
    <div className="overflow-x-auto rounded-lg border border-ledger-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ledger-surface text-ledger-card/70 text-left">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Cohort</th>
            <th className="px-4 py-2 font-medium">Birthday</th>
            <th className="px-4 py-2 font-medium">In</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.email} className="border-t border-ledger-line/60">
              <td className="px-4 py-2">{p.fullName}</td>
              <td className="px-4 py-2 text-ledger-card/70">{p.cohort}</td>
              <td className="px-4 py-2 text-ledger-card/70">
                {String(p.dob.day).padStart(2, "0")}/{String(p.dob.month).padStart(2, "0")}
              </td>
              <td className="px-4 py-2 text-ledger-card/70">
                {p.daysAway === 0 ? "Today" : p.daysAway === 1 ? "Tomorrow" : `${p.daysAway}d`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
