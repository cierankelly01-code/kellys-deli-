// Sizes & options: the shop shows one tile per product and the size is chosen on the product
// page. That only works if the API ships a board's siblings with it, and if the owner can
// group and — crucially — ungroup boards from the admin panel.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;
const app = createApp();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";

const boardPayload = (over: Record<string, unknown> = {}) => ({
  category: "board",
  name: `Test Board ${Math.floor(Math.random() * 1e9)}`,
  description: "A board used by the automated tests.",
  fixedPrice: 40,
  cost: 12,
  serves: "8-10",
  minHeadcount: 1,
  items: [],
  tier: "gallery",
  ...over,
});

d("sizes & options", () => {
  let token = "";
  const created: string[] = [];
  const auth = (m: "post" | "patch" | "delete", url: string) =>
    request(app)[m](url).set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    token = (await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).body.token;
  });

  const newBoard = async (over: Record<string, unknown> = {}) => {
    const res = await auth("post", "/api/admin/platters").send(boardPayload(over));
    expect(res.status).toBe(201);
    created.push(res.body.id);
    return res.body;
  };

  it("ships a board's other sizes with it, in the owner's order", async () => {
    const group = `test-group-${Math.floor(Math.random() * 1e9)}`;
    const large = await newBoard({ fixedPrice: 42, variantGroup: group, variantLabel: "Large — feeds 10-15", variantOrder: 0 });
    await newBoard({ fixedPrice: 22.5, variantGroup: group, variantLabel: "Small — feeds 2-4", variantOrder: 1 });

    const res = await request(app).get(`/api/platters/${large.id}`);
    expect(res.status).toBe(200);
    expect(res.body.variants.map((v: { variantLabel: string }) => v.variantLabel))
      .toEqual(["Large — feeds 10-15", "Small — feeds 2-4"]);
    // The small one is reachable from the large one's page, which is the whole point.
    expect(res.body.variants.map((v: { fixedPrice: number }) => v.fixedPrice)).toEqual([42, 22.5]);
  });

  it("sends no variants for a board sold on its own, so no picker appears", async () => {
    const solo = await newBoard();
    const res = await request(app).get(`/api/platters/${solo.id}`);
    expect(res.body.variants).toEqual([]);
  });

  it("hides a switched-off size from the picker rather than offering an unbuyable board", async () => {
    const group = `test-group-${Math.floor(Math.random() * 1e9)}`;
    const live = await newBoard({ variantGroup: group, variantLabel: "Large", variantOrder: 0 });
    const hidden = await newBoard({ variantGroup: group, variantLabel: "Small", variantOrder: 1 });
    await auth("patch", `/api/admin/platters/${hidden.id}`).send(boardPayload({
      name: hidden.name, variantGroup: group, variantLabel: "Small", variantOrder: 1, active: false,
    }));

    const res = await request(app).get(`/api/platters/${live.id}`);
    expect(res.body.variants.map((v: { id: string }) => v.id)).toEqual([live.id]);
  });

  it("lets the owner take a board back out of a group", async () => {
    const group = `test-group-${Math.floor(Math.random() * 1e9)}`;
    const b = await newBoard({ variantGroup: group, variantLabel: "Large", variantOrder: 0 });

    const res = await auth("patch", `/api/admin/platters/${b.id}`).send(boardPayload({
      name: b.name, variantGroup: null, variantLabel: null,
    }));
    expect(res.status).toBe(200);
    expect(res.body.variantGroup).toBeNull();
    expect((await request(app).get(`/api/platters/${b.id}`)).body.variants).toEqual([]);
  });

  it("refuses a grouped board with no label, which would render an unnamed button", async () => {
    const res = await auth("post", "/api/admin/platters").send(boardPayload({ variantGroup: "g", variantLabel: "  " }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/label/i);
  });

  it("leaves the group alone when an unrelated edit omits the fields", async () => {
    const group = `test-group-${Math.floor(Math.random() * 1e9)}`;
    const b = await newBoard({ variantGroup: group, variantLabel: "Large", variantOrder: 0 });
    // boardPayload carries no variant fields unless asked, so this is a save that simply
    // doesn't mention them — e.g. a price edit from the quick row.
    const res = await auth("patch", `/api/admin/platters/${b.id}`).send(boardPayload({ name: b.name }));
    expect(res.status).toBe(200);
    expect(res.body.variantGroup).toBe(group);
    expect(res.body.variantLabel).toBe("Large");
  });

  afterAll(async () => {
    for (const id of created) await auth("delete", `/api/admin/platters/${id}`);
  });
});
