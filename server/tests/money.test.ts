import { describe, it, expect } from "vitest";
import {
  toMoney,
  calcTotal,
  calcDeposit,
  calcBoardDeposit,
  calcBoardExtras,
  applyReferral,
  calcMargin,
  orderProfit,
  priceOrder,
  roundTo5p,
  lineItemsTotal,
  addOnsTotal,
  priceLineItemOrder,
  REFERRAL_DISCOUNT,
  BOARD_DEPOSIT,
} from "../src/lib/money";

describe("toMoney", () => {
  it("rounds to 2dp and avoids float drift", () => {
    expect(toMoney(8.5 * 3)).toBe(25.5);
    expect(toMoney(0.1 + 0.2)).toBe(0.3);
    expect(toMoney(175)).toBe(175);
  });
  it("rounds genuine half-pennies UP, not down", () => {
    // 8.70 * 0.25 = 2.174999… in float; must round to 2.18, not 2.17.
    expect(toMoney(8.7 * 0.25)).toBe(2.18);
    expect(toMoney(16.9 * 0.25)).toBe(4.23);
    expect(toMoney(8.54 * 0.25)).toBe(2.14);
  });
});

describe("calcDeposit half-penny rounding", () => {
  it("never undercharges the 25% deposit by a penny", () => {
    // Regression: the old absolute-epsilon toMoney rounded these down by 1p.
    expect(calcDeposit(8.7)).toBe(2.18);
    expect(calcDeposit(16.9)).toBe(4.23);
    expect(calcDeposit(8.54)).toBe(2.14);
  });
});

describe("calcTotal", () => {
  it("multiplies per-head price by headcount", () => {
    expect(calcTotal({ pricePerHead: 8.5, fixedPrice: null }, 10)).toBe(85);
    expect(calcTotal({ pricePerHead: 8.5, fixedPrice: null }, 23)).toBe(195.5);
  });
  it("uses fixed price regardless of headcount", () => {
    expect(calcTotal({ pricePerHead: null, fixedPrice: 175 }, 20)).toBe(175);
    expect(calcTotal({ pricePerHead: null, fixedPrice: 350 }, 1)).toBe(350);
  });
  it("prefers fixed price when both are present", () => {
    expect(calcTotal({ pricePerHead: 8.5, fixedPrice: 175 }, 10)).toBe(175);
  });
  it("throws when neither price is set", () => {
    expect(() => calcTotal({ pricePerHead: null, fixedPrice: null }, 10)).toThrow();
  });
  it("multiplies fixed price by quantity (board configurator)", () => {
    expect(calcTotal({ pricePerHead: null, fixedPrice: 45 }, 1, 2)).toBe(90);
    expect(calcTotal({ pricePerHead: null, fixedPrice: 45 }, 1, 1)).toBe(45);
  });
  it("ignores quantity for per-head platters", () => {
    expect(calcTotal({ pricePerHead: 8.5, fixedPrice: null }, 10, 3)).toBe(85);
  });
});

describe("calcBoardDeposit", () => {
  it("is a flat £25 regardless of order size", () => {
    expect(calcBoardDeposit(45)).toBe(BOARD_DEPOSIT);
    expect(calcBoardDeposit(120)).toBe(BOARD_DEPOSIT);
  });
  it("caps at the order total for small orders", () => {
    expect(calcBoardDeposit(10)).toBe(10);
  });
});

describe("calcDeposit", () => {
  it("is 25% of the total", () => {
    expect(calcDeposit(85)).toBe(21.25);
    expect(calcDeposit(175)).toBe(43.75);
    expect(calcDeposit(350)).toBe(87.5);
  });
});

describe("applyReferral", () => {
  it("knocks £15 off when valid", () => {
    expect(applyReferral(175, true)).toBe(175 - REFERRAL_DISCOUNT);
    expect(applyReferral(85, true)).toBe(70);
  });
  it("is a no-op when invalid", () => {
    expect(applyReferral(175, false)).toBe(175);
  });
  it("never goes below zero", () => {
    expect(applyReferral(10, true)).toBe(0);
  });
  it("deposit recomputes on the discounted total", () => {
    const discounted = applyReferral(175, true); // 160
    expect(calcDeposit(discounted)).toBe(40);
  });
});

