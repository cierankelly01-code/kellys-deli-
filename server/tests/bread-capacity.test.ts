import { describe, it, expect } from "vitest";
import {
  meetsBreadLeadTime,
  londonWallTimeToUtc,
  isClosedWeekday,
  isOneOffClosure,
  getBreadDayAvailability,
  buildBreadAvailability,
  canBookBread,
  type BreadOrderingSettings,
} from "../src/lib/bread-capacity";

// Fixed "now" for deterministic tests: Mon 1 Jun 2026, 09:00 UTC.
const NOW = new Date("2026-06-01T09:00:00.000Z");

const rolling = (leadTimeHours = 48): BreadOrderingSettings => ({
  leadTimeHours,
  cutoffMode: "rolling",
  cutoffDaysBefore: null,
  cutoffTime: null,
});

const cutoff = (cutoffDaysBefore: number, cutoffTime: string): BreadOrderingSettings => ({
  leadTimeHours: 48,
  cutoffMode: "cutoff",
  cutoffDaysBefore,
  cutoffTime,
});

describe("londonWallTimeToUtc", () => {
  it("treats winter dates as GMT (UTC+0)", () => {
    // 25 Jan 2026 14:00 London (GMT) == 14:00 UTC.
    expect(londonWallTimeToUtc("2026-01-25", "14:00").toISOString()).toBe("2026-01-25T14:00:00.000Z");
  });
  it("treats summer dates as BST (UTC+1)", () => {
    // 15 Jul 2026 14:00 London (BST) == 13:00 UTC.
    expect(londonWallTimeToUtc("2026-07-15", "14:00").toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });
});

describe("meetsBreadLeadTime — rolling mode", () => {
  it("defaults to the configured lead time", () => {
    expect(meetsBreadLeadTime("2026-06-03", NOW, rolling(48))).toBe(false); // 39h
    expect(meetsBreadLeadTime("2026-06-04", NOW, rolling(48))).toBe(true); // 63h
  });
  it("falls back to rolling if cutoff mode is set but incompletely configured", () => {
    const incomplete: BreadOrderingSettings = { leadTimeHours: 24, cutoffMode: "cutoff", cutoffDaysBefore: null, cutoffTime: null };
    expect(meetsBreadLeadTime("2026-06-02", NOW, incomplete)).toBe(false); // ~15h < 24h
    expect(meetsBreadLeadTime("2026-06-03", NOW, incomplete)).toBe(true); // 39h >= 24h
  });
});

describe("meetsBreadLeadTime — cutoff mode", () => {
  // Collection Wed 2026-06-03; cutoff 2 days before at 14:00 London -> Mon 2026-06-01 14:00
  // BST (June is summer time), i.e. 13:00 UTC.
  it("allows an order placed before the cutoff instant", () => {
    const before = new Date("2026-06-01T12:59:00.000Z");
    expect(meetsBreadLeadTime("2026-06-03", before, cutoff(2, "14:00"))).toBe(true);
  });
  it("blocks an order placed after the cutoff instant", () => {
    const after = new Date("2026-06-01T13:01:00.000Z");
    expect(meetsBreadLeadTime("2026-06-03", after, cutoff(2, "14:00"))).toBe(false);
  });
  it("allows exactly at the cutoff instant", () => {
    const at = new Date("2026-06-01T13:00:00.000Z");
    expect(meetsBreadLeadTime("2026-06-03", at, cutoff(2, "14:00"))).toBe(true);
  });
});

describe("isClosedWeekday / isOneOffClosure", () => {
  it("flags recurring closed weekdays (Monday = 1)", () => {
    expect(isClosedWeekday("2026-06-01", [1])).toBe(true); // a Monday
    expect(isClosedWeekday("2026-06-02", [1])).toBe(false); // a Tuesday
  });
  it("flags one-off closure dates", () => {
    expect(isOneOffClosure("2026-12-25", ["2026-12-25", "2026-12-26"])).toBe(true);
    expect(isOneOffClosure("2026-12-27", ["2026-12-25", "2026-12-26"])).toBe(false);
  });
});

describe("getBreadDayAvailability", () => {
  const settings = rolling(48);
  it("reports 'closed' for a recurring closed weekday even with room and lead time met", () => {
    // 2026-06-08 is a Monday, 7+ days out.
    const a = getBreadDayAvailability("2026-06-08", NOW, settings, [1], [], 10, 0);
    expect(a).toEqual({ date: "2026-06-08", bookable: false, reason: "closed", remaining: 10 });
  });
  it("reports 'closed' for a one-off closure date", () => {
    const a = getBreadDayAvailability("2026-06-10", NOW, settings, [], ["2026-06-10"], null, 0);
    expect(a.bookable).toBe(false);
    expect(a.reason).toBe("closed");
  });
  it("reports 'too_soon' inside the lead time", () => {
    const a = getBreadDayAvailability("2026-06-02", NOW, settings, [], [], null, 0);
    expect(a.bookable).toBe(false);
    expect(a.reason).toBe("too_soon");
  });
  it("reports 'full' when capacity is exhausted", () => {
    const a = getBreadDayAvailability("2026-06-10", NOW, settings, [], [], 20, 20);
    expect(a).toEqual({ date: "2026-06-10", bookable: false, reason: "full", remaining: 0 });
  });
  it("is bookable with room to spare, and null remaining means unlimited", () => {
    const a = getBreadDayAvailability("2026-06-10", NOW, settings, [], [], null, 500);
    expect(a).toEqual({ date: "2026-06-10", bookable: true, reason: null, remaining: null });
  });
  it("is bookable with finite capacity remaining", () => {
    const a = getBreadDayAvailability("2026-06-10", NOW, settings, [], [], 20, 15);
    expect(a).toEqual({ date: "2026-06-10", bookable: true, reason: null, remaining: 5 });
  });
});

describe("buildBreadAvailability / canBookBread", () => {
  it("builds a run of days honouring closures and booked quantities", () => {
    const days = buildBreadAvailability("2026-06-08", 3, NOW, rolling(48), [1], [], 10, {
      "2026-06-09": 10,
    });
    expect(days.map((d) => d.date)).toEqual(["2026-06-08", "2026-06-09", "2026-06-10"]);
    expect(days[0].reason).toBe("closed"); // Monday
    expect(days[1].reason).toBe("full"); // booked out
    expect(days[2].bookable).toBe(true);
  });
  it("canBookBread matches getBreadDayAvailability().bookable", () => {
    expect(canBookBread("2026-06-10", NOW, rolling(48), [], [], null, 0)).toBe(true);
    expect(canBookBread("2026-06-01", NOW, rolling(48), [], [], null, 0)).toBe(false);
  });
});
