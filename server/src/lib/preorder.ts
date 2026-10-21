// Pre-order product rules (pure — no DB), shared by the order route and tests.
import { parseDate } from "./capacity";

/**
 * A product's own ordering window: the last moment to order (orderBy) and the dates it
 * can be collected (collectFrom..collectTo). Returns a customer-facing reason, or null.
 */
export function orderWindowError(
  b: { name: string; orderBy: Date | null; collectFrom: Date | null; collectTo: Date | null },
  dateStr: string,
  now: Date,
): string | null {
  if (b.orderBy && now.getTime() > b.orderBy.getTime()) return `Sorry — orders for ${b.name} have closed`;
  const d = parseDate(dateStr).getTime();
  const nice = (x: Date) => x.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  if (b.collectFrom && d < b.collectFrom.getTime()) return `${b.name} can be collected from ${nice(b.collectFrom)}`;
  if (b.collectTo && d > b.collectTo.getTime()) return `${b.name} must be collected by ${nice(b.collectTo)}`;
  return null;
}
