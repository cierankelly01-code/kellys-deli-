import { describe, expect, it } from "vitest";
import { bestBundleDiscount } from "../src/lib/bundle-discount";
const board = { kind: "board", refId: "b", quantity: 1 };
const extra = { kind: "addon", refId: "a", quantity: 1 };
const offer = { id: "offer", name: "The weekend", discountPct: 10, items: [board, extra] };
describe("complete bundle savings", () => {
  it("ignores legacy extras-only bundles, matching the public catalogue", () => {
    expect(bestBundleDiscount([{ ...offer, items: [extra] }], [{ ...board, price: 100 }, { ...extra, price: 10 }]).amount).toBe(0);
  });
  it("does not discount a missing component", () => {
    expect(bestBundleDiscount([offer], [{ ...board, price: 100 }]).amount).toBe(0);
  });
  it("discounts complete copies only, not unrelated items", () => {
    expect(bestBundleDiscount([offer], [{ ...board, quantity: 3, price: 100 }, { ...extra, quantity: 2, price: 10 }]).amount).toBe(22);
  });
  it("chooses the best offer without stacking", () => {
    expect(bestBundleDiscount([offer, { ...offer, discountPct: 20 }], [{ ...board, price: 100 }, { ...extra, price: 10 }]).amount).toBe(22);
  });
  it("aggregates repeated requirements", () => {
    expect(bestBundleDiscount([{ ...offer, items: [board, board] }], [{ ...board, price: 100 }]).amount).toBe(0);
  });
});
