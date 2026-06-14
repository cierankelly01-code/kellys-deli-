import { describe, it, expect } from "vitest";
import {
  getDayAvailability,
  buildAvailability,
  meetsNotice,
  canBook,
  MIN_NOTICE_HOURS,
} from "../src/lib/capacity";

// Fixed "now" for deterministic tests: Mon 1 Jun 2026, 09:00 UTC.
const NOW = new Date("2026-06-01T09:00:00.000Z");

describe("meetsNotice (48h rule)", () => {
  it("rejects dates inside the 48h window", () => {
    expect(meetsNotice("2026-06-01", NOW)).toBe(false); // same day
    expect(meetsNotice("2026-06-02", NOW)).toBe(false); // ~15h away
  });
  it("accepts dates at least 48h out (midnight start)", () => {
    // Wed 3 Jun 00:00 is 39h from Mon 09:00 -> not enough
    expect(meetsNotice("2026-06-03", NOW)).toBe(false);
    // Thu 4 Jun 00:00 is 63h -> enough
    expect(meetsNotice("2026-06-04", NOW)).toBe(true);
  });
  it("uses exactly 48h as the boundary", () => {
    const now = new Date("2026-06-02T00:00:00.000Z");
    expect(meetsNotice("2026-06-04", now)).toBe(true); // exactly 48h
  });
});

describe("getDayAvailability", () => {
  const date = "2026-06-10"; // well outside notice window relative to NOW

  it("is open with plenty of room", () => {
    const a = getDayAvailability(date, 5, 0, NOW);
    expect(a).toMatchObject({ remaining: 5, status: "open", bookable: true });
  });
  it("is limited when 2 or fewer slots remain", () => {
    expect(getDayAvailability(date, 5, 3, NOW).status).toBe("limited"); // 2 left
    expect(getDayAvailability(date, 5, 4, NOW).status).toBe("limited"); // 1 left
  });
  it("is full at capacity and blocks booking", () => {
    const a = getDayAvailability(date, 5, 5, NOW);
    expect(a.remaining).toBe(0);
    expect(a.status).toBe("full");
    expect(a.bookable).toBe(false);
  });
  it("never reports negative remaining if over-booked", () => {
    expect(getDayAvailability(date, 5, 7, NOW).remaining).toBe(0);
  });
  it("is closed (not bookable) inside the notice window even with room", () => {
    const a = getDayAvailability("2026-06-02", 5, 0, NOW);
    expect(a.status).toBe("closed");
    expect(a.bookable).toBe(false);
  });
});

describe("buildAvailability", () => {
  it("produces one entry per day and reflects per-date bookings", () => {
    const booked = { "2026-06-10": 5, "2026-06-11": 3 };
    const days = buildAvailability("2026-06-10", 3, 5, booked, NOW);
    expect(days.map((d) => d.date)).toEqual(["2026-06-10", "2026-06-11", "2026-06-12"]);
    expect(days[0].status).toBe("full"); // 5/5
    expect(days[1].status).toBe("limited"); // 2 left
    expect(days[2].status).toBe("open"); // 0 booked
  });
});

describe("canBook (server gate)", () => {
  it("allows a far date with room", () => {
    expect(canBook("2026-06-10", 5, 4, NOW)).toBe(true);
  });
  it("blocks a full date", () => {
    expect(canBook("2026-06-10", 5, 5, NOW)).toBe(false);
  });
  it("blocks a too-soon date", () => {
    expect(canBook("2026-06-02", 5, 0, NOW)).toBe(false);
  });
});

it("exposes the 48h constant", () => {
  expect(MIN_NOTICE_HOURS).toBe(48);
});
