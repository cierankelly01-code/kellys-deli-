import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import Stripe from "stripe";
import type { Express } from "express";

// Stripe "on" for this file only, with dummy TEST-mode values: no request ever leaves the
// machine — Checkout Sessions are faked below, and webhook signatures are generated
// locally with Stripe's own helper and verified by Stripe's real constructEvent.
process.env.STRIPE_SECRET_KEY = "sk_test_dummy_for_unit_tests";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy_for_unit_tests";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

let app: Express;
let payments: typeof import("../src/lib/payments");
let envMod: typeof import("../src/lib/env");
let prisma: typeof import("../src/lib/prisma").prisma;
const real = new Stripe("sk_test_dummy_for_unit_tests");

// Fake Checkout Sessions, remembered so retrieve() can report their state.
const sessions = new Map<string, { id: string; url: string; status: "open" | "complete" | "expired" }>();
const create = vi.fn(async (args: Stripe.Checkout.SessionCreateParams) => {
  const id = `cs_test_${Math.random().toString(36).slice(2, 10)}`;
  const s = { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: "open" as const, args };
  sessions.set(id, s);
  return s;
});
const retrieve = vi.fn(async (id: string) => sessions.get(id) ?? { id, url: null, status: "expired" });

beforeAll(async () => {
  payments = await import("../src/lib/payments");
  envMod = await import("../src/lib/env");
  prisma = (await import("../src/lib/prisma")).prisma;
  payments.__setStripeClientForTests({ checkout: { sessions: { create, retrieve } }, webhooks: real.webhooks });
  app = (await import("../src/app")).createApp();
});
afterAll(() => payments.__setStripeClientForTests(null));

const postWebhook = (event: object, header?: string) => {
  const payload = JSON.stringify(event);
  return request(app)
    .post("/api/payments/webhook")
    .set("Content-Type", "application/json")
    .set("Stripe-Signature", header ?? real.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET! }))
    .send(payload);
};
const paidEvent = (ref: string, amountPence: number, opts: { intent?: string; livemode?: boolean; status?: string } = {}) => ({
  id: `evt_${Math.random().toString(36).slice(2)}`,
  object: "event",
  livemode: opts.livemode ?? false,
  type: "checkout.session.completed",
  data: {
    object: {
      id: `cs_test_${Math.random().toString(36).slice(2)}`,
      object: "checkout.session",
      payment_status: opts.status ?? "paid",
      amount_total: amountPence,
      client_reference_id: ref,
      metadata: { orderRef: ref, kind: "deposit" },
      payment_intent: opts.intent ?? `pi_test_${Math.random().toString(36).slice(2)}`,
    },
  },
});
const refundEvent = (intent: string) => ({
  id: `evt_${Math.random().toString(36).slice(2)}`,
  object: "event",
  livemode: false,
  type: "charge.refunded",
  data: { object: { id: "ch_test", object: "charge", refunded: true, payment_intent: intent } },
});

