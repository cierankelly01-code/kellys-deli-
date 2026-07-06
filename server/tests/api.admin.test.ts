import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
async function setTastingsOpen(open: boolean): Promise<void> {
  const t = await token();
  await request(app).patch("/api/admin/settings/tastingsComingSoon").set("Authorization", `Bearer ${t}`).send({ value: open ? "off" : "on" });
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
  let fixedId = "";
  let locationId = "";
  const phone = uniqPhone();
  const date = farDate();

  beforeAll(async () => {
    t = await token();
    const platters = (await request(app).get("/api/platters")).body as any[];
    fixedId = platters.find((p) => p.isFixed).id;
    locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;
    await request(app).post("/api/orders").send({
      platterId: fixedId, headcount: 10, collectionOrDeliveryDate: date, locationId,
      customerName: "Repeat Customer", phone, email: "repeat@example.com", src: "qr",
    });
  });

  it("finds a returning customer's last order by phone", async () => {
    const res = await request(app).get(`/api/reorder?contact=${phone}`);
    expect(res.status).toBe(200);
    expect(res.body.platterId).toBe(fixedId);
  });

  it("aggregates that day into a prep sheet", async () => {
    const res = await request(app).get(`/api/admin/prep-sheet?locationId=${locationId}&date=${date}`).set("Authorization", `Bearer ${t}`);
    expect(res.status).toBe(200);
    expect(res.body.sheet.totalOrders).toBeGreaterThanOrEqual(1);
    expect(res.body.sheet.lines.length).toBeGreaterThan(0);
  });
});

d("tastings coming soon (default)", () => {
  beforeAll(() => setTastingsOpen(false)); // ensure "coming soon"

  it("categories flags coming soon", async () => {
    expect((await request(app).get("/api/categories")).body.tastingsComingSoon).toBe(true);
  });
  it("blocks booking with 403 while coming soon", async () => {
    const exp = (await request(app).get("/api/experiences")).body[0];
    const loc = (await request(app).get("/api/locations")).body[0];
    const res = await request(app).post("/api/bookings").send({ experienceId: exp.id, partySize: 2, date: farDate(), locationId: loc.id, customerName: "Early", phone: uniqPhone(), email: "e@e.com" });
    expect(res.status).toBe(403);
  });
});

