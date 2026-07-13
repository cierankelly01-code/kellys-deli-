import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;
const app = createApp();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";

// Random far-future date so integration tests never contend on capacity.
function farDate(): string {
  const days = 30 + Math.floor(Math.random() * 180);
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
const uniqPhone = () => `07${Math.floor(700000000 + Math.random() * 99999999)}`;

async function token(): Promise<string> {
  return (await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).body.token;
}

d("admin auth", () => {
  it("rejects admin routes without a token", async () => {
    expect((await request(app).get("/api/admin/orders")).status).toBe(401);
  });
  it("rejects wrong credentials", async () => {
    expect((await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: "nope" })).status).toBe(401);
  });
  it("logs in and reaches a protected route", async () => {
    const t = await token();
    const orders = await request(app).get("/api/admin/orders").set("Authorization", `Bearer ${t}`);
    expect(orders.status).toBe(200);
    expect(Array.isArray(orders.body)).toBe(true);
  });
});

d("re-order + prep sheet", () => {
  let t = "";
  let boardId = "";
  let locationId = "";
  const phone = uniqPhone();
  const date = farDate();

  beforeAll(async () => {
    t = await token();
    const boards = (await request(app).get("/api/platters?category=board")).body as any[];
    boardId = boards[0].id;
    locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;
    await request(app).post("/api/orders").send({
      items: [{ platterId: boardId, quantity: 1 }], headcount: 10, collectionOrDeliveryDate: date, locationId,
      customerName: "Repeat Customer", phone, email: "repeat@example.com", src: "qr",
    });
  });

  it("finds a returning customer's last order by phone", async () => {
    const res = await request(app).get(`/api/reorder?contact=${phone}`);
    expect(res.status).toBe(200);
    expect(res.body.platterId).toBe(boardId);
  });

  it("aggregates that day into a prep sheet", async () => {
    const res = await request(app).get(`/api/admin/prep-sheet?locationId=${locationId}&date=${date}`).set("Authorization", `Bearer ${t}`);
    expect(res.status).toBe(200);
    expect(res.body.sheet.totalOrders).toBeGreaterThanOrEqual(1);
    expect(res.body.sheet.lines.length).toBeGreaterThan(0);
  });
});

