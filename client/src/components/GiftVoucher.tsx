import { useState } from "react";
import { api } from "../lib/api";

/**
 * "Give a board as a gift" — a voucher request that lands in admin. Card payment online
 * isn't live yet (no Stripe), so we're honest: the owner arranges payment and sends the
 * voucher. Upgrades to instant self-serve gift cards when Stripe lands.
 */
export function GiftVoucher() {
  const [amount, setAmount] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail);
  const amountOk = parseFloat(amount) > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountOk) return setError("Enter a gift amount.");
    if (!buyerName.trim()) return setError("Please add your name.");
    if (!emailOk) return setError("Please enter a valid email.");
    setError(null);
    setStatus("sending");
    try {
      await api.requestGiftVoucher({
        amount: parseFloat(amount),
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        recipientName: recipientName.trim() || undefined,
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
      <section className="gift-section card is-done" data-reveal>
        <span className="rc-tick" aria-hidden="true">✓</span>
        <p>Lovely — that&apos;s with us. We&apos;ll be in touch to sort payment and get the voucher out to you.</p>
      </section>
    );
  }

  return (
    <section className="gift-section card" data-reveal>
      <h2 className="section-h">Give a board as a gift</h2>
      <p className="muted gift-intro">
        Perfect for a birthday, a thank you, or a new-baby drop-off. Tell us the amount and who it&apos;s for —
        we&apos;ll set the voucher up and confirm with you directly. (Instant online gift cards are coming soon.)
      </p>
      <form className="gift-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="gv-amount">Gift amount (£)</label>
          <input id="gv-amount" className="input" type="number" min={1} step={5} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 40" />
        </div>
        <div className="field">
          <label htmlFor="gv-name">Your name</label>
          <input id="gv-name" className="input" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Who's it from?" />
        </div>
        <div className="field">
          <label htmlFor="gv-email">Your email</label>
          <input id="gv-email" className="input" type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="you@email.com" />
        </div>
        <div className="field">
          <label htmlFor="gv-recipient">Who&apos;s it for? (optional)</label>
          <input id="gv-recipient" className="input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient's name" />
        </div>
        <div className="field">
          <label htmlFor="gv-message">Message on the voucher (optional)</label>
          <textarea id="gv-message" className="input" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="A short note to print with it." />
        </div>
        <button className="btn" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Request a gift voucher"}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </section>
  );
}
