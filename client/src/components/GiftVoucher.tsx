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
      setError(err instanceof Error ? err.message : "Couldn't send that. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <section className="gift-section is-done" id="gift-vouchers" aria-labelledby="gift-h">
        <div className="wrap gift-done">
          <h2 id="gift-h" className="gift-done-h">Thanks, that&apos;s with us.</h2>
          <p>We&apos;ll be in touch to sort out payment and send the voucher to you.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="gift-section" id="gift-vouchers" aria-labelledby="gift-h">
      <div className="wrap gift-layout">
        <div className="gift-copy">
          <h2 id="gift-h" className="gift-h">Give a board as a gift</h2>
          <p className="gift-intro">
            For a birthday, a thank you or a new-baby drop-off. Tell us the amount and who it&apos;s for, and
            we&apos;ll set up the voucher and confirm it with you.
          </p>
          <ol className="gift-steps">
            <li>Choose an amount and add a message.</li>
            <li>We confirm with you and arrange payment.</li>
            <li>The voucher goes out, ready to give.</li>
          </ol>
          <p className="gift-note">You can&apos;t buy a gift card online yet. This form starts the order.</p>
        </div>
        <form className="gift-form" onSubmit={submit} noValidate>
          <div className="gift-row">
            <div className="field gift-amount">
              <label htmlFor="gv-amount">Gift amount (£)</label>
              <input id="gv-amount" className="input" type="number" inputMode="decimal" min={1} step={5} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 40" />
            </div>
            <div className="field">
              <label htmlFor="gv-recipient">Who&apos;s it for? (optional)</label>
              <input id="gv-recipient" className="input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient's name" />
            </div>
          </div>
          <div className="gift-row">
            <div className="field">
              <label htmlFor="gv-name">Your name</label>
              <input id="gv-name" className="input" autoComplete="name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Who's it from?" />
            </div>
            <div className="field">
              <label htmlFor="gv-email">Your email</label>
              <input id="gv-email" className="input" type="email" autoComplete="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="you@email.com" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="gv-message">Message on the voucher (optional)</label>
            <textarea id="gv-message" className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="A short note to print with it." />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Request a gift voucher"}</button>
        </form>
      </div>
    </section>
  );
}
