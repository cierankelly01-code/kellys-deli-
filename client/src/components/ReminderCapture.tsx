import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trackShoppingEvent } from "../lib/consent";
const OCCASIONS = ["A birthday", "Mother's Day", "Father's Day", "Christmas", "An anniversary", "Something else"];

export function ReminderCapture() {
  const [channels, setChannels] = useState({ email: false, sms: false });
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [date, setDate] = useState("");
  const [daysBefore, setDaysBefore] = useState(14);
  const [emailConsent, setEmailConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [cancelPath, setCancelPath] = useState("");
  useEffect(() => {
    fetch("/api/occasion-reminders/status").then((r) => r.ok ? r.json() : null).then((v) => { if (v) setChannels(v); }).catch(() => {});
  }, []);
  if (!channels.email && !channels.sms) return null;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setStatus("sending"); setError("");
    try {
      const r = await fetch("/api/occasion-reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), phone: phone.trim(), occasion, reminderDate: date, daysBefore, emailConsent, smsConsent }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save your reminder. Please try again.");
      setCancelPath(data.cancelPath || ""); setStatus("done"); trackShoppingEvent("occasion_reminder_signup");
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); setStatus("idle"); }
  }
  if (status === "done") return <section className="reminder-capture" role="status"><h2>You bring the occasion. We’ll bring the reminder.</h2><p>Your request is saved. We’ll send one reminder per selected channel before this date.</p>{cancelPath && <a href={cancelPath}>Cancel this reminder</a>}</section>;
  return <section className="reminder-capture deli-reminder">
    <div><p className="deli-eyebrow">The dates worth remembering</p><h2>Something to celebrate?</h2><p>Get a little nudge to plan the food before a birthday, anniversary or special gathering.</p></div>
    <form onSubmit={submit}>
      <div className="deli-reminder-fields">
        <label>Occasion<select className="input" value={occasion} onChange={(e) => setOccasion(e.target.value)}>{OCCASIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label>Upcoming date<input className="input" required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Remind me<select className="input" value={daysBefore} onChange={(e) => setDaysBefore(Number(e.target.value))}><option value={7}>1 week before</option><option value={14}>2 weeks before</option><option value={30}>30 days before</option></select></label>
      </div>
      {channels.email && <><label className="deli-check"><input type="checkbox" checked={emailConsent} onChange={(e) => setEmailConsent(e.target.checked)} /> Email me a reminder about this occasion and Kelly’s food.</label>{emailConsent && <label>Your email<input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>}</>}
      {channels.sms && <><label className="deli-check"><input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} /> Text me a reminder about this occasion and Kelly’s food.</label>{smsConsent && <label>Your mobile, including country code<input className="input" type="tel" autoComplete="tel" placeholder="+447700900123" required value={phone} onChange={(e) => setPhone(e.target.value)} /></label>}</>}
      <p className="muted">One reminder per chosen channel for this date. Cancel using the link in your reminder. <Link to="/privacy">Privacy policy</Link></p>
      {error && <p role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={status === "sending"}>{status === "sending" ? "Saving…" : "Remember my occasion"}</button>
    </form>
  </section>;
}
