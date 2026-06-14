import { describe, it, expect } from "vitest";
import {
  toMoney,
  calcTotal,
  calcDeposit,
  applyReferral,
  calcMargin,
  orderProfit,
  priceOrder,
  REFERRAL_DISCOUNT,
} from "../src/lib/money";

describe("toMoney", () => {
  it("rounds to 2dp and avoids float drift", () => {
    expect(toMoney(8.5 * 3)).toBe(25.5);
    expect(toMoney(0.1 + 0.2)).toBe(0.3);
    expect(toMoney(175)).toBe(175);
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
