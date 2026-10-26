import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

// Real-DB integration test (groceries click & collect — browse endpoint only so far).
// Mirrors tests/conversion-api.test.ts's direct-Prisma-fixture pattern since there's no
// admin create route for GroceryProduct yet (ordering/admin is the next increment).
const local = process.env.DATABASE_URL?.includes("localhost:5433");
const suite = local ? describe : describe.skip;

suite("groceries click & collect — browse (local database only)", () => {
  const app = createApp();
  let locationA = "";
  let locationB = "";
  const productIds: string[] = [];

  beforeAll(async () => {
    const locations = await prisma.location.findMany({ orderBy: { name: "asc" }, take: 2 });
    locationA = locations[0].id;
    locationB = locations[1].id;

    const visible = await prisma.groceryProduct.create({
      data: { department: "sandwiches", name: `Test Sandwich ${Date.now()}`, price: 4.5, active: true, sortOrder: 0 },
    });
    productIds.push(visible.id);
    await prisma.groceryProductLocation.create({ data: { productId: visible.id, locationId: locationA } });

    const inactive = await prisma.groceryProduct.create({
      data: { department: "sandwiches", name: `Draft Sandwich ${Date.now()}`, price: 0, active: false, sortOrder: 1 },
    });
    productIds.push(inactive.id);
    await prisma.groceryProductLocation.create({ data: { productId: inactive.id, locationId: locationA } });

    const otherShopOnly = await prisma.groceryProduct.create({
      data: { department: "cakes", name: `Test Brownie ${Date.now()}`, price: 2.5, active: true, sortOrder: 2 },
    });
    productIds.push(otherShopOnly.id);
    await prisma.groceryProductLocation.create({ data: { productId: otherShopOnly.id, locationId: locationB } });
  });

  afterAll(async () => {
    await prisma.groceryProductLocation.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.groceryProduct.deleteMany({ where: { id: { in: productIds } } });
  });

  it("lists only active products", async () => {
    const res = await request(app).get(`/api/groceries/products?locationId=${locationA}`);
    expect(res.status).toBe(200);
    const ids = (res.body as any[]).map((p) => p.id);
    expect(ids).toContain(productIds[0]);
    expect(ids).not.toContain(productIds[1]); // draft/inactive stays hidden
  });

  it("scopes to the requested shop", async () => {
    const res = await request(app).get(`/api/groceries/products?locationId=${locationA}`);
    const ids = (res.body as any[]).map((p) => p.id);
    expect(ids).not.toContain(productIds[2]); // only sold at locationB
  });

  it("returns every active product across shops when no locationId is given", async () => {
    const res = await request(app).get(`/api/groceries/products`);
    const ids = (res.body as any[]).map((p) => p.id);
    expect(ids).toContain(productIds[0]);
    expect(ids).toContain(productIds[2]);
  });

  it("groups by department in the response order", async () => {
    const res = await request(app).get(`/api/groceries/products`);
    const departments = (res.body as any[]).map((p) => p.department);
    const sorted = [...departments].sort();
    expect(departments).toEqual(sorted);
  });
});

