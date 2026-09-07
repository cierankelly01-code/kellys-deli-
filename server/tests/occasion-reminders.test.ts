import { describe, it, expect } from "vitest";
import { reminderDueAt, occasionReminderSchema, cancelToken, verifyCancelToken } from "../src/lib/occasion-reminders";
describe("occasion reminders", () => {
  it("requires explicit consent", () => {
    expect(occasionReminderSchema.safeParse({ email: "person@example.com", occasion: "A birthday", reminderDate: "2027-05-01" }).success).toBe(false);
  });
  it("rejects impossible dates and invalid SMS numbers", () => {
    expect(occasionReminderSchema.safeParse({ occasion: "A birthday", reminderDate: "2027-02-30", smsConsent: true, phone: "123" }).success).toBe(false);
  });
  it("calculates the requested advance notice", () => {
    expect(reminderDueAt("2027-05-01", 14, new Date("2027-01-01")).toISOString()).toBe("2027-04-17T12:00:00.000Z");
  });
  it("rejects past reminder dates", () => {
    expect(() => reminderDueAt("2027-05-01", 14, new Date("2027-04-30"))).toThrow();
  });
  it("rejects forged cancellation links", () => {
    const token = cancelToken("example");
    expect(verifyCancelToken(token)).toBe("example");
    expect(verifyCancelToken(token.replace("example", "different"))).toBeNull();
  });
});
