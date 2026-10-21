// The opening-hours line shows in the header, footer and on the homepage, so its wording
// is checked directly: plain sentences, no "A · B" strings.
import { describe, it, expect } from "vitest";
import { openStatus } from "./hours";
import type { OpeningHours } from "./api";

const hours = {
  mon: "9:00 - 17:00", tue: "9:00 - 17:00", wed: "9:00 - 17:00", thu: "9:00 - 17:00",
  fri: "9:00 - 17:00", sat: "9:00 - 16:00", sun: "Closed",
} as OpeningHours;

// 21 October 2026 is a Wednesday.
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);

describe("openStatus", () => {
  it("says when the shop closes while it is open", () => {
    expect(openStatus(hours, at(21, 12))).toEqual({ open: true, text: "Open now, closes 17:00" });
  });

  it("says when it opens later today", () => {
    expect(openStatus(hours, at(21, 7, 30))).toEqual({ open: false, text: "Closed, opens today 9:00" });
  });

  it("names the next opening day after hours", () => {
    expect(openStatus(hours, at(21, 18))).toEqual({ open: false, text: "Closed, opens Thu 9:00" });
  });

  it("skips a closed day", () => {
    // Saturday evening: Sunday is closed, so the next opening is Monday.
    expect(openStatus(hours, at(24, 17))).toEqual({ open: false, text: "Closed, opens Mon 9:00" });
  });

  it("never uses a middle dot", () => {
    for (const d of [at(21, 12), at(21, 7), at(21, 18), at(25, 12)]) expect(openStatus(hours, d).text).not.toContain("·");
  });
});
