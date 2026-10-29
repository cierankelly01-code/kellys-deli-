import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import Stripe from "stripe";
import type { Express } from "express";

// Bread (KDB-) and deli counter (KDS-) orders paid in full online. Same approach as
// payments.stripe.test.ts: Stripe "on" with dummy TEST values, Checkout faked, webhook
// signatures made and verified locally. No request leaves the machine.
process.env.STRIPE_SECRET_KEY = "sk_test_dummy_for_unit_tests";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy_for_unit_tests";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

let app: Express;
let payments: typeof import("../src/lib/payments");
let prisma: typeof import("../src/lib/prisma").prisma;
const real = new Stripe("sk_test_dummy_for_unit_tests");

const sessions = new Map<string, { id: string; url: string; status: "open" | "complete" | "expired"; args: Stripe.Checkout.SessionCreateParams }>();
const create = vi.fn(async (args: Stripe.Checkout.SessionCreateParams) => {
  const id = `cs_test_${Math.random().toString(36).slice(2, 10)}`;
  const s = { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: "open" as const, args };
  sessions.set(id, s);
  return s;
});
const retrieve = vi.fn(async (id: string) => {
  const found = sessions.get(id);
  if (!found) throw new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", message: `No such checkout.session: ${id}`, code: "resource_missing" });
  return found;
});
const expire = vi.fn(async (id: string) => { const f = sessions.get(id); if (f) f.status = "expired"; return f; });

const uniqMobile = () => `07${Math.floor(700000000 + Math.random() * 99999999)}`;
const farDate = () => new Date(Date.now() + (400 + Math.floor(Math.random() * 1500)) * 86_400_000).toISOString().slice(0, 10);

let token = "";
let locationId = "";
const products: { bread: string; grocery: string } = { bread: "", grocery: "" };

beforeAll(async () => {
  if (!hasDb) return;
  payments = await import("../src/lib/payments");
  prisma = (await import("../src/lib/prisma")).prisma;
  payments.__setStripeClientForTests({ checkout: { sessions: { create, retrieve, expire } }, webhooks: real.webhooks });
  app = (await import("../src/app")).createApp();
  // Read after the app loads: env.ts runs dotenv, which supplies the local admin login.
  token = (await request(app).post("/api/auth/login").send({ email: process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk", password: process.env.ADMIN_PASSWORD ?? "changeme123" })).body.token;
  locationId = ((await request(app).get("/api/locations")).body as Array<{ id: string }>)[0].id;
  const auth = { Authorization: `Bearer ${token}` };
  products.bread = (await request(app).post("/api/admin/bread/products").set(auth).send({ name: `Pay Cob ${Date.now()}`, description: "A test loaf", price: 3.5, locationIds: [locationId] })).body.id;
  products.grocery = (await request(app).post("/api/admin/groceries/products").set(auth).send({ department: "sandwiches", name: `Pay Sandwich ${Date.now()}`, description: "A test sandwich", price: 4.25, locationIds: [locationId] })).body.id;
  for (const kind of ["bread", "groceries"]) {
    await request(app).patch(`/api/admin/${kind}/shop-settings/${locationId}`).set(auth).send({ dailyCapacity: null, closedWeekdays: [] });
    await request(app).patch(`/api/admin/${kind}/settings`).set(auth).send({ minOrderQty: 1, maxItemQty: 20 });
  }
});
afterAll(async () => {
  if (!hasDb) return;
  payments.__setStripeClientForTests(null);
  const auth = { Authorization: `Bearer ${token}` };
  await request(app).delete(`/api/admin/bread/products/${products.bread}`).set(auth);
  await request(app).delete(`/api/admin/groceries/products/${products.grocery}`).set(auth);
});

const postWebhook = (event: object) => {
  const payload = JSON.stringify(event);
  return request(app).post("/api/payments/webhook").set("Content-Type", "application/json")
    .set("Stripe-Signature", real.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET! })).send(payload);
};
const paidEvent = (ref: string, pence: number, intent = `pi_test_${Math.random().toString(36).slice(2)}`) => ({
  id: `evt_${Math.random().toString(36).slice(2)}`, object: "event", livemode: false, type: "checkout.session.completed",
  data: { object: { id: `cs_test_${Math.random().toString(36).slice(2)}`, object: "checkout.session", payment_status: "paid", amount_total: pence,
    client_reference_id: ref, metadata: { orderRef: ref, kind: "order" }, payment_intent: intent, customer_details: { email: "from-stripe@example.com" } } },
});

async function place(kind: "bread" | "groceries", opts: { email?: string; quantity?: number } = {}) {
  const res = await request(app).post(`/api/${kind}/orders`).send({
    locationId, collectionDate: farDate(),
    items: [{ productId: kind === "bread" ? products.bread : products.grocery, quantity: opts.quantity ?? 2 }],
    customerName: "Pay Tester", phone: uniqMobile(), ...(opts.email ? { email: opts.email } : {}),
  });
  expect(res.body.error ?? null).toBeNull();
  expect(res.status).toBe(201);
  return res.body as { order: { ref: string; total: number }; payment: { checkoutUrl: string | null } };
}
const mailsFor = (logs: ReturnType<typeof vi.spyOn>, ref: string) =>
  logs.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith("[notify:email") && l.includes(ref));

