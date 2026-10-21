// Payments module boundary. This is the ONLY place the app talks to a payment provider.
//
// Live payments = Stripe Checkout (Stripe's hosted payment page: card, Apple Pay, Google
// Pay). Turned on by setting STRIPE_SECRET_KEY; with it unset every function here is a
// safe no-op and orders behave exactly as before (deposit "pending", arranged by phone).
//
// Talks to Stripe's REST API with fetch rather than the SDK — three endpoints don't
// justify a dependency, and the webhook signature check is a few lines of HMAC.
//
// Payment is confirmed two independent ways, so a missing webhook never strands an order:
//   1. The webhook (checkout.session.completed) — set STRIPE_WEBHOOK_SECRET.
//   2. The customer landing back on /confirm, which asks the server to look the session
//      up on Stripe (retrieveCheckoutSession). Works even with no webhook configured.
import crypto from "node:crypto";
import { env, stripeEnabled } from "./env";

const STRIPE_API = "https://api.stripe.com/v1";

export interface DepositIntent {
  provider: string; // "stripe" | "stub"
  intentId: string;
  amount: number;
  currency: "gbp";
  status: "pending" | "succeeded";
  clientSecret: string | null;
}

/**
 * Legacy stub kept for experience bookings, which still take their deposit in person.
 * Records a placeholder id so the order has something to reconcile against.
 */
export async function captureDepositIntent(amount: number, orderRef: string): Promise<DepositIntent> {
  return {
    provider: "stub",
    intentId: `stub_${orderRef}`,
    amount,
    currency: "gbp",
    status: "pending",
    clientSecret: null,
  };
}

/** Flatten a nested object into Stripe's form encoding: a[b][0][c]=v. */
export function stripeForm(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") out.push(...stripeForm(item as Record<string, unknown>, `${key}[${i}]`));
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      out.push(...stripeForm(v as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

async function stripeRequest<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: body ? stripeForm(body).join("&") : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`[stripe] ${method} ${path} -> ${res.status}: ${json.error?.message ?? "unknown error"}`);
  return json;
}

export interface CheckoutInput {
  orderRef: string;
  amount: number; // pounds, what's due now (deposit or full total)
  description: string; // shown on Stripe's page, e.g. "Deposit for order KD-ABC123"
  customerEmail: string;
  successUrl: string; // may contain {CHECKOUT_SESSION_ID}
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

/** Create a Stripe Checkout Session for an order. Returns null when Stripe isn't configured. */
export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession | null> {
  if (!stripeEnabled()) return null;
  const session = await stripeRequest<{ id: string; url: string }>("POST", "/checkout/sessions", {
    mode: "payment",
    client_reference_id: input.orderRef,
    customer_email: input.customerEmail,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { orderRef: input.orderRef },
    payment_intent_data: { metadata: { orderRef: input.orderRef }, description: input.description },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(input.amount * 100),
          product_data: { name: input.description },
        },
      },
    ],
  });
  return { id: session.id, url: session.url };
}

export interface SessionStatus {
  paid: boolean;
  orderRef: string | null;
  paymentIntentId: string | null;
  amountTotal: number | null; // pounds
}

/** Look a Checkout Session up on Stripe (the webhook-free confirmation path). */
export async function retrieveCheckoutSession(sessionId: string): Promise<SessionStatus | null> {
  if (!stripeEnabled()) return null;
  const s = await stripeRequest<{
    payment_status: string;
    metadata?: { orderRef?: string };
    client_reference_id?: string | null;
    payment_intent?: string | null;
    amount_total?: number | null;
  }>("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  return {
    paid: s.payment_status === "paid",
    orderRef: s.metadata?.orderRef ?? s.client_reference_id ?? null,
    paymentIntentId: s.payment_intent ?? null,
    amountTotal: s.amount_total != null ? s.amount_total / 100 : null,
  };
}

/**
 * Verify a Stripe-Signature header (scheme v1: HMAC-SHA256 of "<t>.<raw body>").
 * Rejects stale timestamps (default 5 min) so a captured payload can't be replayed.
 */
export function verifyStripeSignature(
  rawBody: Buffer,
  header: string | undefined,
  secret: string,
  nowSec: number = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || sigs.length === 0) return false;
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.`).update(rawBody).digest("hex");
  const exp = Buffer.from(expected, "hex");
  return sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
}

export interface WebhookResult {
  handled: boolean;
  paidOrderRef?: string;
  intentId?: string;
  sessionId?: string;
}

/** Verify + parse an incoming Stripe webhook. Unverifiable payloads are never acted on. */
export function parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookResult {
  if (!stripeEnabled() || !env.stripeWebhookSecret) return { handled: false };
  if (!verifyStripeSignature(rawBody, signature, env.stripeWebhookSecret)) {
    throw new Error("Invalid Stripe signature");
  }
  const event = JSON.parse(rawBody.toString("utf8")) as {
    type: string;
    data: { object: { id: string; payment_status?: string; metadata?: { orderRef?: string }; client_reference_id?: string; payment_intent?: string } };
  };
  const obj = event.data?.object;
  if (
    (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
    obj?.payment_status === "paid"
  ) {
    const ref = obj.metadata?.orderRef ?? obj.client_reference_id;
    if (ref) return { handled: true, paidOrderRef: ref, intentId: obj.payment_intent, sessionId: obj.id };
  }
  return { handled: false };
}
