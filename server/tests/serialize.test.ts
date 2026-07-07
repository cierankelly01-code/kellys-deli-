import { describe, it, expect } from "vitest";
import { maskPhone, maskEmail } from "../src/lib/serialize";

// Locks the PII-masking used by the public order lookup (GET /orders/:ref).
// A leaked reference link must never expose full contact details.
describe("maskPhone", () => {
  it("keeps only the last 3 digits", () => {
    expect(maskPhone("07700900123")).toBe("•••••123");
  });
  it("strips non-digits before masking", () => {
    expect(maskPhone("+44 7700 900 456")).toBe("•••••456");
  });
  it("never returns the raw number", () => {
    const raw = "07123456789";
    expect(maskPhone(raw)).not.toBe(raw);
    expect(maskPhone(raw)).not.toContain("456789");
  });
  it("degrades safely on junk input", () => {
    expect(maskPhone("x")).toBe("•••");
    expect(maskPhone("")).toBe("•••");
  });
});

describe("maskEmail", () => {
  it("keeps first char and full domain, masks the rest of the local part", () => {
    expect(maskEmail("jsmith@gmail.com")).toBe("j•••••@gmail.com");
  });
  it("never leaks the full local part", () => {
    const raw = "charlotte@example.co.uk";
    const masked = maskEmail(raw);
    expect(masked).not.toContain("charlotte");
    expect(masked.endsWith("@example.co.uk")).toBe(true);
  });
  it("degrades safely with no @", () => {
    expect(maskEmail("notanemail")).toBe("•••");
  });
});
