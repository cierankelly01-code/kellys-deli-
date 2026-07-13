import { describe, it, expect } from "vitest";
import { suggestAddOnQty, type SuggestableAddOn } from "../src/lib/addons";

const perPerson: SuggestableAddOn = { unitType: "per_person", suggestFromHeadcount: true };
const napkins: SuggestableAddOn = { unitType: "serves", suggestFromHeadcount: true, servesPerUnit: 10 };
const perOrder: SuggestableAddOn = { unitType: "per_order", suggestFromHeadcount: false };

describe("suggestAddOnQty", () => {
  it("suggests one per head for per-person add-ons", () => {
    expect(suggestAddOnQty(perPerson, 15)).toBe(15);
    expect(suggestAddOnQty(perPerson, 1)).toBe(1);
  });

  it("suggests ceil(headcount / servesPerUnit) for 'serves' add-ons", () => {
    expect(suggestAddOnQty(napkins, 15)).toBe(2); // ceil(15/10)
    expect(suggestAddOnQty(napkins, 20)).toBe(2);
    expect(suggestAddOnQty(napkins, 21)).toBe(3);
  });

  it("suggests nothing for per-order add-ons", () => {
    expect(suggestAddOnQty(perOrder, 30)).toBe(0);
  });

  it("suggests nothing when suggestFromHeadcount is off, even per-person", () => {
    expect(suggestAddOnQty({ unitType: "per_person", suggestFromHeadcount: false }, 15)).toBe(0);
  });

  it("suggests nothing for a zero/negative headcount", () => {
    expect(suggestAddOnQty(perPerson, 0)).toBe(0);
    expect(suggestAddOnQty(napkins, -3)).toBe(0);
  });

  it("treats a missing servesPerUnit as 1 (one per head)", () => {
    expect(suggestAddOnQty({ unitType: "serves", suggestFromHeadcount: true }, 8)).toBe(8);
  });
});
