import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

// Real-DB integration tests. Run with DATABASE_URL set, after `npm run db:seed`.
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;
const app = createApp();

// Random far-future date so integration tests never contend on a location's daily capacity.
function farDate(): string {
  const days = 30 + Math.floor(Math.random() * 180);
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
const uniqPhone = () => `07${Math.floor(700000000 + Math.random() * 99999999)}`;

d("POST /api/orders (platter + gift)", () => {
  let fixed: any;
  let office: any;
  let locationId = "";

  beforeAll(async () => {
    const platters = (await request(app).get("/api/platters")).body as any[];
    fixed = platters.find((p) => p.isFixed);
    office = platters.find((p) => p.name === "Office Lunch");
    locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;
  });

  const base = () => ({
    platterId: fixed.id,
    headcount: 8,
    collectionOrDeliveryDate: farDate(),
    locationId,
    customerName: "Test Buyer",
    phone: uniqPhone(),
    email: "buyer@example.com",
    src: "qr",
  });

  it("creates a fixed-price order with a KD- ref and 25% deposit", async () => {
    const res = await request(app).post("/api/orders").send(base());
    expect(res.status).toBe(201);
    expect(res.body.order.ref).toMatch(/^KD-[2-9A-Z]{6}$/);
    expect(res.body.pricing.total).toBe(fixed.fixedPrice);
    expect(res.body.pricing.deposit).toBeCloseTo(fixed.fixedPrice * 0.25, 2);
    expect(res.body.order.type).toBe("platter");
    expect(res.body.order.src).toBe("qr");
  });

  it("captures gift delivery details when isGift", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ ...base(), isGift: true, recipientName: "Aunt May", deliveryAddress: "1 High St, Henley", giftMessage: "Happy birthday!" });
    expect(res.status).toBe(201);
    expect(res.body.order.type).toBe("gift");
    expect(res.body.order.isGift).toBe(true);
    expect(res.body.order.recipientName).toBe("Aunt May");
    expect(res.body.order.deliveryAddress).toContain("High St");
  });

  it("rejects a gift with no delivery address (400)", async () => {
    const res = await request(app).post("/api/orders").send({ ...base(), isGift: true, recipientName: "X" });
    expect(res.status).toBe(400);
  });

  it("rejects < 48h notice (400)", async () => {
    const res = await request(app).post("/api/orders").send({ ...base(), collectionOrDeliveryDate: new Date().toISOString().slice(0, 10) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/48 hours/);
  });

  it("enforces minimum headcount on the per-head Office Lunch (400)", async () => {
    const res = await request(app).post("/api/orders").send({ ...base(), platterId: office.id, headcount: 4 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/[Mm]inimum headcount/);
  });
});
