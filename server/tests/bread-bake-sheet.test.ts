import { describe, it, expect } from "vitest";
import { buildBakeSheet, type BakeSheetInputOrder } from "../src/lib/bread-bake-sheet";

describe("buildBakeSheet", () => {
  it("totals quantities across orders, preserving first-seen product order", () => {
    const orders: BakeSheetInputOrder[] = [
      { ref: "KDB-AAA111", customerName: "Alice", status: "confirmed", notes: null, items: [
        { name: "White Cob", quantity: 2 },
        { name: "Bloomer", quantity: 1 },
      ] },
      { ref: "KDB-BBB222", customerName: "Bob", status: "pending", notes: "No seeds please", items: [
        { name: "Bloomer", quantity: 3 },
        { name: "Brown Roll (6 pack)", quantity: 1 },
      ] },
    ];
    const sheet = buildBakeSheet(orders);
    expect(sheet.totalOrders).toBe(2);
    expect(sheet.totalItems).toBe(7);
    expect(sheet.lines).toEqual([
      { name: "White Cob", quantity: 2 },
      { name: "Bloomer", quantity: 4 },
      { name: "Brown Roll (6 pack)", quantity: 1 },
    ]);
    expect(sheet.orders).toBe(orders);
  });

  it("returns an empty sheet for no orders", () => {
    const sheet = buildBakeSheet([]);
    expect(sheet).toEqual({ totalOrders: 0, totalItems: 0, lines: [], orders: [] });
  });
});
