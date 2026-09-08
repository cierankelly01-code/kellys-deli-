import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

/**
 * Regression guard for the admin-login brute-force limiter.
 *
 * The browse limiter and the login limiter used to share one skip rule, so
 * DISABLE_RATE_LIMIT=1 switched BOTH off. The E2E suite sets that flag alongside
 * NODE_ENV=production, which proved "production" was never what kept the guard on —
 * one stray env var on the live host would have silently opened /api/auth/login to
 * unlimited password guessing. These tests pin the two behaviours apart.
 *
 * Both limiters read process.env per request, so flipping it here is enough; no
 * module reload is needed. Each createApp() gets a fresh in-memory limiter store.
 */

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_DISABLE = process.env.DISABLE_RATE_LIMIT;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_DISABLE === undefined) delete process.env.DISABLE_RATE_LIMIT;
  else process.env.DISABLE_RATE_LIMIT = ORIGINAL_DISABLE;
});

/** Fire n bad logins in sequence; resolve with the statuses seen. */
async function badLogins(app: ReturnType<typeof createApp>, n: number): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@kellysdeli.co.uk", password: `wrong-${i}` });
    out.push(res.status);
  }
  return out;
}

d("admin login rate limiting", () => {
  it("still throttles login when DISABLE_RATE_LIMIT=1 in a production-mode server", async () => {
    process.env.NODE_ENV = "production";
    process.env.DISABLE_RATE_LIMIT = "1";
    const app = createApp();

    // 30 allowed per 15 min; the 31st must be refused.
    const statuses = await badLogins(app, 31);

    expect(statuses.slice(0, 30).every((s) => s === 401)).toBe(true);
    expect(statuses[30]).toBe(429);
  }, 30_000);

  it("does not throttle login under NODE_ENV=test, so the suite can log in freely", async () => {
    process.env.NODE_ENV = "test";
    process.env.DISABLE_RATE_LIMIT = "1";
    const app = createApp();

    const statuses = await badLogins(app, 35);

    expect(statuses.every((s) => s === 401)).toBe(true);
    expect(statuses).not.toContain(429);
  }, 30_000);
});