describe("calcMargin", () => {
  it("computes profit and margin percent", () => {
    expect(calcMargin(175, 85)).toEqual({ profit: 90, marginPct: 51 });
    expect(calcMargin(8.5, 3.4)).toEqual({ profit: 5.1, marginPct: 60 });
    expect(calcMargin(350, 170)).toEqual({ profit: 180, marginPct: 51 });
  });
  it("handles zero price without dividing by zero", () => {
    expect(calcMargin(0, 5)).toEqual({ profit: -5, marginPct: 0 });
  });
});

describe("priceOrder", () => {
  it("prices a per-head order with no referral", () => {
    expect(priceOrder({ pricePerHead: 8.5, fixedPrice: null }, 10, false)).toEqual({
      base: 85,
      discount: 0,
      total: 85,
      deposit: 21.25,
    });
  });
  it("prices a fixed order with a referral discount and recomputes the deposit", () => {
    expect(priceOrder({ pricePerHead: null, fixedPrice: 175 }, 18, true)).toEqual({
      base: 175,
      discount: 15,
      total: 160,
      deposit: 40,
    });
  });
  it("board orders take a flat £25 deposit and scale by quantity", () => {
    expect(priceOrder({ pricePerHead: null, fixedPrice: 45 }, 1, false, { isBoardOrder: true, quantity: 2 })).toEqual({
      base: 90,
      discount: 0,
      total: 90,
      deposit: 25,
    });
  });
  it("adds extras to each board's price before the quantity multiply", () => {
    // (45 + 3.50) × 2 = 97
    expect(
      priceOrder({ pricePerHead: null, fixedPrice: 45 }, 1, false, { isBoardOrder: true, quantity: 2, extrasPerBoard: 3.5 }),
    ).toEqual({ base: 97, discount: 0, total: 97, deposit: 25 });
  });
  it("extras combine with referral discount and the deposit cap", () => {
    // (10 + 2) × 1 = 12, minus £15 referral => 0 total, deposit capped at 0
    expect(
      priceOrder({ pricePerHead: null, fixedPrice: 10 }, 1, true, { isBoardOrder: true, quantity: 1, extrasPerBoard: 2 }),
    ).toEqual({ base: 12, discount: 12, total: 0, deposit: 0 });
  });
  it("zero extras changes nothing", () => {
    expect(
      priceOrder({ pricePerHead: null, fixedPrice: 45 }, 1, false, { isBoardOrder: true, quantity: 1, extrasPerBoard: 0 }),
    ).toEqual({ base: 45, discount: 0, total: 45, deposit: 25 });
  });
});

describe("calcBoardExtras", () => {
  it("is zero for no groups or no selections", () => {
    expect(calcBoardExtras([])).toBe(0);
    expect(calcBoardExtras([{ includedFree: 0, prices: [] }])).toBe(0);
  });
  it("is zero when every selected option is free (current seeded behaviour)", () => {
    expect(calcBoardExtras([{ includedFree: 0, prices: [0, 0, 0] }])).toBe(0);
  });
  it("is zero when includedFree covers all selections", () => {
    expect(calcBoardExtras([{ includedFree: 3, prices: [2, 3.5, 1] }])).toBe(0);
    expect(calcBoardExtras([{ includedFree: 5, prices: [2, 3.5] }])).toBe(0);
  });
  it("charges only beyond the includedFree allowance, cheapest picks free first", () => {
    // free allowance eats the £0 pick; the £2 cracker charges
    expect(calcBoardExtras([{ includedFree: 1, prices: [2, 0] }])).toBe(2);
    // 1 free of [3, 1, 2] => £1 free, charge 2 + 3
    expect(calcBoardExtras([{ includedFree: 1, prices: [3, 1, 2] }])).toBe(5);
  });
  it("handles equal prices (first 3 cheeses free, 4th charges)", () => {
    expect(calcBoardExtras([{ includedFree: 3, prices: [3, 3, 3, 3] }])).toBe(3);
  });
  it("sums across groups", () => {
    expect(
      calcBoardExtras([
        { includedFree: 3, prices: [3, 3, 3, 3] }, // +3
        { includedFree: 1, prices: [2.5] }, // covered
        { includedFree: 0, prices: [0, 1.25] }, // +1.25
      ]),
    ).toBe(4.25);
  });
  it("rounds to 2dp", () => {
    expect(calcBoardExtras([{ includedFree: 0, prices: [0.1, 0.2] }])).toBe(0.3);
  });
});

