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
// Like real Stripe: an id it doesn't know (other mode / account) throws resource_missing.
const retrieve = vi.fn(async (id: string) => {
  const found = sessions.get(id);
  if (!found) throw new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", message: `No such checkout.session: ${id}`, code: "resource_missing" });
  return found;
});
const expire = vi.fn(async (id: string) => { const f = sessions.get(id); if (f) f.status = "expired"; return f; });

beforeAll(async () => {
  payments = await import("../src/lib/payments");
  envMod = await import("../src/lib/env");
  prisma = (await import("../src/lib/prisma")).prisma;
  payments.__setStripeClientForTests({ checkout: { sessions: { create, retrieve, expire } }, webhooks: real.webhooks });
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

/** A random open day (Tue–Sat) 400+ days out: clear of the 30–210-day window the other
 *  order tests use, so Stripe tests never fill a date (5 orders/day) under them. */
function openDay(): string {
  const dt = new Date(Date.now() + (400 + Math.floor(Math.random() * 1500)) * 86_400_000);
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
  it("sends the customer to Stripe for the full board price, cards only", async () => {
    create.mockClear();
    const { body } = await placeOrder();
    // Independent of the app's own maths: the whole price, in pence (paid in full since 29 Oct 2026).
    const expectedPence = Math.round(board.fixedPrice * 100);
    const args = create.mock.calls[0][0];
    expect(body.payment.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(args.line_items?.[0].price_data?.unit_amount).toBe(expectedPence);
    expect(args.line_items?.[0].price_data?.currency).toBe("gbp");
    expect(args.allowed_payment_method_types).toEqual(["card"]);
    expect(args.expires_at).toBeGreaterThan(Date.now() / 1000 + 30 * 60 - 5);
    expect(args.metadata).toEqual({ orderRef: body.order.ref, kind: "order" });
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

d("Stripe deposits — edge cases from review", () => {
  it("never puts the customer's email on the Stripe page (the order link is shareable)", async () => {
    create.mockClear();
    await placeOrder();
    expect(create.mock.calls[0][0]).not.toHaveProperty("customer_email");
  });

  it("starts a fresh page when the stored session is unknown to Stripe (test → live switch)", async () => {
    const { ref } = await placeOrder();
    await prisma.order.update({ where: { ref }, data: { depositIntentId: "cs_test_from_another_mode" } });
    const res = await request(app).post(`/api/orders/${ref}/deposit-checkout`);
    expect(res.status).toBe(200);
    expect(res.body.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });

  it("a payment landing mid-request keeps its pi_ (refunds still sync) and the page says paid", async () => {
    const { ref, pence } = await placeOrder();
    // Make the stored session look expired so the route creates a new one, and have the
    // customer's other tab pay while Stripe is answering.
    const stored = (await prisma.order.findUnique({ where: { ref } }))!.depositIntentId!;
    sessions.get(stored)!.status = "expired";
    create.mockImplementationOnce(async (args) => {
      await postWebhook(paidEvent(ref, pence, { intent: "pi_test_raced" }));
      const id = "cs_test_loser";
      const s = { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: "open" as const, args };
      sessions.set(id, s);
      return s;
    });
    const res = await request(app).post(`/api/orders/${ref}/deposit-checkout`);
    expect(res.status).toBe(409);
    const after = await prisma.order.findUnique({ where: { ref } });
    expect(after!.depositStatus).toBe("paid");
    expect(after!.depositIntentId).toBe("pi_test_raced");
    expect(sessions.get("cs_test_loser")!.status).toBe("expired"); // the losing page can't be paid
    expect((await postWebhook(refundEvent("pi_test_raced"))).body.handled).toBe(true);
  });

  it("records a payment on an already-confirmed order but flags it for the shop", async () => {
    const { ref, pence } = await placeOrder();
    await prisma.order.update({ where: { ref }, data: { status: "confirmed" } });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await postWebhook(paidEvent(ref, pence));
    expect(res.body.handled).toBe(true);
    expect(errors.mock.calls.flat().join(" ")).toMatch(/already marked "confirmed"/);
    errors.mockRestore();
  });

  it("won't let admin set an online-paid deposit back to pending (that would allow paying twice)", async () => {
    const { ref, pence } = await placeOrder();
    await postWebhook(paidEvent(ref, pence, { intent: "pi_test_no_revert" }));
    const login = await request(app).post("/api/auth/login").send({ email: process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk", password: process.env.ADMIN_PASSWORD ?? "changeme123" });
    const token = login.body.token as string;
    const id = (await prisma.order.findUnique({ where: { ref } }))!.id;
    const revert = await request(app).patch(`/api/admin/orders/${id}/deposit`).set("Authorization", `Bearer ${token}`).send({ depositStatus: "pending" });
    expect(revert.status).toBe(409);
    const unauth = await request(app).patch(`/api/admin/orders/${id}/deposit`).send({ depositStatus: "refunded" });
    expect(unauth.status).toBe(401);
  });

  it("refuses Stripe test keys on the production site unless explicitly allowed", () => {
    const e = envMod.env as { isProd: boolean };
    const saved = e.isProd;
    e.isProd = true;
    try {
      delete process.env.STRIPE_ALLOW_TEST_MODE;
      expect(envMod.stripeEnabled()).toBe(false);
      process.env.STRIPE_ALLOW_TEST_MODE = "1";
      expect(envMod.stripeEnabled()).toBe(true);
    } finally {
      e.isProd = saved;
      delete process.env.STRIPE_ALLOW_TEST_MODE;
    }
  });
});

d("Stripe deposits — third review", () => {
  const adminToken = async () =>
    (await request(app).post("/api/auth/login").send({ email: process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk", password: process.env.ADMIN_PASSWORD ?? "changeme123" })).body.token as string;

  it("closes an open Stripe page if the deposit is marked paid while it's being reopened", async () => {
    const { ref } = await placeOrder();
    const stored = (await prisma.order.findUnique({ where: { ref } }))!.depositIntentId!;
    retrieve.mockImplementationOnce(async (id: string) => {
      await prisma.order.update({ where: { ref }, data: { depositStatus: "paid" } }); // shop took it by phone
      return sessions.get(id)!;
    });
    const res = await request(app).post(`/api/orders/${ref}/deposit-checkout`);
    expect(res.status).toBe(409);
    expect(sessions.get(stored)!.status).toBe("expired");
  });

  it("blocks paid -> refunded -> pending on an online payment (no reopening by two clicks)", async () => {
    const { ref, pence } = await placeOrder();
    await postWebhook(paidEvent(ref, pence, { intent: "pi_test_two_clicks" }));
    const token = await adminToken();
    const id = (await prisma.order.findUnique({ where: { ref } }))!.id;
    const patch = (depositStatus: string) => request(app).patch(`/api/admin/orders/${id}/deposit`).set("Authorization", `Bearer ${token}`).send({ depositStatus });
    expect((await patch("refunded")).status).toBe(200);
    expect((await patch("pending")).status).toBe(409);
  });

  it("marking a deposit paid in admin closes the customer's open Stripe page", async () => {
    const { ref } = await placeOrder();
    const order = (await prisma.order.findUnique({ where: { ref } }))!;
    const token = await adminToken();
    const res = await request(app).patch(`/api/admin/orders/${order.id}/deposit`).set("Authorization", `Bearer ${token}`).send({ depositStatus: "paid" });
    expect(res.status).toBe(200);
    expect(sessions.get(order.depositIntentId!)!.status).toBe("expired");
  });
  it("sends no confirmation until the deposit is paid, then confirms to customer and shop", async () => {
    await prisma.setting.upsert({ where: { key: "orderNotifyEmail" }, update: { value: "shop-test@example.com" }, create: { key: "orderNotifyEmail", value: "shop-test@example.com" } });
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const { ref, pence } = await placeOrder();
      const mails = () => logs.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith("[notify:email") && l.includes(ref));
      expect(mails()).toEqual([]);
      expect((await postWebhook(paidEvent(ref, pence))).body.handled).toBe(true);
      expect(mails().some((l) => l.includes("stripe-test@example.com") && l.includes(`Order ${ref} confirmed`))).toBe(true);
      expect(mails().some((l) => l.includes("shop-test@example.com") && l.includes("(paid)"))).toBe(true);
    } finally {
      logs.mockRestore();
      await prisma.setting.delete({ where: { key: "orderNotifyEmail" } }).catch(() => {});
    }
  });

  it("still emails straight away when there's no payment page (Stripe down)", async () => {
    create.mockRejectedValueOnce(new Error("Stripe unavailable"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const { ref } = await placeOrder();
      expect(logs.mock.calls.some((c) => String(c[0]).startsWith("[notify:email") && String(c[0]).includes(`Order request ${ref} received`))).toBe(true);
    } finally {
      logs.mockRestore();
      errors.mockRestore();
    }
  });

  it("releases an unpaid order's date after the hold, but not while its page is open, paid, or never went to Stripe", async () => {
    const { releaseUnpaidOrders, UNPAID_HOLD_MINUTES } = await import("../src/lib/unpaid-orders");
    const old = new Date(Date.now() - (UNPAID_HOLD_MINUTES + 1) * 60_000);
    const backdate = (ref: string) => prisma.order.update({ where: { ref }, data: { createdAt: old } });
    const session = async (ref: string) => sessions.get((await prisma.order.findUnique({ where: { ref } }))!.depositIntentId!)!;

    const abandoned = (await placeOrder()).ref;
    await backdate(abandoned);
    (await session(abandoned)).status = "expired";

    const stillPaying = (await placeOrder()).ref; // reopened late: page still open
    await backdate(stillPaying);

    const paidJustNow = (await placeOrder()).ref; // paid, webhook not here yet
    await backdate(paidJustNow);
    (await session(paidJustNow)).status = "complete";

    const recent = (await placeOrder()).ref;
    (await session(recent)).status = "expired";

    create.mockRejectedValueOnce(new Error("Stripe unavailable"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const noPage = (await placeOrder()).ref; // shop chases this deposit by hand
    await backdate(noPage);

    // Emailed when placed (Stripe was down), then the customer opened Pay and gave up: both
    // sides already hold a confirmation, so it must never be cancelled behind their backs.
    create.mockRejectedValueOnce(new Error("Stripe unavailable"));
    const emailedThenAbandoned = (await placeOrder()).ref;
    errors.mockRestore();
    expect((await request(app).post(`/api/orders/${emailedThenAbandoned}/deposit-checkout`)).status).toBe(200);
    await backdate(emailedThenAbandoned);
    (await session(emailedThenAbandoned)).status = "expired";
    expect((await getOrder(emailedThenAbandoned)).holdEndsAt).toBeNull();
    expect((await getOrder(recent)).holdEndsAt).toEqual(expect.any(String));

    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    try { while ((await releaseUnpaidOrders()).length) { /* drain older rows from earlier runs */ } } finally { logs.mockRestore(); }

    const status = async (ref: string) => (await prisma.order.findUnique({ where: { ref } }))!.status;
    expect(await status(abandoned)).toBe("cancelled");
    expect((await getOrder(abandoned)).canPayOnline).toBe(false);
    expect(await status(stillPaying)).toBe("new");
    expect(await status(paidJustNow)).toBe("new");
    expect(await status(recent)).toBe("new");
    expect(await status(noPage)).toBe("new");
    expect(await status(emailedThenAbandoned)).toBe("new");
  });

  it("a deposit taken by phone on an unconfirmed online order sends the customer their confirmation", async () => {
    const { ref } = await placeOrder();
    const id = (await prisma.order.findUnique({ where: { ref } }))!.id;
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const res = await request(app).patch(`/api/admin/orders/${id}/deposit`).set("Authorization", `Bearer ${await adminToken()}`).send({ depositStatus: "paid" });
      expect(res.status).toBe(200);
      const mail = logs.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith("[notify:email") && l.includes(`Order ${ref} confirmed`));
      expect(mail).toBeDefined();
      expect(mail).not.toMatch(/by card|by Stripe|\(Stripe\)/i); // taken by phone or bank, not by card
    } finally { logs.mockRestore(); }
    expect((await prisma.order.findUnique({ where: { ref } }))!.confirmationSentAt).not.toBeNull();
  });

  it("an order the shop reopens by hand is never released again", async () => {
    const { releaseUnpaidOrders, UNPAID_HOLD_MINUTES } = await import("../src/lib/unpaid-orders");
    const { ref } = await placeOrder();
    const o = (await prisma.order.findUnique({ where: { ref } }))!;
    await prisma.order.update({ where: { ref }, data: { createdAt: new Date(Date.now() - (UNPAID_HOLD_MINUTES + 1) * 60_000), status: "cancelled" } });
    sessions.get(o.depositIntentId!)!.status = "expired";
    const res = await request(app).patch(`/api/admin/orders/${o.id}/status`).set("Authorization", `Bearer ${await adminToken()}`).send({ status: "new" });
    expect(res.status).toBe(200);
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    try { while ((await releaseUnpaidOrders()).length) { /* drain */ } } finally { logs.mockRestore(); }
    expect((await prisma.order.findUnique({ where: { ref } }))!.status).toBe("new");
  });

  it("still confirms to the customer when Stripe retries a payment we recorded but didn't confirm", async () => {
    const { ref, pence } = await placeOrder();
    // As if the process died between recording the payment and sending the emails.
    await prisma.order.update({ where: { ref }, data: { depositStatus: "paid", depositIntentId: "pi_test_crashed", depositPaidAt: new Date() } });
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await postWebhook(paidEvent(ref, pence, { intent: "pi_test_crashed" }));
      expect(logs.mock.calls.some((c) => String(c[0]).startsWith("[notify:email") && String(c[0]).includes(`Order ${ref} confirmed`))).toBe(true);
    } finally { logs.mockRestore(); }
  });

  it("tells the shop 'deposit paid', not 'new order', when it already had the order email", async () => {
    await prisma.setting.upsert({ where: { key: "orderNotifyEmail" }, update: { value: "shop-test@example.com" }, create: { key: "orderNotifyEmail", value: "shop-test@example.com" } });
    create.mockRejectedValueOnce(new Error("Stripe unavailable"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const { ref, pence } = await placeOrder(); // emailed straight away: no payment page
      logs.mockClear();
      expect((await postWebhook(paidEvent(ref, pence))).body.handled).toBe(true);
      const shop = logs.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("shop-test@example.com") && l.includes(ref));
      expect(shop.some((l) => l.includes(`Paid — ${ref}`))).toBe(true);
      expect(shop.some((l) => l.includes("New order"))).toBe(false);
    } finally {
      logs.mockRestore();
      errors.mockRestore();
      await prisma.setting.delete({ where: { key: "orderNotifyEmail" } }).catch(() => {});
    }
  });
});
