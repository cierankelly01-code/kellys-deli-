import { useState } from "react";
import { api } from "../lib/api";

const OCCASIONS = ["A birthday", "Mother's Day", "Father's Day", "Christmas", "An anniversary", "Something else"];

/**
 * "Never miss it" reminder capture — the customer leaves an email and we nudge them before
 * an occasion. Honest and light: it just captures interest (lands in admin), no account.
 */
export function ReminderCapture() {
  const [email, setEmail] = useState("");
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOk) {
      setError("Please enter a valid email.");
      return;
    }
    setError(null);
    setStatus("sending");
    try {
      await api.reminder({ email: email.trim(), occasion, reminderDate: date || undefined });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that — please try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="reminder-capture is-done">
        <span className="rc-tick" aria-hidden="true">✓</span>
        <p>Sorted — we&apos;ll give you a nudge in good time. No spam, just the one reminder.</p>
      </div>
    );
  }

  return (
    <form className="reminder-capture" onSubmit={submit}>
      <div className="rc-head">
        <h3 className="rc-h">Never miss the date</h3>
        <p className="muted">Leave your email and we&apos;ll remind you before the big one — birthdays, Mother&apos;s Day, Christmas.</p>
      </div>
      <div className="rc-fields">
        <select aria-label="Occasion" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
          {OCCASIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input type="date" aria-label="Date (optional)" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="email" placeholder="you@email.com" aria-label="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn" type="submit" disabled={status === "sending"}>{status === "sending" ? "…" : "Remind me"}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
