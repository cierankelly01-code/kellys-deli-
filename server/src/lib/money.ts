// All money math lives here. Keep everything in 2dp numbers (pounds).
// Prisma stores Decimal(10,2); convert at the edges with `toMoney`.

export const DEPOSIT_RATE = 0.25;
export const REFERRAL_DISCOUNT = 15;

/** Round to 2 decimal places, guarding against float drift. */
export function toMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface PlatterPricing {
  pricePerHead: number | null;
  fixedPrice: number | null;
}

/** True for fixed-price platters (one platter per order); false for per-head. */
export function isFixed(p: PlatterPricing): boolean {
  return p.fixedPrice != null;
}

/** Order subtotal before any discount. */
export function calcTotal(p: PlatterPricing, headcount: number): number {
  if (p.fixedPrice != null) return toMoney(p.fixedPrice);
  if (p.pricePerHead != null) return toMoney(p.pricePerHead * headcount);
  throw new Error("Platter has neither fixedPrice nor pricePerHead");
}

/** Apply a referral discount (£15 off), never below zero. */
export function applyReferral(total: number, hasValidReferral: boolean): number {
  if (!hasValidReferral) return toMoney(total);
  return toMoney(Math.max(0, total - REFERRAL_DISCOUNT));
}

/** 25% deposit on the (post-discount) total. */
export function calcDeposit(total: number): number {
  return toMoney(total * DEPOSIT_RATE);
}

export interface PricedOrder {
  base: number; // subtotal before discount
  discount: number; // referral discount applied
  total: number; // what the customer owes
  deposit: number; // 25% of total
}

/** Full pricing for an order in one call. */
export function priceOrder(p: PlatterPricing, headcount: number, hasValidReferral: boolean): PricedOrder {
  const base = calcTotal(p, headcount);
  const total = applyReferral(base, hasValidReferral);
  const discount = toMoney(base - total);
  const deposit = calcDeposit(total);
  return { base, discount, total, deposit };
}

export interface Margin {
  profit: number;
  marginPct: number;
}

/** Profit £ and margin % for a given price and cost. */
export function calcMargin(price: number, cost: number): Margin {
  const profit = toMoney(price - cost);
  const marginPct = price > 0 ? Math.round((profit / price) * 100) : 0;
  return { profit, marginPct };
}

/**
 * The per-order "price" used for profit reporting:
 * per-head platters earn pricePerHead * headcount; fixed platters earn fixedPrice.
 * Cost scales the same way (cost is per-head for per-head platters, per-platter for fixed).
 */
export function orderProfit(
  p: PlatterPricing & { cost: number },
  headcount: number,
  total: number,
): number {
  const scale = isFixed(p) ? 1 : headcount;
  return toMoney(total - p.cost * scale);
}