// Subscribe & Save for grocery orders (the Lunch page's "standing weekly order"). Self-contained,
// no admin auth needed — same direct-Prisma-fixture pattern as the browse suite above.
suite("groceries click & collect — subscribe & save (local database only)", () => {
  const app = createApp();
  let locationId = "";
  const productIds: string[] = [];
  const orderIds: string[] = [];

  function farDate(): string {
    const days = 40 + Math.floor(Math.random() * 180);
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  }
  const uniqMobile = () => `07${Math.floor(700000000 + Math.random() * 99999999)}`;

  beforeAll(async () => {
    const location = await prisma.location.findFirst({ where: { active: true } });
    locationId = location!.id;

    const sandwich = await prisma.groceryProduct.create({
      data: { department: "sandwiches", name: `Test Sub-Sandwich ${Date.now()}`, price: 5, active: true, sortOrder: 0 },
    });
    productIds.push(sandwich.id);
    await prisma.groceryProductLocation.create({ data: { productId: sandwich.id, locationId } });

    const crispsP = await prisma.groceryProduct.create({
      data: { department: "pantry", name: `Test Sub-Crisps ${Date.now()}`, price: 1.5, active: true, sortOrder: 1 },
    });
    productIds.push(crispsP.id);
    await prisma.groceryProductLocation.create({ data: { productId: crispsP.id, locationId } });
  });

  afterAll(async () => {
    await prisma.groceryOrderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    const orders = await prisma.groceryOrder.findMany({ where: { id: { in: orderIds } }, select: { subscriptionId: true } });
    await prisma.groceryOrder.deleteMany({ where: { id: { in: orderIds } } });
    const subIds = orders.map((o) => o.subscriptionId).filter((id): id is string => !!id);
    if (subIds.length) await prisma.subscription.deleteMany({ where: { id: { in: subIds } } });
    await prisma.groceryProductLocation.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.groceryProduct.deleteMany({ where: { id: { in: productIds } } });
  });

  it("applies the discount, stamps the order, and records a pending Subscription", async () => {
    const res = await request(app)
      .post("/api/groceries/orders")
      .send({
        locationId,
        collectionDate: farDate(),
        items: [{ productId: productIds[0], quantity: 1 }, { productId: productIds[1], quantity: 1 }],
        customerName: "Lunch Subscriber",
        phone: uniqMobile(),
        isSubscription: true,
        subscriptionFrequency: "weekly",
      });
    expect(res.status).toBe(201);
    orderIds.push(res.body.order.id);

    expect(res.body.order.isSubscription).toBe(true);
    expect(res.body.order.subscriptionFrequency).toBe("weekly");
    expect(res.body.order.subscriptionDiscount).toBeCloseTo(0.65, 2); // 10% of £6.50
    expect(res.body.order.total).toBeCloseTo(5.85, 2);

    const sub = await prisma.subscription.findFirst({ where: { frequency: "weekly", phone: res.body.order.phone } });
    expect(sub).toBeTruthy();
    expect(sub!.status).toBe("pending");
  });

  it("takes no discount, and creates no Subscription, for a normal one-off order", async () => {
    const res = await request(app)
      .post("/api/groceries/orders")
      .send({
        locationId,
        collectionDate: farDate(),
        items: [{ productId: productIds[0], quantity: 1 }],
        customerName: "One-off Customer",
        phone: uniqMobile(),
      });
    expect(res.status).toBe(201);
    orderIds.push(res.body.order.id);

    expect(res.body.order.isSubscription).toBe(false);
    expect(res.body.order.subscriptionDiscount).toBeNull();
    expect(res.body.order.total).toBeCloseTo(5, 2);
  });

  it("rejects isSubscription:true without a frequency", async () => {
    const res = await request(app)
      .post("/api/groceries/orders")
      .send({
        locationId,
        collectionDate: farDate(),
        items: [{ productId: productIds[0], quantity: 1 }],
        customerName: "Missing Frequency",
        phone: uniqMobile(),
        isSubscription: true,
      });
    expect(res.status).toBe(400);
  });
});

// Real-DB integration tests (groceries ordering + admin). Run with DATABASE_URL set, after `npm run db:seed`.
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";

