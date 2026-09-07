import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";

// The shop alert is the only thing that tells the owner an order exists without them
// opening admin, so it is worth proving it fires — and, just as importantly, that a
// mail failure can never turn a committed order into a 500 for the customer.
const shopAlert = vi.fn(async () => {});
vi.mock("../src/lib/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/notify")>();
  return { ...actual, notifyShopOfOrder: (...a: unknown[]) => shopAlert(...(a as [])) };
});

import { createApp } from "../src/app";
import { orderShopAlertText, orderShopAlertHtml } from "../src/lib/emailTemplate";
import { PrismaClient } from "@prisma/client";

const sample = {
  customerName: "Dawn Fletcher",
  customerPhone: "07700900123",
  customerEmail: "dawn@example.com",
  ref: "KD-7Q2M4X",
  collectionDate: "Friday 14 August 2026",
  locationName: "Bentley Heath",
  boards: [{ name: "Medium Platter", qty: 2, lineTotal: 140 }],
  addOns: [{ name: "Napkins pack", qty: 1, lineTotal: 3 }],
  total: 143,
  deposit: 35.75,
  balance: 107.25,
};

describe("shop order alert — template", () => {
  it("leads with what the counter has to act on", () => {
    const text = orderShopAlertText(sample);
    expect(text).toContain("NEW ORDER — KD-7Q2M4X");
    expect(text).toContain("Friday 14 August 2026");
    expect(text).toContain("Bentley Heath");
    expect(text).toContain("Medium Platter x2");
    expect(text).toContain("Napkins pack");
    expect(text).toContain("£143.00");
  });

  it("carries the customer's contact details, which their own confirmation does not", () => {
    const text = orderShopAlertText(sample);
    expect(text).toContain("07700900123");
    expect(text).toContain("dawn@example.com");
    expect(orderShopAlertHtml(sample)).toContain("07700900123");
  });

  it("says so plainly rather than printing 'undefined' when a detail is missing", () => {
    const text = orderShopAlertText({ ...sample, customerPhone: null, customerEmail: null });
    expect(text).toContain("Phone: (not given)");
    expect(text).toContain("Email: (not given)");
    expect(text).not.toContain("undefined");
  });

  it("escapes customer-supplied text so a name cannot inject markup into the shop's inbox", () => {
    const html = orderShopAlertHtml({ ...sample, customerName: '<script>alert(1)</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

d("shop order alert — wired into order creation", () => {
  const app = createApp();
  const prisma = new PrismaClient();
  let base: () => Record<string, unknown>;

  const farDate = () => new Date(Date.now() + (30 + Math.floor(Math.random() * 180)) * 86_400_000).toISOString().slice(0, 10);
  const uniqPhone = () => `07${Math.floor(700000000 + Math.random() * 99999999)}`;

  beforeAll(async () => {
    const boards = (await request(app).get("/api/platters?category=board")).body as any[];
    const board = boards.find((p) => p.name === "Medium Platter") ?? boards[0];
    const locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;
    base = () => ({
      items: [{ platterId: board.id, quantity: 1 }],
      headcount: 8,
      collectionOrDeliveryDate: farDate(),
      locationId,
      customerName: "Alert Test",
      phone: uniqPhone(),
      email: "alert@example.com",
    });
  });

  afterAll(async () => {
    await prisma.setting.deleteMany({ where: { key: "orderNotifyEmail" } });
    await prisma.$disconnect();
  });

  const setAlertAddress = (value: string) =>
    prisma.setting.upsert({ where: { key: "orderNotifyEmail" }, update: { value }, create: { key: "orderNotifyEmail", value } });

  it("emails the shop when the owner has set an address", async () => {
    shopAlert.mockClear();
    await setAlertAddress("hello@kellysdeli.co.uk");
    const res = await request(app).post("/api/orders").send(base());
    expect(res.status).toBe(201);
    expect(shopAlert).toHaveBeenCalledTimes(1);
    const [to, target, order] = shopAlert.mock.calls[0] as any[];
    expect(to).toBe("hello@kellysdeli.co.uk");
    expect(target.email).toBe("alert@example.com");
    expect(order.ref).toBe(res.body.order.ref);
    expect(order.total).toBe(res.body.pricing.total);
  });

  it("stays silent when no address is set, rather than emailing nobody", async () => {
    shopAlert.mockClear();
    await prisma.setting.deleteMany({ where: { key: "orderNotifyEmail" } });
    const res = await request(app).post("/api/orders").send(base());
    expect(res.status).toBe(201);
    expect(shopAlert).not.toHaveBeenCalled();
  });

  it("still takes the order when the alert email throws", async () => {
    shopAlert.mockClear();
    shopAlert.mockRejectedValueOnce(new Error("resend is down"));
    await setAlertAddress("hello@kellysdeli.co.uk");
    const res = await request(app).post("/api/orders").send(base());
    expect(res.status).toBe(201);
    expect(res.body.order.ref).toMatch(/^KD-[2-9A-Z]{6}$/);
  });
});
