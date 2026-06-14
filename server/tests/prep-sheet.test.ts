import { describe, it, expect } from "vitest";
import { buildPrepSheet, type PrepInputOrder } from "../src/lib/prep-sheet";

const officeItems = [
  { label: "Sandwiches", qtyPerUnit: 1.5 },
  { label: "Sausage rolls", qtyPerUnit: 1 },
  { label: "Veg & lamb samosas", qtyPerUnit: 1 },
];
const gatheringItems = [
  { label: "Sandwiches", qtyPerUnit: 40 },
  { label: "Sausage rolls", qtyPerUnit: 25 },
  { label: "Veg & lamb samosas", qtyPerUnit: 20 },
  { label: "Crusty cobs", qtyPerUnit: 15 },
];

function office(ref: string, headcount: number): PrepInputOrder {
  return { ref, platterName: "The Office Lunch", isFixed: false, headcount, items: officeItems };
}
function gathering(ref: string): PrepInputOrder {
  return { ref, platterName: "The Gathering", isFixed: true, headcount: 18, items: gatheringItems };
}

describe("buildPrepSheet", () => {
  it("returns an empty sheet for no orders", () => {
    expect(buildPrepSheet([])).toEqual({ totalOrders: 0, totalHeadcount: 0, lines: [], byPlatter: [] });
  });

  it("scales per-head items by headcount", () => {
    const sheet = buildPrepSheet([office("KD-A", 10)]);
    // 1.5*10 = 15 sandwiches, 1*10 = 10 each of the rest
    expect(sheet.lines).toEqual([
      { label: "Sandwiches", quantity: 15 },
      { label: "Sausage rolls", quantity: 10 },
      { label: "Veg & lamb samosas", quantity: 10 },
    ]);
    expect(sheet.totalHeadcount).toBe(10);
  });

  it("treats fixed platters as one unit regardless of headcount", () => {
    const sheet = buildPrepSheet([gathering("KD-B")]);
    expect(sheet.lines.find((l) => l.label === "Sandwiches")!.quantity).toBe(40);
    expect(sheet.lines.find((l) => l.label === "Crusty cobs")!.quantity).toBe(15);
  });

  it("rounds fractional sandwich totals UP", () => {
    // 1.5 * 23 = 34.5 -> 35
    const sheet = buildPrepSheet([office("KD-C", 23)]);
    expect(sheet.lines.find((l) => l.label === "Sandwiches")!.quantity).toBe(35);
  });

  it("aggregates a mixed day across platters by label (worked example)", () => {
    const sheet = buildPrepSheet([office("KD-A", 10), office("KD-C", 23), gathering("KD-B")]);
    // Sandwiches: 1.5*10 + 1.5*23 + 40 = 15 + 34.5 + 40 = 89.5 -> 90
    // Sausage rolls: 10 + 23 + 25 = 58
    // Samosas: 10 + 23 + 20 = 53
    // Crusty cobs: only from gathering = 15
    const get = (label: string) => sheet.lines.find((l) => l.label === label)!.quantity;
    expect(get("Sandwiches")).toBe(90);
    expect(get("Sausage rolls")).toBe(58);
    expect(get("Veg & lamb samosas")).toBe(53);
    expect(get("Crusty cobs")).toBe(15);

    expect(sheet.totalOrders).toBe(3);
    expect(sheet.totalHeadcount).toBe(10 + 23 + 18);
  });

  it("preserves first-seen label order and summarises by platter", () => {
    const sheet = buildPrepSheet([office("KD-A", 10), gathering("KD-B")]);
    // Office's labels appear first; Crusty cobs (new in gathering) comes after.
    expect(sheet.lines.map((l) => l.label)).toEqual([
      "Sandwiches",
      "Sausage rolls",
      "Veg & lamb samosas",
      "Crusty cobs",
    ]);
    expect(sheet.byPlatter).toEqual([
      { platterName: "The Office Lunch", orders: 1, headcount: 10 },
      { platterName: "The Gathering", orders: 1, headcount: 18 },
    ]);
  });
});
