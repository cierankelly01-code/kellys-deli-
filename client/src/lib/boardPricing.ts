// Client mirror of the board-extras rule in server/src/lib/money.ts (calcBoardExtras):
// within each group, the `includedFree` cheapest selected options are free; every remaining
// selection adds its price. Display only — the server reprices authoritatively on POST /api/orders.
import type { BoardGroup } from "./api";

/** Per-board extras charge for the current selection. */
export function extrasForSelection(groups: BoardGroup[], selectedLabels: Set<string>): number {
  let extras = 0;
  for (const g of groups) {
    const prices = g.options
      .filter((o) => selectedLabels.has(o.label))
      .map((o) => o.price)
      .sort((a, b) => a - b);
    for (const price of prices.slice(Math.max(0, g.includedFree))) extras += price;
  }
  return Math.round((extras + Number.EPSILON) * 100) / 100;
}
