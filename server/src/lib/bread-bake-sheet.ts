// Bake Sheet aggregation — the bread equivalent of prep-sheet.ts. Pure function: takes one
// shop's bread orders for one day and produces the totals the kitchen checks at 6am, plus a
// per-order breakdown underneath.

export interface BakeSheetInputItem {
  name: string;
  quantity: number;
}

export interface BakeSheetInputOrder {
  ref: string;
  customerName: string;
  status: string;
  notes: string | null;
  items: BakeSheetInputItem[];
}

export interface BakeSheetLine {
  name: string;
  quantity: number;
}

export interface BakeSheet {
  totalOrders: number;
  totalItems: number;
  lines: BakeSheetLine[]; // total quantity of each product, first-seen order
  orders: BakeSheetInputOrder[]; // per-order breakdown, unchanged, for the printout
}

/**
 * Totals across all (non-cancelled — the caller filters status upstream) orders for one
 * shop/day. Cancelled orders are excluded by the caller so a cancellation instantly drops
 * off the bake sheet without this function needing to know the cancellation policy.
 */
export function buildBakeSheet(orders: BakeSheetInputOrder[]): BakeSheet {
  const totals = new Map<string, number>();
  const order: string[] = []; // first-seen product order
  let totalItems = 0;

  for (const o of orders) {
    for (const item of o.items) {
      if (!totals.has(item.name)) {
        totals.set(item.name, 0);
        order.push(item.name);
      }
      totals.set(item.name, totals.get(item.name)! + item.quantity);
      totalItems += item.quantity;
    }
  }

  return {
    totalOrders: orders.length,
    totalItems,
    lines: order.map((name) => ({ name, quantity: totals.get(name)! })),
    orders,
  };
}
