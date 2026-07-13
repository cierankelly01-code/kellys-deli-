import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { roundTo5p, toMoney } from "../src/lib/money";

// Real-DB integration tests (v2 line-item orders). Run with DATABASE_URL set, after `npm run db:seed`.
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;
const app = createApp();

// Random far-future date so integration tests never contend on a location's daily capacity.
function farDate(): string {
  const days = 30 + Math.floor(Math.random() * 180);
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
const uniqPhone = () => `07${Math.floor(700000000 + Math.random() * 99999999)}`;

d("POST /api/orders (v2 line items + add-ons)", () => {
  let boards: any[] = [];
  let signature: any;
  let large: any;
  let cheese: any;
  let locationId = "";
  let addOns: any[] = [];
  let perPerson: any;
  let perOrder: any;

  beforeAll(async () => {
    boards = (await request(app).get("/api/platters?category=board")).body as any[];
    signature = boards.find((p) => p.tier === "signature" && p.name === "Medium Platter") ?? boards[0];
    large = boards.find((p) => p.name === "Large Platter") ?? signature;
    cheese = boards.find((p) => p.name === "Cheese Board") ?? boards[1] ?? signature;
    locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;
    addOns = (await request(app).get("/api/add-ons")).body as any[];
    perPerson = addOns.find((a) => a.unitType === "per_person");
    perOrder = addOns.find((a) => a.unitType === "per_order");
  });

  const base = () => ({
    items: [{ platterId: signature.id, quantity: 1 }],
    headcount: 8,
    collectionOrDeliveryDate: farDate(),
    locationId,
    customerName: "Test Buyer",
    phone: uniqPhone(),
    email: "buyer@example.com",
    src: "qr",
  });

  it("creates a single-board order with a KD- ref, 25% deposit (nearest 5p), and balance", async () => {
    const res = await request(app).post("/api/orders").send(base());
    expect(res.status).toBe(201);
    expect(res.body.order.ref).toMatch(/^KD-[2-9A-Z]{6}$/);
    expect(res.body.pricing.total).toBe(signature.fixedPrice);
    expect(res.body.pricing.deposit).toBe(roundTo5p(signature.fixedPrice * 0.25));
    expect(res.body.pricing.balance).toBe(toMoney(signature.fixedPrice - res.body.pricing.deposit));
    expect(res.body.order.type).toBe("platter");
    expect(res.body.order.items).toHaveLength(1);
    expect(res.body.order.items[0].platterId).toBe(signature.id);
    expect(res.body.order.src).toBe("qr");
  });

  it("accepts the legacy single-platter shape and normalises it to one item", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ platterId: signature.id, quantity: 1, headcount: 8, collectionOrDeliveryDate: farDate(), locationId, customerName: "Legacy", phone: uniqPhone(), email: "legacy@example.com" });
    expect(res.status).toBe(201);
    expect(res.body.order.items).toHaveLength(1);
  });

  it("prices add-ons into the total, deposit and balance, and itemises them", async () => {
    const headcount = 10;
    const res = await request(app)
      .post("/api/orders")
      .send({
        ...base(),
        headcount,
        addOns: [
          { addOnId: perPerson.id, quantity: headcount },
          { addOnId: perOrder.id, quantity: 1 },
        ],
      });
    expect(res.status).toBe(201);
    const expectedTotal = toMoney(signature.fixedPrice + perPerson.price * headcount + perOrder.price * 1);
    expect(res.body.pricing.total).toBe(expectedTotal);
    expect(res.body.pricing.deposit).toBe(roundTo5p(expectedTotal * 0.25));
    expect(res.body.pricing.balance).toBe(toMoney(expectedTotal - res.body.pricing.deposit));
    expect(res.body.order.addOns).toHaveLength(2);
    const addOnNames = res.body.order.addOns.map((a: any) => a.name);
    expect(addOnNames).toContain(perPerson.name);
  });

  it("creates a multi-board event order and sums the boards", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({
        ...base(),
        headcount: 25,
        occasion: "Corporate",
        items: [
          { platterId: large.id, quantity: 2 },
          { platterId: cheese.id, quantity: 1 },
        ],
      });
    expect(res.status).toBe(201);
    const expectedTotal = toMoney(large.fixedPrice * 2 + cheese.fixedPrice * 1);
    expect(res.body.pricing.total).toBe(expectedTotal);
    expect(res.body.pricing.deposit).toBe(roundTo5p(expectedTotal * 0.25));
    expect(res.body.order.items).toHaveLength(2);
    expect(res.body.order.occasion).toBe("Corporate");
    // primary board = first item
    expect(res.body.order.platterId).toBe(large.id);
  });

  it("rejects an order with no boards (400)", async () => {
    const res = await request(app).post("/api/orders").send({ ...base(), items: [] });
    expect(res.status).toBe(400);
  });

  it("rejects a same-day order (inside the lead time, 400)", async () => {
    const res = await request(app).post("/api/orders").send({ ...base(), collectionOrDeliveryDate: new Date().toISOString().slice(0, 10) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/notice/);
  });

  it("404s for an unknown board id", async () => {
    const res = await request(app).post("/api/orders").send({ ...base(), items: [{ platterId: "does-not-exist", quantity: 1 }] });
    expect(res.status).toBe(404);
  });

  it("404s for an unknown add-on id", async () => {
    const res = await request(app).post("/api/orders").send({ ...base(), addOns: [{ addOnId: "nope", quantity: 1 }] });
    expect(res.status).toBe(404);
  });

  it("masks phone + email on the public order lookup (leaked-ref safety)", async () => {
    const order = base();
    const created = await request(app).post("/api/orders").send(order);
    expect(created.status).toBe(201);
    const ref = created.body.order.ref as string;
    const looked = await request(app).get(`/api/orders/${ref}`);
    expect(looked.status).toBe(200);
    expect(looked.body.phone).toContain("•");
    expect(looked.body.phone).not.toBe(order.phone);
    expect(looked.body.email).toContain("•");
  });
});

d("GET /api/add-ons", () => {
  it("lists active add-ons with unit metadata", async () => {
    const res = await request(app).get("/api/add-ons");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const cutlery = res.body.find((a: any) => a.unitType === "per_person");
    expect(cutlery).toBeTruthy();
    expect(cutlery.suggestFromHeadcount).toBe(true);
  });
});

d("GET /api/recommend", () => {
  it("recommends a board combo that covers the headcount", async () => {
    const res = await request(app).get("/api/recommend?headcount=15");
    expect(res.status).toBe(200);
    expect(res.body.headcount).toBe(15);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.totalFeeds).toBeGreaterThanOrEqual(15);
    expect(res.body.undercatered).toBe(false);
    // each item carries the full board DTO + a per-board feeds figure
    expect(res.body.items[0].board).toBeTruthy();
    expect(res.body.items[0].feedsEach).toBeGreaterThan(0);
  });

  it("rejects a missing/invalid headcount (400)", async () => {
    expect((await request(app).get("/api/recommend")).status).toBe(400);
    expect((await request(app).get("/api/recommend?headcount=0")).status).toBe(400);
  });
});
