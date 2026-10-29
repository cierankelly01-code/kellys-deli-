// Payments module boundary. This is the ONLY place the app talks to a payment provider.
//
// Board/platter deposits (25%) are taken on Stripe Checkout — Stripe's own hosted payment
// page — so card details never touch this server. With no STRIPE_SECRET_KEY set, every
// function here returns a safe stub and the site works exactly as before ("we'll be in
// touch to take your deposit"). Setting STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET turns
// it on. See docs/STRIPE.md.
//
// The deposit amount is always computed server-side (money.ts) and passed in here; the
// browser never supplies a price.
import Stripe from "stripe";
import { env, stripeEnabled } from "./env";

let client: Stripe | null = null;
let clientKey = "";

/** Lazily-built Stripe client (rebuilt if the key changes). */
function stripe(): Stripe {
  if (!client || clientKey !== env.stripeSecretKey) {
    // Short: this runs inside POST /orders, after the order is saved. A slow Stripe should
    // fall back to "pay from your order page", not hold the customer up for 45 seconds.
    client = new Stripe(env.stripeSecretKey, { maxNetworkRetries: 1, timeout: 8_000 });
    clientKey = env.stripeSecretKey;
  }
  return client;
}

/** Tests only: swap in a fake Stripe client. Pass null to restore the real one. */
export function __setStripeClientForTests(fake: unknown): void {
  client = fake as Stripe | null;
  clientKey = fake ? env.stripeSecretKey : "";
}

export const toPence = (gbp: number): number => Math.round(gbp * 100);

export interface DepositCheckout {
  provider: "stripe" | "stub";
  /** Stripe Checkout Session id (cs_…), or a stub id. Stored on the order. */
  sessionId: string;
  /** Where to send the customer to pay. null = no online payment (stub). */
  url: string | null;
  /** true = an existing open session was handed back, not a new one. */
  reused?: boolean;
}

export interface DepositCheckoutInput {
  orderRef: string;
  /** Deposit in pounds, from the server's own pricing. */
  amount: number;
  /** e.g. "Bentley Heath, Sat 14 Nov" — shown on Stripe's page. */
  summary?: string;
  /** Absolute site URL, e.g. https://www.kellysdeli.co.uk */
  siteUrl: string;
  /** The Checkout Session already on the order, if any (cs_…). Reused while still open. */
  existingSessionId?: string | null;
}

/** Thrown when the order's existing Checkout Session has already been paid. */
export class DepositAlreadyPaidError extends Error {}

// Stripe's minimum lifetime is 30 minutes; a little over avoids a clock-skew rejection.
const SESSION_LIFETIME_S = 31 * 60;

/**
 * Start (or resume) a Stripe Checkout Session for an order's deposit. Stub (no URL) when
 * Stripe isn't configured, so ordering never depends on Stripe being set up.
 *
 * One order has at most one payable session at a time: if the order's last session is
 * still open, its URL is returned instead of creating a second one — two live sessions
 * for one order is how a customer gets charged twice.
 */
export async function createDepositCheckout(input: DepositCheckoutInput): Promise<DepositCheckout> {
  if (!stripeEnabled()) {
    console.log(`[payments:stub] deposit £${input.amount.toFixed(2)} for ${input.orderRef} — Stripe not configured`);
    return { provider: "stub", sessionId: `stub_${input.orderRef}`, url: null };
  }
  if (input.existingSessionId?.startsWith("cs_")) {
    let prev: Stripe.Checkout.Session | null = null;
    try {
      prev = await stripe().checkout.sessions.retrieve(input.existingSessionId);
    } catch (e) {
      // A session Stripe doesn't know (made in test mode before switching to live keys,
      // or another account) must not block paying forever: start a fresh one instead.
      if (!(e instanceof Stripe.errors.StripeInvalidRequestError)) throw e;
    }
    if (prev?.status === "open" && prev.url) return { provider: "stripe", sessionId: prev.id, url: prev.url, reused: true };
    if (prev?.status === "complete") throw new DepositAlreadyPaidError(input.orderRef);
    // "expired", unknown, or no URL: fall through and start a fresh one.
  }
  const ref = encodeURIComponent(input.orderRef);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    // Card only (Apple Pay / Google Pay ride on card): a delayed method like Bacs would
    // "complete" Checkout unpaid, and the site promises the deposit is taken by card.
    allowed_payment_method_types: ["card"],
    expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_S,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: toPence(input.amount),
          product_data: {
            name: `Kelly's Deli order ${input.orderRef}`,
            ...(input.summary ? { description: input.summary } : {}),
          },
        },
      },
    ],
    client_reference_id: input.orderRef,
    metadata: { orderRef: input.orderRef, kind: "order" },
    payment_intent_data: { metadata: { orderRef: input.orderRef, kind: "order" } },
    // No customer_email: the order ref is a shareable link, and a Checkout page pre-filled
    // with the customer's full email would reveal it to anyone holding the ref (the public
    // order page deliberately masks it). Stripe asks for an email on its own page.
    success_url: `${input.siteUrl}/confirm/${ref}?paid=1`,
    cancel_url: `${input.siteUrl}/confirm/${ref}?cancelled=1`,
  });
  if (!session.url) throw new Error("Stripe returned a Checkout Session without a URL");
  return { provider: "stripe", sessionId: session.id, url: session.url, reused: false };
}

