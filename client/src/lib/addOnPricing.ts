// Client mirror of server pricing for live display. The server reprices authoritatively
// on POST /api/orders — this only drives the running total + suggested quantities in the UI.
// Mirrors server/src/lib/addons.ts (suggestAddOnQty) and money.ts (roundTo5p, priceLineItemOrder).
import type { AddOn, Platter } from "./api";

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Round to the nearest 5p (mirror of server roundTo5p). */
export function roundTo5p(n: number): number {
  return money(Math.round(n / 0.05) * 0.05);
}

/**
 * Suggested (not auto-added) quantity for an add-on given a headcount.
 * per_person → headcount; serves → ceil(headcount / servesPerUnit); else 0.
 */
export function suggestAddOnQty(addOn: AddOn, headcount: number): number {
  if (!addOn.suggestFromHeadcount || headcount <= 0) return 0;
  if (addOn.unitType === "per_person") return headcount;
  if (addOn.unitType === "serves") {
    const per = addOn.servesPerUnit && addOn.servesPerUnit > 0 ? addOn.servesPerUnit : 1;
    return Math.ceil(headcount / per);
  }
  return 0;
}

/** Feeds midpoint of a board (mirror of server recommender.midpoint). */
export function feedsMid(p: Pick<Platter, "feedsMin" | "feedsMax">): number {
  if (p.feedsMin == null || p.feedsMax == null) return 0;
  return (p.feedsMin + p.feedsMax) / 2;
}

export interface LineTotals {
  boardsTotal: number;
  addOnsTotal: number;
  total: number;
  deposit: number;
  balance: number;
}

/**
 * Live totals for a set of board + add-on lines. Deposit is 25% rounded to the nearest 5p.
 * `boards` / `addOns` carry a unitPrice + quantity (already resolved from the catalogue).
 */
export function computeTotals(
  boards: { unitPrice: number; quantity: number }[],
  addOns: { unitPrice: number; quantity: number }[],
): LineTotals {
  const boardsTotal = money(boards.reduce((s, b) => s + b.unitPrice * b.quantity, 0));
  const addOnsTotal = money(addOns.reduce((s, a) => s + a.unitPrice * a.quantity, 0));
  const total = money(boardsTotal + addOnsTotal);
  const deposit = roundTo5p(total * 0.25);
  const balance = money(total - deposit);
  return { boardsTotal, addOnsTotal, total, deposit, balance };
}
