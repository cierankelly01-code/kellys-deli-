// Payment stub. v1 captures a deposit "intent" and marks the order deposit pending.
// No live card processing. Swap the body of captureDepositIntent for Stripe later —
// the rest of the app only depends on this interface.

export interface DepositIntent {
  provider: string;
  intentId: string;
  amount: number;
  currency: "gbp";
  status: "pending" | "succeeded";
  clientSecret: string | null; // Stripe would return a real client secret here
}

/**
 * Capture a deposit intent. Stubbed: returns a pending intent and logs it.
 *
 * To go live with Stripe:
 *   const pi = await stripe.paymentIntents.create({ amount: Math.round(amount*100), currency: 'gbp', ... });
 *   return { provider: 'stripe', intentId: pi.id, amount, currency: 'gbp', status: 'pending', clientSecret: pi.client_secret };
 */
export async function captureDepositIntent(amount: number, orderRef: string): Promise<DepositIntent> {
  const intent: DepositIntent = {
    provider: "stub",
    intentId: `stub_${orderRef}`,
    amount,
    currency: "gbp",
    status: "pending",
    clientSecret: null,
  };
  console.log(`[payments:stub] captured deposit intent £${amount.toFixed(2)} for ${orderRef} -> ${intent.status}`);
  return intent;
}
