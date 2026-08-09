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
  const [showAddForm, setShowAddForm] = useState(false);

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
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-xl font-semibold">Enter passphrase</h1>
            <SecurityBadge />
          </div>
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
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
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
          </div>
          <SecurityBadge />
        </header>

        {data?.warnings?.length > 0 && (
          <div className="mb-8 rounded-md border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose space-y-1">
            <p className="font-medium">Possible data issues:</p>
            {data.warnings.map((w, i) => (
              <p key={i}>• {w}</p>
            ))}
          </div>
        )}

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
                  <PersonRow key={p.id || p.email} person={p} highlight />
                ))}
              </Section>
            )}

            {data.tomorrow.length > 0 && (
              <Section title="Tomorrow">
                {data.tomorrow.map((p) => (
                  <PersonRow key={p.id || p.email} person={p} />
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
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg font-semibold text-ledger-card">
                  Full roster ({data.roster.length})
                </h2>
                <button
                  onClick={() => setShowAddForm((s) => !s)}
                  className="text-xs bg-ledger-surface border border-ledger-line px-3 py-1.5 rounded-md hover:border-amber transition-colors"
                >
                  {showAddForm ? "Cancel" : "+ Add person"}
                </button>
              </div>

              {showAddForm && (
                <PersonForm
                  passphrase={passphrase}
                  onDone={() => {
                    setShowAddForm(false);
                    loadRoster(passphrase);
                  }}
                />
              )}

              <RosterTable
                roster={data.roster}
                passphrase={passphrase}
                onChanged={() => loadRoster(passphrase)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Small visible confirmation that the passphrase gate is active — this is
 * shown any time you're viewing this page, since reaching this point means
 * you already passed the passphrase check (the fetch to /api/roster
 * succeeded). If someone without the passphrase tries the URL, they never
 * get here at all — they stay stuck on the login form.
 */
function SecurityBadge() {
  return (
    <div className="shrink-0 flex items-center gap-1.5 text-xs bg-ledger-surface border border-amber/40 rounded-full px-3 py-1.5 text-amber-soft">
      <span aria-hidden="true">🔒</span>
      <span>Locked — passphrase active</span>
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

const FIELDS = [
  { key: "fullName", label: "Full name" },
  { key: "cohort", label: "Cohort" },
  { key: "email", label: "Email" },
  { key: "mobile", label: "Mobile" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "occupation", label: "Occupation" },
  { key: "sex", label: "Sex" },
  { key: "ageBracket", label: "Age bracket" },
  { key: "country", label: "Country" },
  { key: "state", label: "State" },
];

/** Add or edit a person. Pass `person` to edit an existing one, omit to add new. */
function PersonForm({ passphrase, onDone, person }) {
  const [form, setForm] = useState(() => ({
    fullName: person?.fullName || "",
    cohort: person?.cohort || "",
    email: person?.email || "",
    mobile: person?.mobile || "",
    whatsapp: person?.whatsapp || "",
    occupation: person?.occupation || "",
    sex: person?.sex || "",
    ageBracket: person?.ageBracket || "",
    country: person?.country || "",
    state: person?.state || "",
    day: person?.dob?.day || "",
    month: person?.dob?.month || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const { day, month, ...rest } = form;
    const body = { ...rest, dob: { day: Number(day), month: Number(month) } };

    try {
      const res = await fetch("/api/roster-edit", {
        method: person ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "x-app-passphrase": passphrase },
        body: JSON.stringify(person ? { id: person.id, ...body } : body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-ledger-surface border border-ledger-line rounded-lg p-5 mb-6 grid sm:grid-cols-2 gap-3"
    >
      {FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs text-ledger-card/60 mb-1">{label}</label>
          <input
            value={form[key]}
            onChange={(e) => update(key, e.target.value)}
            className="w-full rounded-md bg-ledger-bg border border-ledger-line px-3 py-1.5 text-sm outline-none focus:border-amber"
          />
        </div>
      ))}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-ledger-card/60 mb-1">Birth day *</label>
          <input
            type="number"
            min="1"
            max="31"
            value={form.day}
            onChange={(e) => update("day", e.target.value)}
            className="w-full rounded-md bg-ledger-bg border border-ledger-line px-3 py-1.5 text-sm outline-none focus:border-amber"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-ledger-card/60 mb-1">Birth month (1-12) *</label>
          <input
            type="number"
            min="1"
            max="12"
            value={form.month}
            onChange={(e) => update("month", e.target.value)}
            className="w-full rounded-md bg-ledger-bg border border-ledger-line px-3 py-1.5 text-sm outline-none focus:border-amber"
          />
        </div>
      </div>
      <div className="sm:col-span-2 flex items-center gap-3 mt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-amber text-ledger-ink font-medium px-4 py-2 rounded-md hover:bg-amber-soft transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : person ? "Save changes" : "Add person"}
        </button>
        {error && <p className="text-sm text-rose">{error}</p>}
      </div>
    </form>
  );
}

function RosterTable({ roster, passphrase, onChanged }) {
  const rows = useMemo(() => roster, [roster]);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(person) {
    if (!confirm(`Remove ${person.fullName} from the roster? This can't be undone.`)) return;
    setDeletingId(person.id);
    try {
      const res = await fetch("/api/roster-edit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-app-passphrase": passphrase },
        body: JSON.stringify({ id: person.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      onChanged();
    } catch (e) {
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (editingId) {
    const person = rows.find((p) => p.id === editingId);
    return (
      <PersonForm
        passphrase={passphrase}
        person={person}
        onDone={() => {
          setEditingId(null);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-ledger-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ledger-surface text-ledger-card/70 text-left">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Cohort</th>
            <th className="px-4 py-2 font-medium">Birthday</th>
            <th className="px-4 py-2 font-medium">In</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id || p.email} className="border-t border-ledger-line/60">
              <td className="px-4 py-2">{p.fullName}</td>
              <td className="px-4 py-2 text-ledger-card/70">{p.cohort}</td>
              <td className="px-4 py-2 text-ledger-card/70">
                {String(p.dob.day).padStart(2, "0")}/{String(p.dob.month).padStart(2, "0")}
              </td>
              <td className="px-4 py-2 text-ledger-card/70">
                {p.daysAway === 0 ? "Today" : p.daysAway === 1 ? "Tomorrow" : `${p.daysAway}d`}
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <button
                  onClick={() => setEditingId(p.id)}
                  disabled={!p.id}
                  className="text-xs text-amber-soft hover:underline mr-3 disabled:opacity-30 disabled:no-underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={!p.id || deletingId === p.id}
                  className="text-xs text-rose hover:underline disabled:opacity-30 disabled:no-underline"
                >
                  {deletingId === p.id ? "Removing…" : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
