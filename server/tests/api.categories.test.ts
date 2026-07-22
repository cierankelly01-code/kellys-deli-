// Occasion-category CRUD + admin photo upload. These are the two things the owner
// touches most in the staff area, and both used to fail on ordinary input: a category
// name with a space or an "&" was rejected because the slug had to be hand-typed.
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { slugify } from "../src/lib/validation";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;
const app = createApp();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "owner@kellysdeli.co.uk";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";

const uniq = () => Math.floor(Math.random() * 1e9);

describe("slugify", () => {
  it("turns what the owner types into a usable web address", () => {
    expect(slugify("Office & Corporate")).toBe("office-corporate");
    expect(slugify("  Date Night  ")).toBe("date-night");
    expect(slugify("Kelly's Christmas Boxes!!")).toBe("kellys-christmas-boxes");
    expect(slugify("ALREADY-fine")).toBe("already-fine");
  });
  it("leaves nothing usable when there are no letters or numbers", () => {
    expect(slugify("???")).toBe("");
  });
  it("never returns a slug that ends in a hyphen, even when truncated", () => {
    const long = slugify(`${"a".repeat(59)} b`);
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("-")).toBe(false);
  });
});

d("admin categories", () => {
  let t = "";
  beforeAll(async () => {
    t = (await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).body.token;
  });
  const authed = (method: "post" | "patch" | "delete" | "put", url: string) =>
    (request(app) as any)[method](url).set("Authorization", `Bearer ${t}`);

  const payload = (over: Record<string, unknown> = {}) => ({
    slug: `test-${uniq()}`,
    name: `Test Category ${uniq()}`,
    tagline: "",
    description: "",
    heroImageUrl: "",
    seoTitle: "",
    seoDescription: "",
    isCorporate: false,
    promotePlanner: false,
    active: true,
    sortOrder: 0,
    ...over,
  });

  it("creates, renames and deletes a category", async () => {
    const created = await authed("post", "/api/admin/categories").send(payload());
    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();

    const renamed = await authed("patch", `/api/admin/categories/${created.body.id}`)
      .send(payload({ slug: created.body.slug, name: "Renamed Category" }));
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("Renamed Category");

    expect((await authed("delete", `/api/admin/categories/${created.body.id}`)).status).toBe(200);
  });

  // The reported bug: a plain English name typed into the web-address box 400'd.
  it("accepts a human-typed web address and normalises it", async () => {
    const n = uniq();
    const created = await authed("post", "/api/admin/categories").send(
      payload({ slug: `Office & Corporate ${n}`, name: `Office & Corporate ${n}` }),
    );
    expect(created.status).toBe(201);
    expect(created.body.slug).toBe(`office-corporate-${n}`);
    await authed("delete", `/api/admin/categories/${created.body.id}`);
  });

  it("trims the name rather than saving the padding", async () => {
    const created = await authed("post", "/api/admin/categories").send(payload({ name: "  Padded Name  " }));
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Padded Name");
    await authed("delete", `/api/admin/categories/${created.body.id}`);
  });

  it("rejects a web address with nothing usable in it", async () => {
    const res = await authed("post", "/api/admin/categories").send(payload({ slug: "???" }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/web address/i);
  });

  it("refuses a duplicate web address with a readable message", async () => {
    const first = await authed("post", "/api/admin/categories").send(payload());
    expect(first.status).toBe(201);
    const clash = await authed("post", "/api/admin/categories").send(payload({ slug: first.body.slug }));
    expect(clash.status).toBe(409);
    expect(clash.body.error).toMatch(/already exists/i);
    await authed("delete", `/api/admin/categories/${first.body.id}`);
  });

  it("assigns boards to a category and reports them back", async () => {
    const boards = (await request(app).get("/api/platters?category=board")).body as any[];
    const created = await authed("post", "/api/admin/categories").send(payload());
    const assigned = await authed("put", `/api/admin/categories/${created.body.id}/boards`)
      .send({ platterIds: [boards[0].id] });
    expect(assigned.status).toBe(200);
    expect(assigned.body.boards.map((b: any) => b.id)).toEqual([boards[0].id]);
    await authed("delete", `/api/admin/categories/${created.body.id}`);
  });
});

d("admin photo upload", () => {
  let t = "";
  beforeAll(async () => {
    t = (await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).body.token;
  });

  // Smallest possible valid PNG.
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  it("accepts an image and hands back a usable URL", async () => {
    const res = await request(app)
      .post("/api/admin/upload")
      .set("Authorization", `Bearer ${t}`)
      .attach("image", PNG, { filename: "photo.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^(\/uploads\/|https?:\/\/)/);
  });

  it("rejects a non-image with an explanation", async () => {
    const res = await request(app)
      .post("/api/admin/upload")
      .set("Authorization", `Bearer ${t}`)
      .attach("image", Buffer.from("not an image"), { filename: "notes.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image/i);
  });

  it("needs a login", async () => {
    const res = await request(app).post("/api/admin/upload").attach("image", PNG, { filename: "photo.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });
});