/**
 * Stripe's view of a Checkout Session: "open" (still payable), "complete" (paid, or about
 * to be: the webhook marks the order), "expired", or "unknown" (Stripe has no such session,
 * e.g. a test-mode one after switching to live keys; it can't be paid either). Network or
 * auth errors throw, so a caller never mistakes "couldn't ask" for "expired".
 */
export async function checkoutStatus(sessionId: string): Promise<"open" | "complete" | "expired" | "unknown"> {
  try {
    const s = await stripe().checkout.sessions.retrieve(sessionId);
    const st = s.status as string | null;
    return st === "open" || st === "complete" || st === "expired" ? st : "unknown";
  } catch (e) {
    if (e instanceof Stripe.errors.StripeInvalidRequestError && e.code === "resource_missing") return "unknown";
    throw e;
  }
}

/** Close a Checkout Session so it can't be paid (e.g. one that lost a race). Best effort. */
export async function expireCheckout(sessionId: string): Promise<void> {
  if (!stripeEnabled() || !sessionId.startsWith("cs_")) return;
  try {
    await stripe().checkout.sessions.expire(sessionId);
  } catch (e) {
    console.error(`[payments] could not expire ${sessionId}`, e instanceof Error ? e.message : e);
  }
}

export interface WebhookResult {
  handled: boolean;
  /** The order whose deposit Stripe says is now paid. */
  paidOrderRef?: string;
  /** Amount Stripe actually collected, in pence — checked against the order before marking paid. */
  amountPaidPence?: number;
  /** Payment intent id (pi_…) for the admin's records/refunds. */
  intentId?: string;
  /** The Checkout Session that was paid (cs_…). */
  sessionId?: string;
  /** The email the customer typed on Stripe's page (bread and deli counter orders may not have one). */
  customerEmail?: string;
  /** A payment intent that Stripe says has been fully refunded. */
  refundedIntentId?: string;
}

/** Live keys only accept live events; test keys only test events. */
const keyIsLive = () => env.stripeSecretKey.startsWith("sk_live_") || env.stripeSecretKey.startsWith("rk_live_");

/**
 * Verify + parse a Stripe webhook. Throws on a bad signature (the route answers 400).
 * Unverifiable or irrelevant events come back { handled: false } and change nothing.
 */
export function parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookResult {
  if (!stripeEnabled()) return { handled: false };
  if (!signature) throw new Error("Missing Stripe-Signature header");
  const event = stripe().webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  // A test-mode payment (card 4242…) must never count as a real deposit, and vice versa.
  if (event.livemode !== keyIsLive()) {
    console.error(`[payments:webhook] ignored ${event.livemode ? "live" : "test"}-mode event ${event.id}: keys are ${keyIsLive() ? "live" : "test"}`);
    return { handled: false };
  }

  if (event.type === "charge.refunded") {
    const c = event.data.object as Stripe.Charge;
    const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
    // Only a full refund flips the order; a partial one is the owner's call in admin.
    return c.refunded && pi ? { handled: true, refundedIntentId: pi } : { handled: false };
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Stripe.Checkout.Session;
    // A completed session can still be unpaid (e.g. a delayed bank method); only "paid" counts.
    if (s.payment_status !== "paid") return { handled: false };
    const ref = s.metadata?.orderRef ?? s.client_reference_id ?? undefined;
    // "deposit": sessions opened before orders were paid in full (29 Oct 2026).
    if (!ref || (s.metadata?.kind !== "order" && s.metadata?.kind !== "deposit")) return { handled: false };
    return {
      handled: true,
      paidOrderRef: ref,
      amountPaidPence: s.amount_total ?? undefined,
      intentId: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id,
      sessionId: s.id,
      customerEmail: s.customer_details?.email ?? undefined,
    };
  }
  return { handled: false };
}
