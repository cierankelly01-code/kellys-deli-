import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type OrderDTO } from "../lib/api";
import { gbp, formatDateLong } from "../lib/format";
import { Header } from "../components/Header";

function ReferralShare({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/order?referral=${code}`;
  const message = `Kelly's Deli do proper grazing boards — order with my link and we both get £15 off: ${link}`;

  async function share() {
    // Native share sheet where available (most phones); the customer picks WhatsApp/SMS/etc.
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
        <a
          className="btn whatsapp-btn"
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
        >
          Share on WhatsApp
        </a>
        <button className="btn btn-secondary" onClick={share}>{copied ? "Copied!" : "Copy link"}</button>
      </div>
    </div>
  );
}

/** Build a one-day calendar event for the delivery/collection date — no libraries needed. */
function downloadIcs(order: OrderDTO, label: string): void {
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1");
  const day = order.collectionOrDeliveryDate.replace(/-/g, "");
  const [y, m, d] = order.collectionOrDeliveryDate.split("-").map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const name = order.platterName ?? order.experienceName ?? "Order";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kelly's Deli//Orders//EN",
    "BEGIN:VEVENT",
    `UID:${order.ref}@kellysdeli`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${nextDay}`,
    `SUMMARY:${esc(`Kelly's Deli — ${name} ${label.toLowerCase()}`)}`,
    `DESCRIPTION:${esc(`Order ${order.ref}. Balance due on ${label.toLowerCase()}.`)}`,
    ...(order.deliveryAddress ? [`LOCATION:${esc(order.deliveryAddress)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
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

  useEffect(() => {
    if (!ref) return;
    api
      .getOrder(ref)
      .then(setOrder)
      .catch((e) => setError(e.message));
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
    return (
      <div className="app">
        <Header />
        <p className="muted center">Loading your order…</p>
      </div>
    );
  }

  const isExperience = order.type === "experience";
  const isGift = order.isGift;
  const isBoard = order.quantity != null; // board configurator orders always set quantity
  const lineName = isExperience ? order.experienceName : order.platterName;
  const dateLabel = isExperience ? "Date" : isGift ? "Delivery" : "Collection";

  return (
    <div className="app">
      <Header />
      <div className="confirm-hero center">
        <div className="tick">✓</div>
        <h1>{isBoard ? "Order on its way!" : isExperience ? "You're booked in!" : isGift ? "Gift on its way!" : "You're booked in!"}</h1>
        <p className="muted">Your order is in — we&apos;ll be in touch on {order.phone} or {order.email} to confirm.</p>
        <div className="ref-badge">Order reference<strong>{order.ref}</strong></div>
        <p className="muted save-hint">Screenshot or bookmark this page — your order lives at this link.</p>
        <button className="btn btn-secondary cal-btn" onClick={() => downloadIcs(order, dateLabel)}>
          Add {dateLabel.toLowerCase()} to my calendar
        </button>
      </div>

      {order.freebie && (
        <div className="notice good">🎁 First-order treat: <strong>{order.freebie}</strong> — on the house!</div>
      )}

      <div className="card review">
        <div className="review-row"><span className="muted">{isExperience ? "Experience" : isBoard ? "Board" : "Platter"}</span><span>{lineName}</span></div>
        <div className="review-row"><span className="muted">{isBoard ? "Boards" : "For"}</span><span>{isBoard ? order.quantity : order.headcount}{!isBoard && ` ${isExperience ? "guests" : "people"}`}</span></div>
        {isBoard && order.customItems && order.customItems.length > 0 && (
          <div className="review-row"><span className="muted">Your selection</span><span>{order.customItems.join(", ")}</span></div>
        )}
        <div className="review-row"><span className="muted">{dateLabel}</span><span>{formatDateLong(order.collectionOrDeliveryDate)}</span></div>
        {!isBoard && <div className="review-row"><span className="muted">{isGift ? "From shop" : "Location"}</span><span>{order.locationName}</span></div>}
        {isGift && <div className="review-row"><span className="muted">{isBoard ? "Deliver to" : "Send to"}</span><span>{order.recipientName}</span></div>}
        {isGift && order.deliveryAddress && <div className="review-row"><span className="muted">Address</span><span>{order.deliveryAddress}</span></div>}
        {isGift && order.giftMessage && <div className="review-row"><span className="muted">Message</span><span>{order.giftMessage}</span></div>}
        <hr />
        <div className="review-row"><span className="muted">Total</span><span style={{ fontWeight: 700 }}>{gbp(order.total)}</span></div>
        <div className="review-row accent">
          <span className="muted">Deposit</span>
          <span style={{ fontWeight: 700 }}>{gbp(order.deposit)} <span className="pill warn">{order.depositStatus}</span></span>
        </div>
      </div>

      {order.customerReferralCode && <ReferralShare code={order.customerReferralCode} />}

      <p className="muted center footnote">
        Balance due on {isExperience ? "the day" : isGift ? "delivery" : "collection"}. Need to change something? Quote your reference {order.ref}.
      </p>
      <Link className="btn btn-secondary" to="/">Back to menu</Link>
    </div>
  );
}