d("admin orders — itemisation, deposit/balance, status cycle", () => {
  let t = "";
  let boardId = "";
  let cutlery: any;
  let locationId = "";

  beforeAll(async () => {
    t = await token();
    const boards = (await request(app).get("/api/platters?category=board")).body as any[];
    boardId = (boards.find((b: any) => b.name === "Medium Platter") ?? boards[0]).id;
    cutlery = ((await request(app).get("/api/add-ons")).body as any[]).find((a: any) => a.unitType === "per_person");
    locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;
  });

  it("shows a new order itemised with boards + add-ons, deposit and balance", async () => {
    const created = await request(app).post("/api/orders").send({
      items: [{ platterId: boardId, quantity: 1 }],
      addOns: [{ addOnId: cutlery.id, quantity: 6 }],
      headcount: 6, collectionOrDeliveryDate: farDate(), locationId,
      customerName: "Itemised", phone: uniqPhone(), email: "item@example.com",
    });
    expect(created.status).toBe(201);
    const id = created.body.order.id;

    const orders = (await request(app).get("/api/admin/orders").set("Authorization", `Bearer ${t}`)).body as any[];
    const found = orders.find((o) => o.id === id);
    expect(found).toBeTruthy();
    expect(found.items.length).toBe(1);
    expect(found.addOns.length).toBe(1);
    expect(found.balance).toBeCloseTo(found.total - found.deposit, 2);
  });

  it("cycles status new → deposit_requested → confirmed → collected", async () => {
    const created = await request(app).post("/api/orders").send({
      items: [{ platterId: boardId, quantity: 1 }],
      headcount: 6, collectionOrDeliveryDate: farDate(), locationId,
      customerName: "Cycler", phone: uniqPhone(), email: "cycle@example.com",
    });
    const id = created.body.order.id;
    for (const status of ["deposit_requested", "confirmed", "collected"]) {
      const res = await request(app).patch(`/api/admin/orders/${id}/status`).set("Authorization", `Bearer ${t}`).send({ status });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  it("rejects an unknown status (400)", async () => {
    const created = await request(app).post("/api/orders").send({
      items: [{ platterId: boardId, quantity: 1 }],
      headcount: 6, collectionOrDeliveryDate: farDate(), locationId,
      customerName: "Bad", phone: uniqPhone(), email: "bad@example.com",
    });
    const res = await request(app).patch(`/api/admin/orders/${created.body.order.id}/status`).set("Authorization", `Bearer ${t}`).send({ status: "in_prep" });
    expect(res.status).toBe(400);
  });
});

d("admin add-on CRUD", () => {
  let t = "";
  let locationId = "";
  const authed = (method: "get" | "post" | "patch" | "delete", url: string) =>
    request(app)[method](url).set("Authorization", `Bearer ${t}`);

  beforeAll(async () => {
    t = await token();
    locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;
  });

  it("creates, updates and deletes an add-on", async () => {
    const created = await authed("post", "/api/admin/add-ons").send({
      name: `Test Balloons ${Math.floor(Math.random() * 1e6)}`, price: 5, unitType: "per_order", unitLabel: "per pack",
    });
    expect(created.status).toBe(201);
    expect(created.body.price).toBe(5);

    const patched = await authed("patch", `/api/admin/add-ons/${created.body.id}`).send({
      name: created.body.name, price: 6, unitType: "per_person", suggestFromHeadcount: true,
    });
    expect(patched.body.price).toBe(6);
    expect(patched.body.unitType).toBe("per_person");
    expect(patched.body.suggestFromHeadcount).toBe(true);

    expect((await authed("delete", `/api/admin/add-ons/${created.body.id}`)).body.ok).toBe(true);
    const all = (await request(app).get("/api/add-ons")).body as any[];
    expect(all.some((a) => a.id === created.body.id)).toBe(false);
  });

  it("409s deleting an add-on that is on a past order", async () => {
    const addon = await authed("post", "/api/admin/add-ons").send({
      name: `Used Addon ${Math.floor(Math.random() * 1e6)}`, price: 4, unitType: "per_order",
    });
    const boards = (await request(app).get("/api/platters?category=board")).body as any[];
    await request(app).post("/api/orders").send({
      items: [{ platterId: boards[0].id, quantity: 1 }],
      addOns: [{ addOnId: addon.body.id, quantity: 1 }],
      headcount: 6, collectionOrDeliveryDate: farDate(), locationId,
      customerName: "Addon User", phone: uniqPhone(), email: "au@example.com",
    });
    const res = await authed("delete", `/api/admin/add-ons/${addon.body.id}`);
    expect(res.status).toBe(409);
    // tidy: hide it instead
    await authed("patch", `/api/admin/add-ons/${addon.body.id}`).send({ name: addon.body.name, price: 4, unitType: "per_order", active: false });
  });
});

d("admin edits reflect on the public site", () => {
  let t = "";
  const authed = (method: "get" | "post" | "patch" | "delete", url: string) =>
    request(app)[method](url).set("Authorization", `Bearer ${t}`);

  beforeAll(async () => {
    t = await token();
  });

  it("a board price edit shows on GET /api/platters", async () => {
    const board = ((await authed("get", "/api/admin/platters")).body as any[]).find((p) => p.name === "Small Platter");
    const original = board.fixedPrice;
    const newPrice = original + 7;
    try {
      const patched = await authed("patch", `/api/admin/platters/${board.id}`).send({ ...board, fixedPrice: newPrice });
      expect(patched.status).toBe(200);
      const publicBoard = ((await request(app).get("/api/platters?category=board")).body as any[]).find((p) => p.id === board.id);
      expect(publicBoard.fixedPrice).toBe(newPrice);
    } finally {
      await authed("patch", `/api/admin/platters/${board.id}`).send({ ...board, fixedPrice: original });
    }
  });

  it("a recommender priority change reorders GET /api/recommend", async () => {
    const boards = (await authed("get", "/api/admin/platters")).body as any[];
    const cheese = boards.find((p) => p.name === "Cheese Board");
    const originalPriority = cheese.recommendPriority;
    // Default winner for a 9-cover is the highest-priority mid-9 board (Medium Platter, priority 90).
    const before = (await request(app).get("/api/recommend?headcount=9")).body;
    const beforeTop = before.items[0].board.name;
    try {
      await authed("patch", `/api/admin/platters/${cheese.id}`).send({ ...cheese, recommendPriority: 999 });
      const after = (await request(app).get("/api/recommend?headcount=9")).body;
      expect(after.items[0].board.name).toBe("Cheese Board");
      expect(after.items[0].board.name).not.toBe(beforeTop);
    } finally {
      await authed("patch", `/api/admin/platters/${cheese.id}`).send({ ...cheese, recommendPriority: originalPriority });
    }
  });
});

d("platter delete guard", () => {
  let t = "";
  const authed = (method: "get" | "post" | "patch" | "delete", url: string) =>
    request(app)[method](url).set("Authorization", `Bearer ${t}`);

  beforeAll(async () => {
    t = await token();
  });

  it("deletes a board with no orders; 409s one that has orders", async () => {
    const payload = {
      category: "board", tier: "gallery", name: `Test Board ${Math.floor(Math.random() * 1e6)}`, description: "temp",
      fixedPrice: 30, cost: 10, minHeadcount: 1, feedsMin: 4, feedsMax: 6, items: [{ label: "Thing", qtyPerUnit: 1 }],
    };
    const clean = await authed("post", "/api/admin/platters").send(payload);
    expect(clean.status).toBe(201);
    expect((await authed("delete", `/api/admin/platters/${clean.body.id}`)).body.ok).toBe(true);

    const withOrder = await authed("post", "/api/admin/platters").send({ ...payload, name: `${payload.name} B` });
    const locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;
    await request(app).post("/api/orders").send({
      items: [{ platterId: withOrder.body.id, quantity: 1 }], headcount: 1, collectionOrDeliveryDate: farDate(), locationId,
      customerName: "Blocker", phone: uniqPhone(), email: "b@example.com",
    });
    const res = await authed("delete", `/api/admin/platters/${withOrder.body.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Active toggle/);
    await authed("patch", `/api/admin/platters/${withOrder.body.id}`).send({ ...payload, name: `${payload.name} B`, active: false });
  });
});
