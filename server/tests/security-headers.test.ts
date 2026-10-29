import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("security headers", () => {
  it("sends a deny-by-default Permissions-Policy alongside the CSP", async () => {
    const res = await request(createApp()).get("/api/__no-such-route__");
    expect(res.headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    expect(res.headers["content-security-policy"]).toMatch(/default-src '(self|none)'/);
  });
});