d("board config admin (groups, components, platter delete)", () => {
  let t = "";
  beforeAll(async () => {
    t = await token();
  });
  const authed = (method: "get" | "post" | "patch" | "delete", url: string) =>
    request(app)[method](url).set("Authorization", `Bearer ${t}`);

  it("lists the five fixed group rules", async () => {
    const res = await authed("get", "/api/admin/board-groups");
    expect(res.status).toBe(200);
    const keys = res.body.map((g: any) => g.key).sort();
    expect(keys).toEqual(["cheese", "cracker", "jam", "meat", "savoury"]);
  });

  it("updates group rules and restores them", async () => {
    const meat = (await authed("get", "/api/admin/board-groups")).body.find((g: any) => g.key === "meat");
    const res = await authed("patch", `/api/admin/board-groups/${meat.id}`).send({
      heading: "Test Meats", maxSelections: 2, includedFree: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.heading).toBe("Test Meats");
    expect(res.body.maxSelections).toBe(2);
    expect(res.body.includedFree).toBe(1);
    const restored = await authed("patch", `/api/admin/board-groups/${meat.id}`).send({
      heading: meat.heading, maxSelections: meat.maxSelections ?? null, includedFree: meat.includedFree,
    });
    expect(restored.body.heading).toBe(meat.heading);
  });

  it("rejects invalid group rules (400)", async () => {
    const meat = (await authed("get", "/api/admin/board-groups")).body.find((g: any) => g.key === "meat");
    expect((await authed("patch", `/api/admin/board-groups/${meat.id}`).send({ includedFree: -1 })).status).toBe(400);
  });

  it("creates a component with price + isDefault, updates it, then deletes it", async () => {
    const label = `Test Chilli Jam ${Math.floor(Math.random() * 1e6)}`;
    const created = await authed("post", "/api/admin/board-components").send({
      category: "jam", label, price: 1.25, isDefault: false,
    });
    expect(created.status).toBe(201);
    expect(created.body.price).toBe(1.25);
    expect(created.body.isDefault).toBe(false);

    const patched = await authed("patch", `/api/admin/board-components/${created.body.id}`).send({
      category: "jam", label, price: 2, isDefault: true,
    });
    expect(patched.body.price).toBe(2);
    expect(patched.body.isDefault).toBe(true);

    expect((await authed("delete", `/api/admin/board-components/${created.body.id}`)).body.ok).toBe(true);
    const all = (await authed("get", "/api/admin/board-components")).body as any[];
    expect(all.some((c) => c.id === created.body.id)).toBe(false);
  });

  it("rejects component labels containing commas (400)", async () => {
    const res = await authed("post", "/api/admin/board-components").send({ category: "jam", label: "Fig, Chilli" });
    expect(res.status).toBe(400);
  });

  it("deletes a platter with no orders; 409s one that has orders", async () => {
    const payload = {
      category: "home", name: `Test Platter ${Math.floor(Math.random() * 1e6)}`, description: "temp",
      fixedPrice: 30, cost: 10, minHeadcount: 1, items: [{ label: "Thing", qtyPerUnit: 1 }],
    };
    const clean = await authed("post", "/api/admin/platters").send(payload);
    expect(clean.status).toBe(201);
    expect((await authed("delete", `/api/admin/platters/${clean.body.id}`)).body.ok).toBe(true);

    const withOrder = await authed("post", "/api/admin/platters").send({ ...payload, name: `${payload.name} B` });
    const locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;
    await request(app).post("/api/orders").send({
      platterId: withOrder.body.id, headcount: 1, collectionOrDeliveryDate: farDate(), locationId,
      customerName: "Blocker", phone: uniqPhone(), email: "b@example.com",
    });
    const res = await authed("delete", `/api/admin/platters/${withOrder.body.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Active toggle/);
    // tidy: hide the temp platter (can't delete it now, by design)
    await authed("patch", `/api/admin/platters/${withOrder.body.id}`).send({ ...payload, name: `${payload.name} B`, active: false });
  });
});

d("experience booking + capacity", () => {
  let experience: any;
  let locationId = "";
  const date = farDate();

  beforeAll(async () => {
    await setTastingsOpen(true); // open tastings so bookings work
    experience = ((await request(app).get("/api/experiences")).body as any[])[0];
    locationId = ((await request(app).get("/api/locations")).body as any[])[0].id;
  });
  afterAll(() => setTastingsOpen(false)); // restore "coming soon"

  it("books a session and charges 25% deposit", async () => {
    const res = await request(app).post("/api/bookings").send({
      experienceId: experience.id, partySize: 2, date, locationId,
      customerName: "Taster", phone: uniqPhone(), email: "taste@example.com",
    });
    expect(res.status).toBe(201);
    expect(res.body.order.type).toBe("experience");
    expect(res.body.pricing.total).toBe(experience.pricePerHead * 2);
    expect(res.body.pricing.deposit).toBeCloseTo(experience.pricePerHead * 2 * 0.25, 2);
  });

  it("blocks a booking that exceeds session capacity (409)", async () => {
    const capDate = farDate();
    // fill to capacity
    const res1 = await request(app).post("/api/bookings").send({
      experienceId: experience.id, partySize: experience.capacity, date: capDate, locationId,
      customerName: "Big Party", phone: uniqPhone(), email: "big@example.com",
    });
    expect(res1.status).toBe(201);
    const res2 = await request(app).post("/api/bookings").send({
      experienceId: experience.id, partySize: 1, date: capDate, locationId,
      customerName: "One More", phone: uniqPhone(), email: "one@example.com",
    });
    expect(res2.status).toBe(409);
  });
});