describe("orderProfit", () => {
  it("scales cost per head for per-head platters", () => {
    // 10 heads @ £8.50 = £85 total, cost £3.40/head => cost £34 => profit £51
    expect(orderProfit({ pricePerHead: 8.5, fixedPrice: null, cost: 3.4 }, 10, 85)).toBe(51);
  });
  it("uses flat cost for fixed platters regardless of headcount", () => {
    // £175 total, cost £85 => profit £90 (headcount irrelevant)
    expect(orderProfit({ pricePerHead: null, fixedPrice: 175, cost: 85 }, 18, 175)).toBe(90);
  });
});

describe("roundTo5p", () => {
  it("rounds to the nearest 5p", () => {
    expect(roundTo5p(16.86)).toBe(16.85);
    expect(roundTo5p(16.88)).toBe(16.9);
    expect(roundTo5p(16.875)).toBe(16.9); // half rounds up
    expect(roundTo5p(2.174999)).toBe(2.15);
  });
  it("leaves exact 5p multiples untouched", () => {
    expect(roundTo5p(11.25)).toBe(11.25);
    expect(roundTo5p(25)).toBe(25);
    expect(roundTo5p(0)).toBe(0);
  });
});

describe("lineItemsTotal / addOnsTotal", () => {
  it("sums unitPrice × quantity to 2dp", () => {
    expect(lineItemsTotal([{ unitPrice: 1.5, quantity: 15 }])).toBe(22.5);
    expect(lineItemsTotal([{ unitPrice: 8, quantity: 1 }, { unitPrice: 25, quantity: 1 }])).toBe(33);
    expect(lineItemsTotal([{ unitPrice: 100, quantity: 2 }, { unitPrice: 55, quantity: 1 }])).toBe(255);
  });
  it("is zero for no items", () => {
    expect(addOnsTotal([])).toBe(0);
  });
});

describe("priceLineItemOrder", () => {
  it("prices a single board with no add-ons (clean deposit)", () => {
    expect(priceLineItemOrder([{ unitPrice: 100, quantity: 1 }], [], false)).toEqual({
      base: 100,
      boardsTotal: 100,
      addOnsTotal: 0,
      discount: 0,
      total: 100,
      deposit: 25,
      balance: 75,
    });
  });
  it("prices a board + per-person add-ons and rounds the deposit to 5p", () => {
    // board £45 + cutlery £1.50 × 15 = £67.50; 25% = £16.875 → £16.90 deposit; balance £50.60
    expect(
      priceLineItemOrder([{ unitPrice: 45, quantity: 1 }], [{ unitPrice: 1.5, quantity: 15 }], false),
    ).toEqual({
      base: 67.5,
      boardsTotal: 45,
      addOnsTotal: 22.5,
      discount: 0,
      total: 67.5,
      deposit: 16.9,
      balance: 50.6,
    });
  });
  it("applies a referral discount before computing the deposit", () => {
    // board £70 + top-up £8 = £78, minus £15 referral = £63; 25% = £15.75; balance £47.25
    expect(
      priceLineItemOrder([{ unitPrice: 70, quantity: 1 }], [{ unitPrice: 8, quantity: 1 }], true),
    ).toEqual({
      base: 78,
      boardsTotal: 70,
      addOnsTotal: 8,
      discount: 15,
      total: 63,
      deposit: 15.75,
      balance: 47.25,
    });
  });
  it("prices a multi-board event combination", () => {
    // 2× Large £100 + 1× Cheese £55 = £255; 25% = £63.75; balance £191.25
    expect(
      priceLineItemOrder([{ unitPrice: 100, quantity: 2 }, { unitPrice: 55, quantity: 1 }], [], false),
    ).toEqual({
      base: 255,
      boardsTotal: 255,
      addOnsTotal: 0,
      discount: 0,
      total: 255,
      deposit: 63.75,
      balance: 191.25,
    });
  });
});
