import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type OrderDTO } from "../lib/api";
import { gbp, formatDateLong } from "../lib/format";
import { Header } from "../components/Header";
import { usePageTitle } from "../lib/title";

function ReferralShare({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/order?referral=${code}`;
  const message = `Kelly's Deli do proper grazing boards — order with my link and we both get £15 off: ${link}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "£15 off at Kelly's Deli", text: message });
        return;
      } catch {
        /* dismissed — fall through to copy */
      }
    }
    copy();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className="card referral-card">
      <h3 style={{ marginTop: 0 }}>Know an office that needs lunch?</h3>
      <p className="muted">Share your link — you both get £15 off your next order.</p>
      <div className="referral-code">{code}</div>
      <div className="share-row">
        <a className="btn whatsapp-btn" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
          Share on WhatsApp
        </a>
        <button className="btn btn-secondary" onClick={share}>{copied ? "Copied!" : "Copy link"}</button>
      </div>
    </div>
  );
}

/** Build a one-day calendar event for the collection date — no libraries needed. */
function downloadIcs(order: OrderDTO): void {
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1");
  const day = order.collectionOrDeliveryDate.replace(/-/g, "");
  const [y, m, d] = order.collectionOrDeliveryDate.split("-").map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const name = order.platterName ?? "Order";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kelly's Deli//Orders//EN", "BEGIN:VEVENT",
    `UID:${order.ref}@kellysdeli`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${nextDay}`,
    `SUMMARY:${esc(`Kelly's Deli — ${name} collection`)}`,
    `DESCRIPTION:${esc(`Order ${order.ref}. Balance due on collection.`)}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kellys-deli-${order.ref}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Confirm() {
  const { ref } = useParams();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  usePageTitle("Order confirmed");

  useEffect(() => {
    if (!ref) return;
    api.getOrder(ref).then(setOrder).catch((e) => setError(e.message));
  }, [ref]);

  if (error) {
    return (
      <div className="app">
        <Header />
        <div className="notice danger">We couldn&apos;t find that order ({error}).</div>
        <Link className="btn btn-secondary" to="/">Back to menu</Link>
      </div>
    );
  }
  if (!order) {
    return <div className="app"><Header /><p className="muted center">Loading your order…</p></div>;
  }

  // v2 orders itemise boards + add-ons; fall back to the primary board for legacy rows.
  const boardItems = order.items.length > 0
    ? order.items
    : order.platterName
      ? [{ id: "primary", platterId: order.platterId ?? "", platterName: order.platterName, quantity: order.quantity ?? 1, unitPrice: 0, lineTotal: 0 }]
      : [];

  return (
    <div className="app">
      <Header />
      <div className="confirm-hero center">
        <div className="tick">✓</div>
        <h1>Your order request is in!</h1>
        <p className="confirm-copy">
          Thanks — your order request is in. We&apos;ll contact you shortly with a secure payment link for a 25% deposit
          to confirm your order. The balance is payable on collection.
        </p>
        <div className="ref-badge">Order reference<strong>{order.ref}</strong></div>
        <p className="muted save-hint">Screenshot or bookmark this page — your order lives at this link.</p>
        <button className="btn btn-secondary cal-btn" onClick={() => downloadIcs(order)}>
          Add collection to my calendar
        </button>
      </div>

      {order.freebie && (
        <div className="notice good">🎁 First-order treat: <strong>{order.freebie}</strong> — on the house!</div>
      )}

      <div className="card review">
        {boardItems.map((it) => (
          <div key={it.id} className="review-row"><span>{it.quantity}× {it.platterName}</span>{it.lineTotal ? <span>{gbp(it.lineTotal)}</span> : <span />}</div>
        ))}
        {order.addOns.map((a) => (
          <div key={a.id} className="review-row muted"><span>{a.quantity}× {a.name}</span><span>{gbp(a.lineTotal)}</span></div>
        ))}
        <div className="review-row"><span className="muted">For</span><span>{order.headcount} people</span></div>
        {order.occasion && <div className="review-row"><span className="muted">Occasion</span><span>{order.occasion}</span></div>}
        <div className="review-row"><span className="muted">Collection</span><span>{formatDateLong(order.collectionOrDeliveryDate)}</span></div>
        <div className="review-row"><span className="muted">From</span><span>{order.locationName}</span></div>
        <hr />
        <div className="review-row"><span className="muted">Total</span><span style={{ fontWeight: 700 }}>{gbp(order.total)}</span></div>
        <div className="review-row accent">
          <span className="muted">Deposit due (25%)</span>
          <span style={{ fontWeight: 700 }}>{gbp(order.deposit)} <span className="pill warn">{order.depositStatus}</span></span>
        </div>
        <div className="review-row"><span className="muted">Balance on collection</span><span>{gbp(order.balance)}</span></div>
      </div>

      {order.customerReferralCode && <ReferralShare code={order.customerReferralCode} />}

      <p className="muted center footnote">
        Deposits are fully refundable up to 48 hours before collection. Need to change something? Quote your reference {order.ref}.
      </p>
      <Link className="btn btn-secondary" to="/">Back to menu</Link>
    </div>
  );
}
