import { describe, it, expect } from "vitest";
import { profitOf, summarizeOrders, rankPlattersByMargin, type StatOrderInput } from "../src/lib/stats";

const o = (over: Partial<StatOrderInput>): StatOrderInput => ({
  total: 175,
  cost: 85,
  isFixed: true,
  headcount: 18,
  platterId: "p-gathering",
  platterName: "The Gathering",
  locationId: "loc-henley",
  locationName: "Henley-in-Arden",
  src: "direct",
  ...over,
});

describe("profitOf", () => {
  it("fixed platter: revenue minus flat cost", () => {
    expect(profitOf(o({}))).toBe(90);
  });
  it("per-head platter: cost scales by headcount", () => {
    expect(profitOf(o({ isFixed: false, total: 85, cost: 3.4, headcount: 10 }))).toBe(51);
  });
});

describe("summarizeOrders", () => {
  it("aggregates combined, by location, by src and by platter", () => {
    const orders = [
      o({ locationId: "loc-henley", locationName: "Henley-in-Arden", src: "qr" }),
      o({ locationId: "loc-henley", locationName: "Henley-in-Arden", src: "direct" }),
      o({
        locationId: "loc-bentley",
        locationName: "Bentley Heath",
        src: "qr",
        platterId: "p-office",
        platterName: "The Office Lunch",
        isFixed: false,
        total: 85,
        cost: 3.4,
        headcount: 10,
      }),
    ];
    const s = summarizeOrders(orders);

    expect(s.combined).toEqual({ revenue: 435, profit: 231, orders: 3 }); // 175+175+85 ; 90+90+51
    expect(s.byLocation.find((l) => l.locationId === "loc-henley")).toMatchObject({ revenue: 350, profit: 180, orders: 2 });
    expect(s.bySrc.find((x) => x.src === "qr")).toMatchObject({ orders: 2, revenue: 260 });
    expect(s.byPlatter[0].profit).toBeGreaterThanOrEqual(s.byPlatter[1].profit); // sorted desc
  });
});

describe("rankPlattersByMargin", () => {
  it("ranks by margin percent, best first", () => {
    const rows = rankPlattersByMargin([
      { id: "p-office", name: "The Office Lunch", pricePerHead: 8.5, fixedPrice: null, cost: 3.4 }, // 60%
      { id: "p-gathering", name: "The Gathering", pricePerHead: null, fixedPrice: 175, cost: 85 }, // 51%
    ]);
    expect(rows[0].id).toBe("p-office");
    expect(rows[0].marginPct).toBe(60);
    expect(rows[0].basis).toBe("per-head");
    expect(rows[1].marginPct).toBe(51);
  });
});
