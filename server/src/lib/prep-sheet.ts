// Kitchen prep sheet aggregation — the killer feature.
// Pure function: takes the day's orders for a location and produces one picking list.
//
// Scaling rule (matches pricing/SPEC):
//   - per-head platter (isFixed=false): each item qty = qtyPerUnit * headcount
//   - fixed platter   (isFixed=true):  each item qty = qtyPerUnit * quantity (default 1 —
//     one platter per order for catering platters; board-configurator orders set quantity
//     to the number of boards bought)
// Item totals are summed across all orders by label, then rounded UP (you can't make
// half a sandwich), preserving the order in which labels were first seen.

export interface PrepInputItem {
  label: string;
  qtyPerUnit: number;
}

export interface PrepInputOrder {
  ref: string;
  platterName: string;
  isFixed: boolean;
  headcount: number;
  quantity?: number;
  items: PrepInputItem[];
}

export interface PrepLine {
  label: string;
  quantity: number; // rounded up to a whole unit
}

export interface PrepPlatterSummary {
  platterName: string;
  orders: number;
  headcount: number;
}

export interface PrepSheet {
  totalOrders: number;
  totalHeadcount: number;
  lines: PrepLine[];
  byPlatter: PrepPlatterSummary[];
}

export function buildPrepSheet(orders: PrepInputOrder[]): PrepSheet {
  const totals = new Map<string, number>(); // label -> running fractional total
  const order: string[] = []; // first-seen label order
  const platters = new Map<string, PrepPlatterSummary>();
  let totalHeadcount = 0;

  for (const o of orders) {
    const scale = o.isFixed ? o.quantity ?? 1 : o.headcount;
    totalHeadcount += o.headcount;

    for (const item of o.items) {
      if (!totals.has(item.label)) {
        totals.set(item.label, 0);
        order.push(item.label);
      }
      totals.set(item.label, totals.get(item.label)! + item.qtyPerUnit * scale);
    }

    const ps = platters.get(o.platterName) ?? { platterName: o.platterName, orders: 0, headcount: 0 };
    ps.orders += 1;
    ps.headcount += o.headcount;
    platters.set(o.platterName, ps);
  }

  return {
    totalOrders: orders.length,
    totalHeadcount,
    lines: order.map((label) => ({ label, quantity: Math.ceil(roundTiny(totals.get(label)!)) })),
    byPlatter: Array.from(platters.values()),
  };
}

// Guard against float fuzz (e.g. 1.5*3 = 4.499999...) before ceiling.
function roundTiny(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
