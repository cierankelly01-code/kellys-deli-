// Payments module boundary. This is the ONLY place the app talks to a payment provider.
// v1 is payment-READY, not payment-LIVE: with no STRIPE_SECRET_KEY set, every function
// here returns a safe stub and the rest of the app is unaffected. Setting the two Stripe
// env vars (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET) is all it takes to go live — swap
// the marked stub bodies for the real Stripe SDK calls and nothing else changes.
import { env, stripeEnabled } from "./env";

export interface DepositIntent {
  provider: string; // "stripe" | "stub"
  intentId: string;
  amount: number;
  currency: "gbp";
  status: "pending" | "succeeded";
  clientSecret: string | null; // Stripe returns a real client secret the browser uses
}

/**
 * Create/capture a deposit payment intent for an order's 25% deposit.
 *
 * Stubbed while Stripe is absent: returns a pending intent and logs it — no card taken.
 * To go live (STRIPE_SECRET_KEY set), replace the stub branch with:
 *   const pi = await stripe.paymentIntents.create({
 *     amount: Math.round(amount * 100), currency: "gbp",
 *     metadata: { orderRef }, automatic_payment_methods: { enabled: true },
 *   });
 *   return { provider: "stripe", intentId: pi.id, amount, currency: "gbp",
 *            status: "pending", clientSecret: pi.client_secret };
 */
export async function captureDepositIntent(amount: number, orderRef: string): Promise<DepositIntent> {
  if (stripeEnabled()) {
    // Stripe is configured but the SDK isn't wired in this build yet. Fail safe to a stub
    // rather than silently pretending a card was charged. (Wire the SDK call above here.)
    console.warn(`[payments] STRIPE_SECRET_KEY is set but the Stripe SDK is not wired in — using a stub intent for ${orderRef}.`);
  }
  const intent: DepositIntent = {
    provider: "stub",
    intentId: `stub_${orderRef}`,
    amount,
    currency: "gbp",
    status: "pending",
    clientSecret: null,
  };
  console.log(`[payments:stub] deposit intent £${amount.toFixed(2)} for ${orderRef} -> ${intent.status}`);
  return intent;
}

export interface WebhookResult {
  handled: boolean;
  // For a payment_intent.succeeded event: the order ref whose deposit is now paid.
  paidOrderRef?: string;
  intentId?: string;
}

/**
 * Verify + parse an incoming payment-provider webhook. Stubbed until Stripe lands.
 *
 * To go live: verify the signature and map the event, e.g.
 *   const event = stripe.webhooks.constructEvent(rawBody, sigHeader, env.stripeWebhookSecret);
 *   if (event.type === "payment_intent.succeeded") {
 *     const pi = event.data.object;
 *     return { handled: true, paidOrderRef: pi.metadata.orderRef, intentId: pi.id };
 *   }
 *   return { handled: false };
 */
export function parseWebhook(_rawBody: Buffer, _signature: string | undefined): WebhookResult {
  // Signature verification requires the webhook secret; without it we can't trust the
  // payload, so we don't act on it.
  if (!stripeEnabled() || !env.stripeWebhookSecret) {
    return { handled: false };
  }
  // Stripe SDK not wired yet — treat as unhandled rather than trusting an unverified body.
  return { handled: false };
}