// Random far-future date so integration tests never contend on a shop's daily capacity.
function farDate(offsetDays = 0): string {
  const days = 40 + offsetDays + Math.floor(Math.random() * 180);
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
const uniqMobile = () => `07${Math.floor(700000000 + Math.random() * 99999999)}`;

d("Groceries click & collect — ordering + admin", () => {
  const app = createApp();
  let token = "";
  let locationId = "";
  let productId = "";
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    token = (await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).body.token;
    locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;

    const res = await request(app)
      .post("/api/admin/groceries/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ department: "sandwiches", name: `Test Order Sandwich ${Date.now()}`, description: "A test sandwich", price: 3.5, locationIds: [locationId] });
    productId = res.body.id;
    createdProductIds.push(productId);

    // Reset this shop's grocery settings to a known, permissive state so tests are deterministic
    // even if a previous run (or the admin) left different values.
    await request(app)
      .patch(`/api/admin/groceries/shop-settings/${locationId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ dailyCapacity: null, closedWeekdays: [] });
    await request(app)
      .patch("/api/admin/groceries/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ leadTimeHours: 24, minOrderQty: 1, maxItemQty: 20 });
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      await request(app).delete(`/api/admin/groceries/orders/${id}`).set("Authorization", `Bearer ${token}`);
    }
    for (const id of createdProductIds) {
      await request(app).delete(`/api/admin/groceries/products/${id}`).set("Authorization", `Bearer ${token}`);
    }
  });

  it("lists the product publicly, scoped to a shop", async () => {
    const res = await request(app).get(`/api/groceries/products?locationId=${locationId}`);
    expect(res.status).toBe(200);
    expect(res.body.find((p: any) => p.id === productId)).toBeTruthy();
  });

  it("reports availability with a reason for the lead-time window", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app).get(`/api/groceries/availability?locationId=${locationId}&from=${today}&days=1`);
    expect(res.status).toBe(200);
    expect(res.body.days[0]).toMatchObject({ date: today, bookable: false, reason: "too_soon" });
  });

  it("places an order and returns a KDS- ref", async () => {
    const res = await request(app)
      .post("/api/groceries/orders")
      .send({
        locationId,
        collectionDate: farDate(),
        items: [{ productId, quantity: 2 }],
        customerName: "Test Shopper",
        phone: uniqMobile(),
        email: "shopper@example.com",
        notes: "No mayo please",
      });
    expect(res.status).toBe(201);
    expect(res.body.order.ref).toMatch(/^KDS-[2-9A-Z]{6}$/);
    expect(res.body.order.status).toBe("pending");
    expect(res.body.order.total).toBe(7);
    createdOrderIds.push(res.body.order.id);
  });

  it("rejects a lenient-but-invalid UK mobile number", async () => {
    const res = await request(app)
      .post("/api/groceries/orders")
      .send({
        locationId,
        collectionDate: farDate(),
        items: [{ productId, quantity: 1 }],
        customerName: "Test Shopper",
        phone: "123",
      });
    expect(res.status).toBe(400);
  });

  it("rejects an order under the configured minimum quantity", async () => {
    await request(app).patch("/api/admin/groceries/settings").set("Authorization", `Bearer ${token}`).send({ minOrderQty: 5 });
    const res = await request(app)
      .post("/api/groceries/orders")
      .send({ locationId, collectionDate: farDate(), items: [{ productId, quantity: 1 }], customerName: "Test Shopper", phone: uniqMobile() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/minimum/i);
    await request(app).patch("/api/admin/groceries/settings").set("Authorization", `Bearer ${token}`).send({ minOrderQty: 1 });
  });

  it("rejects a date beyond the shop's daily capacity, server-side", async () => {
    await request(app).patch(`/api/admin/groceries/shop-settings/${locationId}`).set("Authorization", `Bearer ${token}`).send({ dailyCapacity: 2 });
    const date = farDate(10);
    const place = () =>
      request(app)
        .post("/api/groceries/orders")
        .send({ locationId, collectionDate: date, items: [{ productId, quantity: 2 }], customerName: "Test Shopper", phone: uniqMobile() });

    const first = await place();
    expect(first.status).toBe(201);
    createdOrderIds.push(first.body.order.id);

    const second = await place();
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/filled up/i);

    await request(app).patch(`/api/admin/groceries/shop-settings/${locationId}`).set("Authorization", `Bearer ${token}`).send({ dailyCapacity: null });
  });

  it("blocks a recurring closed weekday even with room and lead time", async () => {
    // Find the next occurrence of a specific weekday far enough out, then close that weekday.
    const date = farDate(20);
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    await request(app).patch(`/api/admin/groceries/shop-settings/${locationId}`).set("Authorization", `Bearer ${token}`).send({ closedWeekdays: [weekday] });

    const res = await request(app)
      .post("/api/groceries/orders")
      .send({ locationId, collectionDate: date, items: [{ productId, quantity: 1 }], customerName: "Test Shopper", phone: uniqMobile() });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/closed/i);

    await request(app).patch(`/api/admin/groceries/shop-settings/${locationId}`).set("Authorization", `Bearer ${token}`).send({ closedWeekdays: [] });
  });

  it("admin can list orders and update status", async () => {
    const date = farDate(30);
    const order1 = await request(app)
      .post("/api/groceries/orders")
      .send({ locationId, collectionDate: date, items: [{ productId, quantity: 2 }], customerName: "Alice Shopper", phone: uniqMobile() });
    const order2 = await request(app)
      .post("/api/groceries/orders")
      .send({ locationId, collectionDate: date, items: [{ productId, quantity: 3 }], customerName: "Bob Shopper", phone: uniqMobile() });
    createdOrderIds.push(order1.body.order.id, order2.body.order.id);

    const list = await request(app).get(`/api/admin/groceries/orders?locationId=${locationId}&date=${date}`).set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(2);

    const statusRes = await request(app)
      .patch(`/api/admin/groceries/orders/${order1.body.order.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "confirmed" });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe("confirmed");
  });

  it("rejects admin groceries routes without a token", async () => {
    const res = await request(app).get("/api/admin/groceries/orders");
    expect(res.status).toBe(401);
  });

  it("privacy: admin can permanently delete an order", async () => {
    const created = await request(app)
      .post("/api/groceries/orders")
      .send({ locationId, collectionDate: farDate(40), items: [{ productId, quantity: 1 }], customerName: "Delete Me", phone: uniqMobile() });
    const id = created.body.order.id;
    const del = await request(app).delete(`/api/admin/groceries/orders/${id}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);
    const list = await request(app).get(`/api/admin/groceries/orders?locationId=${locationId}`).set("Authorization", `Bearer ${token}`);
    expect(list.body.find((o: any) => o.id === id)).toBeFalsy();
  });
});