d("Bread and deli counter orders, paid in full online", () => {
  it("sends a bread order to Stripe for its full total, and emails nothing until it's paid", async () => {
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const { order, payment } = await place("bread", { email: "baker@example.com" });
      expect(payment.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
      const s = [...sessions.values()].find((x) => x.args.client_reference_id === order.ref)!;
      expect(s.args.line_items?.[0].price_data?.unit_amount).toBe(700); // 2 × £3.50
      expect(mailsFor(logs, order.ref)).toEqual([]);
      const view = (await request(app).get(`/api/simple-orders/${order.ref}`)).body;
      expect(view).toMatchObject({ paymentStatus: "pending", canPayOnline: true, customerName: "Pay" });
      expect(view.holdEndsAt).toEqual(expect.any(String));

      expect((await postWebhook(paidEvent(order.ref, 700))).body.handled).toBe(true);
      expect((await request(app).get(`/api/simple-orders/${order.ref}`)).body).toMatchObject({ paymentStatus: "paid", canPayOnline: false });
      expect(mailsFor(logs, order.ref).some((l) => l.includes("baker@example.com") && l.includes("Paid in full"))).toBe(true);
    } finally { logs.mockRestore(); }
  });

  it("charges a deli counter order its full total and keeps the email Stripe collected when none was given", async () => {
    const { order } = await place("groceries", { quantity: 3 });
    expect(order.total).toBe(12.75);
    expect((await postWebhook(paidEvent(order.ref, 1275))).body.handled).toBe(true);
    const row = await prisma.groceryOrder.findUnique({ where: { ref: order.ref } });
    expect(row).toMatchObject({ paymentStatus: "paid", email: "from-stripe@example.com" });
    expect(row!.confirmationSentAt).not.toBeNull();
  });

  it("leaves the order unpaid and alerts the shop if Stripe collected the wrong amount", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { order } = await place("bread");
      expect((await postWebhook(paidEvent(order.ref, 100))).body.handled).toBe(false);
      expect((await prisma.breadOrder.findUnique({ where: { ref: order.ref } }))!.paymentStatus).toBe("pending");
    } finally { errors.mockRestore(); }
  });

  it("reopens the same Stripe page from the order page instead of opening a second one", async () => {
    const { order, payment } = await place("groceries");
    const again = await request(app).post(`/api/simple-orders/${order.ref}/checkout`);
    expect(again.status).toBe(200);
    expect(again.body.checkoutUrl).toBe(payment.checkoutUrl);
  });

  it("marks the order refunded when Stripe refunds it in full", async () => {
    const { order } = await place("bread");
    await postWebhook(paidEvent(order.ref, 700, "pi_test_simple_refund"));
    await postWebhook({ id: "evt_r", object: "event", livemode: false, type: "charge.refunded", data: { object: { id: "ch_test", object: "charge", refunded: true, payment_intent: "pi_test_simple_refund" } } });
    expect((await prisma.breadOrder.findUnique({ where: { ref: order.ref } }))!.paymentStatus).toBe("refunded");
  });

  it("falls back to pay on collection, emailed at once, when Stripe can't open a page", async () => {
    create.mockRejectedValueOnce(new Error("Stripe unavailable"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const { order, payment } = await place("bread", { email: "walkin@example.com" });
      expect(payment.checkoutUrl).toBeNull();
      expect((await prisma.breadOrder.findUnique({ where: { ref: order.ref } }))!.paymentStatus).toBe("none");
      expect(mailsFor(logs, order.ref).some((l) => l.includes("walkin@example.com") && l.includes("Pay on collection"))).toBe(true);
      expect((await request(app).get(`/api/simple-orders/${order.ref}`)).body.canPayOnline).toBe(false);
    } finally { logs.mockRestore(); errors.mockRestore(); }
  });

  it("releases an unpaid order after the hold, but never one the shop has handled", async () => {
    const { releaseUnpaidOrders, UNPAID_HOLD_MINUTES } = await import("../src/lib/unpaid-orders");
    const old = new Date(Date.now() - (UNPAID_HOLD_MINUTES + 1) * 60_000);
    const abandoned = (await place("groceries")).order.ref;
    const handled = (await place("bread")).order.ref;
    for (const [table, ref] of [[prisma.groceryOrder, abandoned], [prisma.breadOrder, handled]] as const) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = await (table as any).update({ where: { ref }, data: { createdAt: old } });
      sessions.get(row.paymentIntentId)!.status = "expired";
    }
    const id = (await prisma.breadOrder.findUnique({ where: { ref: handled } }))!.id;
    expect((await request(app).patch(`/api/admin/bread/orders/${id}/status`).set("Authorization", `Bearer ${token}`).send({ status: "confirmed" })).status).toBe(200);

    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    try { while ((await releaseUnpaidOrders()).length) { /* drain older rows */ } } finally { logs.mockRestore(); }
    expect((await prisma.groceryOrder.findUnique({ where: { ref: abandoned } }))!.status).toBe("cancelled");
    expect((await prisma.breadOrder.findUnique({ where: { ref: handled } }))!.status).toBe("confirmed");
    expect((await request(app).post(`/api/simple-orders/${abandoned}/checkout`)).status).toBe(409);
  });
});
