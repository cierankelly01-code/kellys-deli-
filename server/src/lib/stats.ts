// Profit / lead-source aggregation. Pure functions over plain order rows.
import { toMoney, calcMargin } from "./money";

export interface StatOrderInput {
  total: number;
  cost: number; // platter cost (per-head for per-head platters, per-platter for fixed)
  isFixed: boolean;
  headcount: number;
  platterId: string;
  platterName: string;
  locationId: string;
  locationName: string;
  src: string;
}

export interface GroupTotals {
  revenue: number;
  profit: number;
  orders: number;
}

/** Profit for a single order (revenue minus appropriately-scaled cost). */
export function profitOf(o: StatOrderInput): number {
  const scale = o.isFixed ? 1 : o.headcount;
  return toMoney(o.total - o.cost * scale);
}

export interface OrdersSummary {
  combined: GroupTotals;
  byLocation: Array<{ locationId: string; locationName: string } & GroupTotals>;
  bySrc: Array<{ src: string } & GroupTotals>;
  byPlatter: Array<{ platterId: string; platterName: string } & GroupTotals>;
}

function add(g: GroupTotals, revenue: number, profit: number) {
  g.revenue = toMoney(g.revenue + revenue);
  g.profit = toMoney(g.profit + profit);
  g.orders += 1;
}

export function summarizeOrders(orders: StatOrderInput[]): OrdersSummary {
  const combined: GroupTotals = { revenue: 0, profit: 0, orders: 0 };
  const loc = new Map<string, { locationId: string; locationName: string } & GroupTotals>();
  const src = new Map<string, { src: string } & GroupTotals>();
  const plat = new Map<string, { platterId: string; platterName: string } & GroupTotals>();

  for (const o of orders) {
    const profit = profitOf(o);
    add(combined, o.total, profit);

    const l = loc.get(o.locationId) ?? { locationId: o.locationId, locationName: o.locationName, revenue: 0, profit: 0, orders: 0 };
    add(l, o.total, profit);
    loc.set(o.locationId, l);

    const s = src.get(o.src) ?? { src: o.src, revenue: 0, profit: 0, orders: 0 };
    add(s, o.total, profit);
    src.set(o.src, s);

    const p = plat.get(o.platterId) ?? { platterId: o.platterId, platterName: o.platterName, revenue: 0, profit: 0, orders: 0 };
    add(p, o.total, profit);
    plat.set(o.platterId, p);
  }

  return {
    combined,
    byLocation: Array.from(loc.values()).sort((a, b) => b.revenue - a.revenue),
    bySrc: Array.from(src.values()).sort((a, b) => b.orders - a.orders),
    byPlatter: Array.from(plat.values()).sort((a, b) => b.profit - a.profit),
  };
}

export interface PlatterMarginInput {
  id: string;
  name: string;
  pricePerHead: number | null;
  fixedPrice: number | null;
  cost: number;
}

export interface PlatterMarginRow {
  id: string;
  name: string;
  basis: "fixed" | "per-head";
  price: number;
  cost: number;
  profit: number;
  marginPct: number;
}

/** Rank platters by margin %, best first (price-by-margin, not guesswork). */
export function rankPlattersByMargin(platters: PlatterMarginInput[]): PlatterMarginRow[] {
  return platters
    .map((p) => {
      const isFixed = p.fixedPrice != null;
      const price = isFixed ? p.fixedPrice! : p.pricePerHead ?? 0;
      const { profit, marginPct } = calcMargin(price, p.cost);
      return {
        id: p.id,
        name: p.name,
        basis: isFixed ? ("fixed" as const) : ("per-head" as const),
        price,
        cost: p.cost,
        profit,
        marginPct,
      };
    })
    .sort((a, b) => b.marginPct - a.marginPct);
}
