import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type OrderDTO } from "../lib/api";
import { gbp, formatDateLong } from "../lib/format";
import { Header } from "../components/Header";

function ReferralShare({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/order?referral=${code}`;
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
      <button className="btn" onClick={copy}>{copied ? "Copied!" : "Copy your share link"}</button>
    </div>
  );
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
        <p className="muted">We&apos;ve sent a confirmation to {order.phone} and {order.email}.</p>
        <div className="ref-badge">Order reference<strong>{order.ref}</strong></div>
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
