import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

// Real-DB integration tests (bread pre-ordering). Run with DATABASE_URL set, after `npm run db:seed`.
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;
const app = createApp();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";

// Random far-future date so integration tests never contend on a shop's daily capacity.
function farDate(offsetDays = 0): string {
  const days = 40 + offsetDays + Math.floor(Math.random() * 180);
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
const uniqMobile = () => `07${Math.floor(700000000 + Math.random() * 99999999)}`;

d("Bread pre-ordering", () => {
  let token = "";
  let locationId = "";
  let productId = "";
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    token = (await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).body.token;
    locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;

    const res = await request(app)
      .post("/api/admin/bread/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Test Cob ${Date.now()}`, description: "A test loaf", price: 3.5, locationIds: [locationId] });
    productId = res.body.id;
    createdProductIds.push(productId);

    // Reset this shop's bread settings to a known, permissive state so tests are deterministic
    // even if a previous run (or the admin) left different values.
    await request(app)
      .patch(`/api/admin/bread/shop-settings/${locationId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ dailyCapacity: null, closedWeekdays: [] });
    await request(app)
      .patch("/api/admin/bread/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ leadTimeHours: 48, cutoffMode: "rolling", minOrderQty: 1, maxItemQty: 20 });
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      await request(app).delete(`/api/admin/bread/orders/${id}`).set("Authorization", `Bearer ${token}`);
    }
    for (const id of createdProductIds) {
      await request(app).delete(`/api/admin/bread/products/${id}`).set("Authorization", `Bearer ${token}`);
    }
  });

  it("lists the product publicly, scoped to a shop", async () => {
    const res = await request(app).get(`/api/bread/products?locationId=${locationId}`);
    expect(res.status).toBe(200);
    expect(res.body.find((p: any) => p.id === productId)).toBeTruthy();
  });

  it("reports availability with a reason for the lead-time window", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app).get(`/api/bread/availability?locationId=${locationId}&from=${today}&days=1`);
    expect(res.status).toBe(200);
    expect(res.body.days[0]).toMatchObject({ date: today, bookable: false, reason: "too_soon" });
  });

  it("places an order and returns a KDB- ref", async () => {
    const res = await request(app)
      .post("/api/bread/orders")
      .send({
        locationId,
        collectionDate: farDate(),
        items: [{ productId, quantity: 2 }],
        customerName: "Test Baker",
        phone: uniqMobile(),
        email: "baker@example.com",
        notes: "No seeds please",
      });
    expect(res.status).toBe(201);
    expect(res.body.order.ref).toMatch(/^KDB-[2-9A-Z]{6}$/);
    expect(res.body.order.status).toBe("pending");
    expect(res.body.order.total).toBe(7);
    createdOrderIds.push(res.body.order.id);
  });

  it("rejects a lenient-but-invalid UK mobile number", async () => {
    const res = await request(app)
      .post("/api/bread/orders")
      .send({
        locationId,
        collectionDate: farDate(),
        items: [{ productId, quantity: 1 }],
        customerName: "Test Baker",
        phone: "123",
      });
    expect(res.status).toBe(400);
  });

  it("rejects an order under the configured minimum quantity", async () => {
    await request(app).patch("/api/admin/bread/settings").set("Authorization", `Bearer ${token}`).send({ minOrderQty: 5 });
    const res = await request(app)
      .post("/api/bread/orders")
      .send({ locationId, collectionDate: farDate(), items: [{ productId, quantity: 1 }], customerName: "Test Baker", phone: uniqMobile() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/minimum/i);
    await request(app).patch("/api/admin/bread/settings").set("Authorization", `Bearer ${token}`).send({ minOrderQty: 1 });
  });

  it("rejects a date beyond the shop's daily capacity, server-side", async () => {
    await request(app).patch(`/api/admin/bread/shop-settings/${locationId}`).set("Authorization", `Bearer ${token}`).send({ dailyCapacity: 2 });
    const date = farDate(10);
    const place = () =>
      request(app)
        .post("/api/bread/orders")
        .send({ locationId, collectionDate: date, items: [{ productId, quantity: 2 }], customerName: "Test Baker", phone: uniqMobile() });

    const first = await place();
    expect(first.status).toBe(201);
    createdOrderIds.push(first.body.order.id);

    const second = await place();
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/filled up/i);

    await request(app).patch(`/api/admin/bread/shop-settings/${locationId}`).set("Authorization", `Bearer ${token}`).send({ dailyCapacity: null });
  });

  it("blocks a recurring closed weekday even with room and lead time", async () => {
    // Find the next occurrence of a specific weekday far enough out, then close that weekday.
    const date = farDate(20);
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    await request(app).patch(`/api/admin/bread/shop-settings/${locationId}`).set("Authorization", `Bearer ${token}`).send({ closedWeekdays: [weekday] });

    const res = await request(app)
      .post("/api/bread/orders")
      .send({ locationId, collectionDate: date, items: [{ productId, quantity: 1 }], customerName: "Test Baker", phone: uniqMobile() });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/closed/i);

    await request(app).patch(`/api/admin/bread/shop-settings/${locationId}`).set("Authorization", `Bearer ${token}`).send({ closedWeekdays: [] });
  });

  it("admin can list, update status, and the bake sheet totals items across orders", async () => {
    const date = farDate(30);
    const order1 = await request(app)
      .post("/api/bread/orders")
      .send({ locationId, collectionDate: date, items: [{ productId, quantity: 2 }], customerName: "Alice Baker", phone: uniqMobile() });
    const order2 = await request(app)
      .post("/api/bread/orders")
      .send({ locationId, collectionDate: date, items: [{ productId, quantity: 3 }], customerName: "Bob Baker", phone: uniqMobile() });
    createdOrderIds.push(order1.body.order.id, order2.body.order.id);

    const list = await request(app).get(`/api/admin/bread/orders?locationId=${locationId}&date=${date}`).set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(2);

    const statusRes = await request(app)
      .patch(`/api/admin/bread/orders/${order1.body.order.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "confirmed" });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe("confirmed");

    const bake = await request(app).get(`/api/admin/bread/bake-sheet?date=${date}&locationId=${locationId}`).set("Authorization", `Bearer ${token}`);
    expect(bake.status).toBe(200);
    const shop = bake.body.shops.find((s: any) => s.location.id === locationId);
    const line = shop.sheet.lines.find((l: any) => l.name === productId || true); // product name-keyed
    expect(shop.sheet.totalItems).toBeGreaterThanOrEqual(5); // 2 + 3 from the two orders above
  });

  it("rejects admin bread routes without a token", async () => {
    const res = await request(app).get("/api/admin/bread/orders");
    expect(res.status).toBe(401);
  });

  it("privacy: admin can permanently delete an order", async () => {
    const created = await request(app)
      .post("/api/bread/orders")
      .send({ locationId, collectionDate: farDate(40), items: [{ productId, quantity: 1 }], customerName: "Delete Me", phone: uniqMobile() });
    const id = created.body.order.id;
    const del = await request(app).delete(`/api/admin/bread/orders/${id}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);
    const list = await request(app).get(`/api/admin/bread/orders?locationId=${locationId}`).set("Authorization", `Bearer ${token}`);
    expect(list.body.find((o: any) => o.id === id)).toBeFalsy();
  });
});
