import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, type OrderDTO } from "../lib/api";
import { gbp, formatDateLong } from "../lib/format";
import { Header } from "../components/Header";
import { usePageTitle } from "../lib/title";
import SimpleOrderConfirm from "./SimpleOrderConfirm";

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
    `DESCRIPTION:${esc(`Order ${order.ref}.${order.balance > 0 ? " Balance due on collection." : ""}`)}`,
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

/** Bread (KDB-) and deli counter (KDS-) refs have their own page; boards (KD-) use this one. */
export default function Confirm() {
  const { ref } = useParams();
  return /^KD[BS]-/.test(ref ?? "") ? <SimpleOrderConfirm /> : <BoardConfirm />;
}

function BoardConfirm() {
  const { ref } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmTimedOut, setConfirmTimedOut] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const backFromStripe = params.get("paid") === "1";
  const cancelledAtStripe = params.get("cancelled") === "1";
  usePageTitle("Your order");

  useEffect(() => {
    if (!ref) return;
    api.getOrder(ref).then(setOrder).catch((e) => setError(e.message));
  }, [ref]);

  // Back from Stripe: the webhook usually lands within a second or two. Re-check a few
  // times rather than telling the customer "pending" for a payment they've just made.
  useEffect(() => {
    if (!ref || !backFromStripe || !order || order.depositStatus !== "pending") return;
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      api.getOrder(ref).then((o) => { setOrder(o); if (o.depositStatus !== "pending") clearInterval(t); }).catch(() => {});
      if (tries >= 10) { clearInterval(t); setConfirmTimedOut(true); }
    }, 2000);
    return () => clearInterval(t);
  }, [ref, backFromStripe, order?.depositStatus]);

  async function payDeposit() {
    if (!ref) return;
    setPaying(true);
    setPayError(null);
    try {
      const { checkoutUrl } = await api.depositCheckout(ref);
      if (checkoutUrl && /^https:\/\/checkout\.stripe\.com\//.test(checkoutUrl)) window.location.assign(checkoutUrl);
      else setPayError("Online payment isn't available right now — we'll be in touch about payment.");
    } catch (e: any) {
      setPayError(e?.message || "We couldn't open the payment page. Please try again.");
    } finally {
      setPaying(false);
    }
  }

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

  // Waiting on an online deposit (or just back from Stripe, not yet confirmed): nothing on
  // the page may read as booked — no tick, calendar, freebie or referral until it's paid.
  const showBooked = order.status !== "cancelled" && !(order.depositStatus === "pending" && (order.canPayOnline || backFromStripe));
  // Orders placed from 29 Oct 2026 are paid in full (no balance); older ones kept their 25% deposit.
  const inFull = order.balance === 0;
  const holdEnds = order.holdEndsAt ? new Date(order.holdEndsAt) : null;
  const holdTime = holdEnds && holdEnds.getTime() > Date.now()
    ? holdEnds.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
    : null;

  return (
    <div className="app">
      <Header />
      <div className="confirm-hero center">
        {showBooked && <div className="tick">✓</div>}
        {order.depositStatus === "paid" ? (
          <>
            <h1>{inFull ? "Paid — you're booked in!" : "Deposit paid — you're booked in!"}</h1>
            <p className="confirm-copy">
              {inFull
                ? `Thanks — your order's paid in full and your date is confirmed. Just collect it on the day.`
                : `Thanks — we've got your ${gbp(order.deposit)} deposit and your date is confirmed. The balance of ${gbp(order.balance)} is payable on collection.`}
            </p>
          </>
        ) : order.depositStatus === "refunded" ? (
          <>
            <h1>{inFull ? "Your payment has been refunded" : "Your deposit has been refunded"}</h1>
            <p className="confirm-copy">
              We&apos;ve refunded {gbp(order.deposit)} for order {order.ref}. It can take 5 to 10 working days to show on your statement, depending on
              your bank. Questions? Email hello@kellysdeli.co.uk.
            </p>
          </>
        ) : backFromStripe ? (
          <>
            <h1>{confirmTimedOut ? "We're still confirming your payment" : "Payment received — confirming…"}</h1>
            <p className="confirm-copy" role="status">
              {confirmTimedOut
                ? `This is taking longer than usual. Please don't pay again — we'll email you as soon as it's confirmed. Questions? Email hello@kellysdeli.co.uk quoting ${order.ref}.`
                : "Thanks — we're just confirming your payment with Stripe. This page updates by itself in a few seconds."}
            </p>
          </>
        ) : order.status === "cancelled" ? (
          <>
            <h1>This order wasn&apos;t booked</h1>
            <p className="confirm-copy">
              Order {order.ref} has been cancelled, so we&apos;re not holding a date for it. If it wasn&apos;t paid
              in time, you&apos;re welcome to order again. Questions? Email hello@kellysdeli.co.uk.
            </p>
            <Link className="btn" to="/">Order again</Link>
          </>
        ) : order.canPayOnline ? (
          <>
            <h1>{cancelledAtStripe ? "Your date isn't booked yet" : inFull ? "Nearly there: pay for your order" : "Nearly there: pay your deposit"}</h1>
            <p className="confirm-copy">
              {inFull ? "Your date is confirmed once your order is paid." : "Your date is confirmed once the deposit is paid. The balance is payable on collection."}
              {holdTime && ` We're holding it for you until ${holdTime}.`}
            </p>
            {cancelledAtStripe && <p className="notice warn">Your payment wasn&apos;t completed. You can try again below.</p>}
            <button className="btn" onClick={payDeposit} disabled={paying}>
              {paying ? "Opening secure payment…" : inFull ? `Pay ${gbp(order.deposit)}` : `Pay ${gbp(order.deposit)} deposit`}
            </button>
            <p className="muted small">Card payment by Stripe. We never see your card details.</p>
            {payError && <p className="notice danger" role="alert">{payError}</p>}
          </>
        ) : (
          <>
            <h1>Your order request is in!</h1>
            <p className="confirm-copy">
              {inFull
                ? "Thanks — your order request is in. We'll be in touch about payment to confirm your order."
                : "Thanks — your order request is in. We'll be in touch to take a 25% deposit to confirm your order. The balance is payable on collection."}
            </p>
          </>
        )}
        <div className="ref-badge">Order reference<strong>{order.ref}</strong></div>
        <p className="muted save-hint">Screenshot or bookmark this page — your order lives at this link.</p>
        {showBooked && (
          <button className="btn btn-secondary cal-btn" onClick={() => downloadIcs(order)}>
            Add collection to my calendar
          </button>
        )}
      </div>

      {showBooked && order.freebie && (
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
          <span className="muted">{inFull ? "Payment" : "Deposit due (25%)"}</span>
          <span style={{ fontWeight: 700 }}>{gbp(order.deposit)} <span className={`pill ${order.depositStatus === "paid" ? "good" : "warn"}`}>{order.depositStatus}</span></span>
        </div>
        {!inFull && <div className="review-row"><span className="muted">Balance on collection</span><span>{gbp(order.balance)}</span></div>}
      </div>

      {showBooked && order.customerReferralCode && <ReferralShare code={order.customerReferralCode} />}

      <p className="muted center footnote">
        {inFull ? "Fully refundable if you cancel 48 hours or more before collection." : "Deposits are fully refundable up to 48 hours before collection."}{" "}
        Need to change something? Quote your reference {order.ref}.
      </p>
      <Link className="btn btn-secondary" to="/">Back to menu</Link>
    </div>
  );
}