/** A random open day (Tue–Sat) well ahead, so test orders don't pile onto one date. */
function openDay(): string {
  const dt = new Date(Date.now() + (40 + Math.floor(Math.random() * 300)) * 86_400_000);
  while (dt.getUTCDay() === 0 || dt.getUTCDay() === 1) dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

let board: { id: string; fixedPrice: number };
async function placeOrder() {
  if (!board) {
    const boards = (await request(app).get("/api/platters?category=board")).body as Array<{ id: string; fixedPrice: number | null }>;
    board = boards.find((b) => b.fixedPrice != null) as { id: string; fixedPrice: number };
  }
  const res = await request(app).post("/api/orders").send({
    items: [{ platterId: board.id, quantity: 1 }],
    headcount: 8,
    collectionOrDeliveryDate: openDay(),
    locationId: "loc-bentley-heath",
    customerName: "Stripe Test",
    phone: `07${Math.floor(700000000 + Math.random() * 99999999)}`,
    email: "stripe-test@example.com",
  });
  expect(res.status).toBe(201);
  return { ref: res.body.order.ref as string, pence: Math.round(res.body.pricing.deposit * 100), body: res.body };
}
const getOrder = async (ref: string) => (await request(app).get(`/api/orders/${ref}`)).body;

d("Stripe deposits", () => {
  it("sends the customer to Stripe for 25% of the board price (to the nearest 5p), cards only", async () => {
    create.mockClear();
    const { body } = await placeOrder();
    // Independent of the app's own maths: 25% of the price, to the nearest 5p, in pence.
    const expectedPence = Math.round((board.fixedPrice * 100 * 0.25) / 5) * 5;
    const args = create.mock.calls[0][0];
    expect(body.payment.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(args.line_items?.[0].price_data?.unit_amount).toBe(expectedPence);
    expect(args.line_items?.[0].price_data?.currency).toBe("gbp");
    expect(args.allowed_payment_method_types).toEqual(["card"]);
    expect(args.expires_at).toBeGreaterThan(Date.now() / 1000 + 30 * 60 - 5);
    expect(args.metadata).toEqual({ orderRef: body.order.ref, kind: "deposit" });
    expect(args.success_url).toContain(`/confirm/${body.order.ref}?paid=1`);
  });

  it("marks the deposit paid on a verified webhook, once, and says so on the order page", async () => {
    const { ref, pence } = await placeOrder();
    expect((await getOrder(ref)).canPayOnline).toBe(true);
    const ev = paidEvent(ref, pence, { intent: "pi_test_same" });
    expect((await postWebhook(ev)).body.handled).toBe(true);
    const order = await getOrder(ref);
    expect(order.depositStatus).toBe("paid");
    expect(order.canPayOnline).toBe(false);
    // Stripe redelivering the same payment: harmless, nothing changes.
    expect((await postWebhook(ev)).status).toBe(200);
    expect((await getOrder(ref)).depositPaidAt).toBe(order.depositPaidAt);
  });

  it("reopens the same Stripe page instead of creating a second one (no double charge)", async () => {
    const { ref } = await placeOrder();
    create.mockClear();
    const a = await request(app).post(`/api/orders/${ref}/deposit-checkout`);
    const b = await request(app).post(`/api/orders/${ref}/deposit-checkout`);
    expect(a.body.checkoutUrl).toBe(b.body.checkoutUrl);
    expect(create).not.toHaveBeenCalled();
  });

  it("flags a second, different payment on a paid order instead of hiding it", async () => {
    const { ref, pence } = await placeOrder();
    await postWebhook(paidEvent(ref, pence, { intent: "pi_test_first" }));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const second = await postWebhook(paidEvent(ref, pence, { intent: "pi_test_second" }));
    expect(second.body.handled).toBe(false);
    expect(errors.mock.calls.flat().join(" ")).toMatch(/paid TWICE/);
    errors.mockRestore();
  });

  it("never marks a cancelled order paid", async () => {
    const { ref, pence } = await placeOrder();
    await prisma.order.update({ where: { ref }, data: { status: "cancelled" } });
    const res = await postWebhook(paidEvent(ref, pence));
    expect(res.body.handled).toBe(false);
    expect((await getOrder(ref)).depositStatus).toBe("pending");
  });

  it("leaves the order pending if Stripe collected a different amount", async () => {
    const { ref, pence } = await placeOrder();
    expect((await postWebhook(paidEvent(ref, pence - 1))).body.handled).toBe(false);
    expect((await getOrder(ref)).depositStatus).toBe("pending");
  });

  it("ignores a live-mode event while test keys are set (and an unpaid session)", async () => {
    const { ref, pence } = await placeOrder();
    expect((await postWebhook(paidEvent(ref, pence, { livemode: true }))).body.handled).toBe(false);
    expect((await postWebhook(paidEvent(ref, pence, { status: "unpaid" }))).body.handled).toBe(false);
    expect((await getOrder(ref)).depositStatus).toBe("pending");
  });

  it("rejects a forged webhook", async () => {
    const { ref, pence } = await placeOrder();
    expect((await postWebhook(paidEvent(ref, pence), "t=1,v1=deadbeef")).status).toBe(400);
    expect((await getOrder(ref)).depositStatus).toBe("pending");
  });

  it("marks the deposit refunded when Stripe refunds it in full", async () => {
    const { ref, pence } = await placeOrder();
    await postWebhook(paidEvent(ref, pence, { intent: "pi_test_refund_me" }));
    expect((await postWebhook(refundEvent("pi_test_refund_me"))).body.handled).toBe(true);
    expect((await getOrder(ref)).depositStatus).toBe("refunded");
  });

  it("doesn't offer online payment on orders the shop has confirmed or collected", async () => {
    const { ref } = await placeOrder();
    await prisma.order.update({ where: { ref }, data: { status: "confirmed" } });
    expect((await getOrder(ref)).canPayOnline).toBe(false);
    expect((await request(app).post(`/api/orders/${ref}/deposit-checkout`)).status).toBe(409);
    expect((await request(app).post(`/api/orders/KD-NOPE00/deposit-checkout`)).status).toBe(404);
  });

  it("keeps the order if Stripe is down, then lets the customer pay from the order page", async () => {
    create.mockRejectedValueOnce(new Error("Stripe unavailable"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ref, body } = await placeOrder();
    errors.mockRestore();
    expect(body.payment.checkoutUrl).toBeNull();
    const later = await request(app).post(`/api/orders/${ref}/deposit-checkout`);
    expect(later.status).toBe(200);
    expect(later.body.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });

  it("stays off unless the webhook secret is set too", () => {
    const saved = envMod.env.stripeWebhookSecret;
    (envMod.env as { stripeWebhookSecret: string }).stripeWebhookSecret = "";
    try {
      expect(envMod.stripeEnabled()).toBe(false);
    } finally {
      (envMod.env as { stripeWebhookSecret: string }).stripeWebhookSecret = saved;
    }
    expect(envMod.stripeEnabled()).toBe(true);
  });
});
