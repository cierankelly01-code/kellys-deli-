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
