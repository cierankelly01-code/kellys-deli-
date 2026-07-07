import { describe, it, expect } from "vitest";
import { genRef, randomReferralCode } from "../src/lib/ref";

// Order refs gate the unauthenticated order lookup, so they must be well-formed
// and non-colliding. (Cryptographic randomness is used under the hood.)
describe("genRef", () => {
  it("matches the KD-XXXXXX format with unambiguous chars only", () => {
    for (let i = 0; i < 50; i++) expect(genRef()).toMatch(/^KD-[2-9A-HJ-NP-Z]{6}$/);
  });
  it("does not collide across a large sample", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(genRef());
    expect(seen.size).toBe(5000);
  });
});

describe("randomReferralCode", () => {
  it("matches the KELLY-XXXXXX format", () => {
    expect(randomReferralCode()).toMatch(/^KELLY-[2-9A-HJ-NP-Z]{6}$/);
  });
});
