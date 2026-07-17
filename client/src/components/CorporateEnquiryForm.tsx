import { useState } from "react";
import { api } from "../lib/api";

const FREQUENCIES = [
  { value: "one-off", label: "One-off / a single meeting" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Every two weeks" },
  { value: "monthly", label: "Monthly" },
] as const;

/**
 * Corporate / office enquiry form. Lands in admin (Enquiries). We DON'T promise next-day
 * delivery unless the owner has switched it on — the copy says we'll confirm the schedule.
 */
export function CorporateEnquiryForm({ nextDayConfirmed = false }: { nextDayConfirmed?: boolean }) {
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [frequency, setFrequency] = useState<string>("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const valid = company.trim() && contactName.trim() && emailOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError("Please add your company, name and a valid email.");
      return;
    }
    setError(null);
    setStatus("sending");
    try {
      await api.corporateEnquiry({
        company: company.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        headcount: headcount ? Math.max(1, parseInt(headcount, 10)) : undefined,
        frequency: (frequency || undefined) as never,
        message: message.trim() || undefined,
      });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that — please try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="corp-form card corp-done">
        <div className="corp-tick" aria-hidden="true">✓</div>
        <h3>Thanks — that's with us.</h3>
        <p className="muted">
          We&apos;ll be in touch to talk through your numbers and set up a schedule that works for your office.
        </p>
      </div>
    );
  }

  return (
    <form className="corp-form card" onSubmit={submit}>
      <h3 className="corp-h">Set up office catering</h3>
      <p className="muted corp-sub">
        Tell us a little about your office and how often you&apos;d like feeding.
        {nextDayConfirmed
          ? " We deliver regular office orders the next working day."
          : " Delivery is available for regular office orders — we'll confirm your schedule with you."}
      </p>

      <label className="field"><span>Company *</span><input value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" /></label>
      <label className="field"><span>Your name *</span><input value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="name" /></label>
      <div className="corp-row">
        <label className="field"><span>Email *</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="field"><span>Phone</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
      </div>
      <div className="corp-row">
        <label className="field"><span>Roughly how many people?</span><input type="number" min={1} value={headcount} onChange={(e) => setHeadcount(e.target.value)} /></label>
        <label className="field">
          <span>How often?</span>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="">—</option>
            {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
      </div>
      <label className="field"><span>Anything else? (dietary needs, delivery address, timings)</span><textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></label>

      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn" disabled={status === "sending"} type="submit">
        {status === "sending" ? "Sending…" : "Send enquiry"}
      </button>
      <p className="muted corp-foot">We&apos;ll never share your details. This just starts a conversation — nothing&apos;s booked yet.</p>
    </form>
  );
}
