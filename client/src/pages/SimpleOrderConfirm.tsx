import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, type SimpleOrderView } from "../lib/api";
import { gbp, formatDateLong } from "../lib/format";
import { Header } from "../components/Header";
import { usePageTitle } from "../lib/title";

/**
 * Order page for bread (KDB-) and deli counter (KDS-) orders, which are paid in full on
 * Stripe. Stripe sends the customer back here; it also lets them pay if they closed
 * Stripe's page. Board orders (KD-) have their own page (Confirm.tsx).
 */
export default function SimpleOrderConfirm() {
  const { ref } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState<SimpleOrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const backFromStripe = params.get("paid") === "1";
  const cancelledAtStripe = params.get("cancelled") === "1";
  usePageTitle("Your order");

  useEffect(() => {
    if (!ref) return;
    api.getSimpleOrder(ref).then(setOrder).catch((e) => setError(e.message));
  }, [ref]);

  // Back from Stripe: the webhook usually lands within a second or two.
  useEffect(() => {
    if (!ref || !backFromStripe || !order || order.paymentStatus !== "pending") return;
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      api.getSimpleOrder(ref).then((o) => { setOrder(o); if (o.paymentStatus !== "pending") clearInterval(t); }).catch(() => {});
      if (tries >= 10) { clearInterval(t); setTimedOut(true); }
    }, 2000);
    return () => clearInterval(t);
  }, [ref, backFromStripe, order?.paymentStatus]);

  async function pay() {
    if (!ref) return;
    setPaying(true);
    setPayError(null);
    try {
      const { checkoutUrl } = await api.simpleCheckout(ref);
      if (checkoutUrl?.startsWith("https://checkout.stripe.com/")) window.location.assign(checkoutUrl);
      else setPayError("Online payment isn't available right now — you can pay when you collect.");
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
        <Link className="btn btn-secondary" to="/">Back to the shop</Link>
      </div>
    );
  }
  if (!order) return <div className="app"><Header /><p className="muted center">Loading your order…</p></div>;

  const paid = order.paymentStatus === "paid";
  const booked = order.status !== "cancelled" && (paid || order.paymentStatus === "none");
  const holdEnds = order.holdEndsAt ? new Date(order.holdEndsAt) : null;
  const holdTime = holdEnds && holdEnds.getTime() > Date.now()
    ? holdEnds.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
    : null;

  return (
    <div className="app">
      <Header />
      <div className="confirm-hero center">
        {booked && <div className="tick">✓</div>}
        {paid ? (
          <>
            <h1>Paid — you&apos;re booked in!</h1>
            <p className="confirm-copy">Thanks {order.customerName}. Your order&apos;s paid in full, so just collect it.</p>
          </>
        ) : order.paymentStatus === "refunded" ? (
          <>
            <h1>Your order has been refunded</h1>
            <p className="confirm-copy">
              We&apos;ve refunded {gbp(order.total)} for order {order.ref}. It can take 5 to 10 working days to show on your statement, depending on your bank.
              Questions? Email hello@kellysdeli.co.uk.
            </p>
          </>
        ) : order.status === "cancelled" ? (
          <>
            <h1>This order wasn&apos;t booked</h1>
            <p className="confirm-copy">
              Order {order.ref} has been cancelled. If it wasn&apos;t paid in time, you&apos;re welcome to order again.
              Questions? Email hello@kellysdeli.co.uk.
            </p>
            <Link className="btn" to={order.kind === "bread" ? "/bread" : "/groceries"}>Order again</Link>
          </>
        ) : backFromStripe && order.paymentStatus === "pending" ? (
          <>
            <h1>{timedOut ? "We're still confirming your payment" : "Payment received — confirming…"}</h1>
            <p className="confirm-copy" role="status">
              {timedOut
                ? `This is taking longer than usual. Please don't pay again — we'll email you once it's confirmed. Questions? Email hello@kellysdeli.co.uk quoting ${order.ref}.`
                : "Thanks — we're just confirming your payment with Stripe. This page updates by itself in a few seconds."}
            </p>
          </>
        ) : order.canPayOnline ? (
          <>
            <h1>{cancelledAtStripe ? "Your order isn't booked yet" : "Nearly there: pay for your order"}</h1>
            <p className="confirm-copy">
              Your order is confirmed once it&apos;s paid.{holdTime && ` We're holding it for you until ${holdTime}.`}
            </p>
            {cancelledAtStripe && <p className="notice warn">Your payment wasn&apos;t completed. You can try again below.</p>}
            <button className="btn" onClick={pay} disabled={paying}>
              {paying ? "Opening secure payment…" : `Pay ${gbp(order.total)}`}
            </button>
            <p className="muted small">Card payment by Stripe. We never see your card details.</p>
            {payError && <p className="notice danger" role="alert">{payError}</p>}
          </>
        ) : order.paymentStatus === "none" ? (
          <>
            <h1>You&apos;re booked in!</h1>
            <p className="confirm-copy">Pay when you collect — we&apos;ll be in touch if anything changes.</p>
          </>
        ) : (
          <>
            <h1>We&apos;re still waiting on your payment</h1>
            <p className="confirm-copy">
              This order can&apos;t be paid online right now. Email hello@kellysdeli.co.uk quoting {order.ref} and we&apos;ll sort it out.
            </p>
          </>
        )}
        <p className="confirm-collection">
          Collection <strong>{formatDateLong(order.collectionDate)}</strong> — {order.locationName}
        </p>
        <div className="ref-badge">Order reference<strong>{order.ref}</strong></div>
      </div>

      <div className="card review">
        {order.items.map((i) => (
          <div key={i.id} className="review-row"><span>{i.quantity}× {i.name}</span><span>{gbp(i.lineTotal)}</span></div>
        ))}
        <hr />
        <div className="review-row">
          <span className="muted">{paid ? "Paid" : "Total"}</span>
          <span style={{ fontWeight: 700 }}>{gbp(order.total)}</span>
        </div>
      </div>
      <Link className="btn btn-secondary" to="/">Back to the shop</Link>
    </div>
  );
}
