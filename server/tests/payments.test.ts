import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { stripeForm, verifyStripeSignature } from "../src/lib/payments";

const secret = "whsec_test";
const body = Buffer.from(JSON.stringify({ type: "checkout.session.completed" }));
const sign = (t: number, payload = body, key = secret) =>
  `t=${t},v1=${crypto.createHmac("sha256", key).update(`${t}.`).update(payload).digest("hex")}`;

describe("Stripe webhook signatures", () => {
  const now = 1_800_000_000;
  it("accepts a correctly signed, fresh payload", () => {
    expect(verifyStripeSignature(body, sign(now), secret, now)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyStripeSignature(Buffer.from("{}"), sign(now), secret, now)).toBe(false);
  });
  it("rejects the wrong secret", () => {
    expect(verifyStripeSignature(body, sign(now, body, "whsec_other"), secret, now)).toBe(false);
  });
  it("rejects a replayed old payload", () => {
    expect(verifyStripeSignature(body, sign(now - 3600), secret, now)).toBe(false);
  });
  it("rejects a missing header", () => {
    expect(verifyStripeSignature(body, undefined, secret, now)).toBe(false);
  });
});

describe("Stripe form encoding", () => {
  it("flattens nested objects and arrays the way Stripe expects", () => {
    const out = stripeForm({ mode: "payment", metadata: { orderRef: "KD-1" }, line_items: [{ quantity: 1, price_data: { unit_amount: 4500 } }] });
    expect(out).toContain("mode=payment");
    expect(out).toContain(`${encodeURIComponent("metadata[orderRef]")}=KD-1`);
    expect(out).toContain(`${encodeURIComponent("line_items[0][price_data][unit_amount]")}=4500`);
  });
});
