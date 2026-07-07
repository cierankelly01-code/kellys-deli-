import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

  it("masks phone + email on the public order lookup (leaked-ref safety)", async () => {
    const order = base();
    const created = await request(app).post("/api/orders").send(order);
    expect(created.status).toBe(201);
    const ref = created.body.order.ref as string;
    const looked = await request(app).get(`/api/orders/${ref}`);
    expect(looked.status).toBe(200);
    // The lookup is reachable by anyone with the ref, so it must not echo full PII.
    expect(looked.body.phone).toContain("•");
    expect(looked.body.phone).not.toBe(order.phone);
    expect(looked.body.email).toContain("•");
    expect(looked.body.email).not.toBe(order.email);
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

d("POST /api/orders (board configurator pricing)", () => {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";
  let t = "";
  let board: any;
  let locationId = "";
  let freeCheeseLabel = "";
  let paidCheeseId = "";
  const paidCheeseLabel = `Test Truffle Cheese ${Math.floor(Math.random() * 1e6)}`;

  beforeAll(async () => {
    t = (await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).body.token;
    const platters = (await request(app).get("/api/platters?category=platters")).body as any[];
    board = platters.find((p: any) => p.isFixed && p.boardType);
    locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;
    const config = (await request(app).get("/api/board-config")).body;
    const cheeses = config.groups.find((g: any) => g.key === "cheese");
    freeCheeseLabel = cheeses.options.find((o: any) => o.price === 0).label;
    // Temp priced cheese so we can exercise paid extras (cheese group has includedFree: 0).
    const created = await request(app)
      .post("/api/admin/board-components")
      .set("Authorization", `Bearer ${t}`)
      .send({ category: "cheese", label: paidCheeseLabel, price: 3.5 });
    paidCheeseId = created.body.id;
  });

  afterAll(async () => {
    if (paidCheeseId) {
      await request(app).delete(`/api/admin/board-components/${paidCheeseId}`).set("Authorization", `Bearer ${t}`);
    }
  });

  const base = () => ({
    platterId: board.id,
    headcount: 1,
    collectionOrDeliveryDate: farDate(),
    locationId,
    customerName: "Board Buyer",
    phone: uniqPhone(),
    email: "board@example.com",
  });

  it("free selections keep the seeded all-free pricing (base = fixedPrice × qty, £25 deposit)", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ ...base(), quantity: 2, customItems: [freeCheeseLabel] });
    expect(res.status).toBe(201);
    expect(res.body.pricing.base).toBe(board.fixedPrice * 2);
    expect(res.body.pricing.deposit).toBe(25);
  });

  it("adds a priced extra to each board before the quantity multiply", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ ...base(), quantity: 2, customItems: [freeCheeseLabel, paidCheeseLabel] });
    expect(res.status).toBe(201);
    expect(res.body.pricing.base).toBeCloseTo((board.fixedPrice + 3.5) * 2, 2);
    expect(res.body.pricing.deposit).toBe(25);
    expect(res.body.order.customItems).toContain(paidCheeseLabel);
  });

  it("rejects selections beyond a group's maxSelections (400 naming the group)", async () => {
    const groups = (await request(app).get(`/api/admin/board-groups`).set("Authorization", `Bearer ${t}`)).body as any[];
    const cheese = groups.find((g) => g.key === "cheese");
    await request(app)
      .patch(`/api/admin/board-groups/${cheese.id}`)
      .set("Authorization", `Bearer ${t}`)
      .send({ maxSelections: 1 });
    try {
      const res = await request(app)
        .post("/api/orders")
        .send({ ...base(), quantity: 1, customItems: [freeCheeseLabel, paidCheeseLabel] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/only pick 1/);
    } finally {
      await request(app)
        .patch(`/api/admin/board-groups/${cheese.id}`)
        .set("Authorization", `Bearer ${t}`)
        .send({ maxSelections: cheese.maxSelections ?? null });
    }
  });

  it("still rejects orders whose chosen items are all stale (400)", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ ...base(), quantity: 1, customItems: ["Not A Real Ingredient"] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no longer available/);
  });
});
