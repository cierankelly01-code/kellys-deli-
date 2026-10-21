import { describe, expect, it } from "vitest";
import { orderWindowError } from "../src/lib/preorder";
import { buildSupplierSheet, IN_HOUSE, type SupplierSheetInputLine } from "../src/lib/supplier-sheet";

const ham = {
  name: "Wiltshire Ham",
  orderBy: new Date("2026-12-16T23:59:00Z"),
  collectFrom: new Date("2026-12-01T00:00:00Z"),
  collectTo: new Date("2026-12-24T00:00:00Z"),
};

describe("pre-order windows", () => {
  it("accepts a date inside the window before the deadline", () => {
    expect(orderWindowError(ham, "2026-12-20", new Date("2026-11-01T10:00:00Z"))).toBeNull();
  });
  it("rejects once the order-by deadline has passed", () => {
    expect(orderWindowError(ham, "2026-12-20", new Date("2026-12-17T00:00:01Z"))).toMatch(/closed/);
  });
  it("rejects collection before the window opens", () => {
    expect(orderWindowError(ham, "2026-11-30", new Date("2026-11-01T10:00:00Z"))).toMatch(/from 1 December/);
  });
  it("rejects collection after the window closes", () => {
    expect(orderWindowError(ham, "2026-12-27", new Date("2026-11-01T10:00:00Z"))).toMatch(/by 24 December/);
  });
  it("leaves year-round products alone", () => {
    expect(orderWindowError({ name: "Board", orderBy: null, collectFrom: null, collectTo: null }, "2027-03-01", new Date())).toBeNull();
  });
});

const line = (over: Partial<SupplierSheetInputLine>): SupplierSheetInputLine => ({
  orderRef: "KD-1", collectionDate: "2026-12-23", quantity: 1, platterId: "ham", name: "Wiltshire Ham",
  variantLabel: "2kg joint", unitLabel: "approx 2kg", supplierName: "Brakes", supplierSku: "W2", supplierUrl: null,
  unitCost: 20, leadTimeHours: 72, ...over,
});

describe("supplier order sheet", () => {
  it("adds up the same product across orders and keeps the earliest deadline", () => {
    const [g] = buildSupplierSheet([
      line({ orderRef: "KD-1", quantity: 2, collectionDate: "2026-12-23" }),
      line({ orderRef: "KD-2", quantity: 3, collectionDate: "2026-12-20" }),
    ]);
    expect(g.supplier).toBe("Brakes");
    expect(g.products).toHaveLength(1);
    expect(g.products[0].quantity).toBe(5);
    expect(g.products[0].name).toBe("Wiltshire Ham — 2kg joint");
    expect(g.products[0].firstCollection).toBe("2026-12-20");
    expect(g.products[0].orderFromSupplierBy).toBe("2026-12-17"); // 72h before the 20th
    expect(g.estCost).toBe(100);
    expect(g.products[0].orderRefs).toEqual(["KD-1", "KD-2"]);
  });
  it("puts lines with no supplier in the in-house list, last", () => {
    const groups = buildSupplierSheet([line({ supplierName: null, platterId: "pie" }), line({})]);
    expect(groups.map((g) => g.supplier)).toEqual(["Brakes", IN_HOUSE]);
    expect(groups[1].inHouse).toBe(true);
  });
  it("orders suppliers most-urgent first", () => {
    const groups = buildSupplierSheet([
      line({ supplierName: "Booker", platterId: "a", collectionDate: "2026-12-23" }),
      line({ supplierName: "Brakes", platterId: "b", collectionDate: "2026-12-10" }),
    ]);
    expect(groups.map((g) => g.supplier)).toEqual(["Brakes", "Booker"]);
  });
});
