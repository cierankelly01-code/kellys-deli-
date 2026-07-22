// The shop's tile count depends entirely on this grouping, so it gets tested directly:
// a bug here either duplicates products (the thing we're removing) or hides them.
import { describe, it, expect } from "vitest";
import { groupVariants, groupServes, pickerHeading } from "./variants";
import type { Platter } from "./api";

const board = (p: Partial<Platter> & { id: string }): Platter => ({
  category: "board",
  name: p.id,
  description: "",
  pricePerHead: null,
  fixedPrice: null,
  serves: null,
  minHeadcount: 1,
  items: [],
  imageUrl: null,
  active: true,
  sortOrder: 0,
  isFixed: true,
  fromPrice: 0,
  boardType: null,
  size: null,
  tier: "gallery",
  feedsMin: null,
  feedsMax: null,
  recommendEligible: false,
  recommendPriority: 0,
  variantGroup: null,
  variantLabel: null,
  variantOrder: 0,
  ...p,
} as Platter);

describe("groupVariants", () => {
  it("collapses the sizes of one board into a single tile", () => {
    const groups = groupVariants([
      board({ id: "salmon-sm", fixedPrice: 22.5, variantGroup: "salmon", variantLabel: "Small", variantOrder: 1 }),
      board({ id: "salmon-lg", fixedPrice: 42, variantGroup: "salmon", variantLabel: "Large", variantOrder: 0 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].lead.id).toBe("salmon-lg"); // variantOrder 0 fronts the tile
    expect(groups[0].fromPrice).toBe(22.5); // "From £22.50" quotes the cheapest
    expect(groups[0].hasChoice).toBe(true);
  });

  it("leaves ungrouped boards as their own product", () => {
    const groups = groupVariants([board({ id: "a", fixedPrice: 10 }), board({ id: "b", fixedPrice: 20 })]);
    expect(groups.map((g) => g.lead.id)).toEqual(["a", "b"]);
    expect(groups.every((g) => !g.hasChoice)).toBe(true);
  });

  it("keeps the shop's own ordering — a group sits where its lead sat", () => {
    const groups = groupVariants([
      board({ id: "first" }),
      board({ id: "salmon-lg", variantGroup: "salmon", variantOrder: 0 }),
      board({ id: "last" }),
      board({ id: "salmon-sm", variantGroup: "salmon", variantOrder: 1 }),
    ]);
    expect(groups.map((g) => g.lead.id)).toEqual(["first", "salmon-lg", "last"]);
  });

  it("falls back to the dearest board when the owner hasn't set an order", () => {
    const groups = groupVariants([
      board({ id: "sm", fixedPrice: 17.5, variantGroup: "g" }),
      board({ id: "lg", fixedPrice: 38, variantGroup: "g" }),
    ]);
    expect(groups[0].lead.id).toBe("lg");
  });

  it("prices a per-head board off its from-price rather than reading £0", () => {
    const groups = groupVariants([board({ id: "office", fixedPrice: null, fromPrice: 85 })]);
    expect(groups[0].fromPrice).toBe(85);
  });
});

describe("groupServes", () => {
  it("spans the whole range a customer is choosing between", () => {
    expect(groupServes([board({ id: "a", serves: "2-4" }), board({ id: "b", serves: "10-15" })])).toBe("2-15");
  });

  it("reads low-to-high even though the biggest size is listed first", () => {
    // The tile leads with the large board, so the raw order is 12-15 then 4-6.
    expect(groupServes([board({ id: "lg", serves: "12-15" }), board({ id: "sm", serves: "4-6" })])).toBe("4-15");
  });

  it("copes with a size described in words", () => {
    expect(groupServes([board({ id: "a", serves: "up to 20" }), board({ id: "b", serves: "6-8" })])).toBe("6-20");
  });

  it("doesn't repeat itself when every size feeds the same", () => {
    expect(groupServes([board({ id: "a", serves: "8-10" }), board({ id: "b", serves: "8-10" })])).toBe("8-10");
  });

  it("returns nothing when no size says who it feeds", () => {
    expect(groupServes([board({ id: "a" })])).toBeNull();
  });
});

describe("pickerHeading", () => {
  it("says 'size' when the options are sizes", () => {
    expect(pickerHeading([board({ id: "a", variantLabel: "Small — feeds 2-4" }), board({ id: "b", variantLabel: "Large" })]))
      .toBe("Choose your size");
  });

  it("avoids claiming 'size' when the owner is offering different toppings", () => {
    expect(pickerHeading([board({ id: "a", variantLabel: "With chilli jam" }), board({ id: "b", variantLabel: "With honey" })]))
      .toBe("Choose your option");
  });
});
