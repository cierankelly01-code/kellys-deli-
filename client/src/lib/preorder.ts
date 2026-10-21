// Pre-order (shop product) helpers shared by the basket, checkout and product pages.
import type { Platter } from "./api";

/**
 * The dates every product in the basket can be collected on: the latest collectFrom and
 * the earliest collectTo. `conflict` = no single day suits everything in the basket.
 */
export function collectionWindow(products: Platter[]): { from: string | null; to: string | null; note: string | null; conflict: boolean } {
  const froms = products.map((p) => p.collectFrom).filter((d): d is string => !!d);
  const tos = products.map((p) => p.collectTo).filter((d): d is string => !!d);
  const from = froms.length ? froms.sort()[froms.length - 1] : null;
  const to = tos.length ? tos.sort()[0] : null;
  const nice = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const note = from && to ? `Collection between ${nice(from)} and ${nice(to)}.` : from ? `Collection from ${nice(from)}.` : to ? `Collection by ${nice(to)}.` : null;
  return { from, to, note, conflict: !!(from && to && from > to) };
}

/** "Order by Tue 16 Dec" — or null when the product has no deadline. */
export function orderByLabel(orderBy: string | null): string | null {
  if (!orderBy) return null;
  const d = new Date(orderBy);
  if (Number.isNaN(d.getTime())) return null;
  return `Order by ${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" })}`;
}

/** True once a product's order-by deadline has passed. */
export function orderingClosed(p: Pick<Platter, "orderBy">, now: Date = new Date()): boolean {
  return !!p.orderBy && now.getTime() > new Date(p.orderBy).getTime();
}
