import { toMoney } from "./money";

type Part = { kind: string; refId: string; quantity: number };
type Offer = { id: string; name: string; discountPct: number; items: Part[] };
type Line = Part & { price: number };

/** Best complete bundle only. Quantities are aggregated, so duplicate lines cannot
 * multiply savings. Offers never stack or discount unrelated basket items. */
export function bestBundleDiscount(offers: Offer[], lines: Line[]) {
  const available = new Map<string, { quantity: number; price: number }>();
  for (const line of lines) {
    const key = `${line.kind}:${line.refId}`;
    const old = available.get(key);
    available.set(key, { quantity: (old?.quantity ?? 0) + line.quantity, price: line.price });
  }
  let best = { amount: 0, name: "", bundleId: "" };
  for (const offer of offers) {
    if (!offer.items.some((i) => i.kind === "board") || offer.discountPct <= 0 || offer.discountPct > 50) continue;
    const required = new Map<string, number>();
    for (const item of offer.items) {
      const key = `${item.kind}:${item.refId}`;
      required.set(key, (required.get(key) ?? 0) + item.quantity);
    }
    let copies = Infinity;
    let subtotal = 0;
    for (const [key, quantity] of required) {
      const line = available.get(key);
      if (!line || quantity <= 0) { copies = 0; break; }
      copies = Math.min(copies, Math.floor(line.quantity / quantity));
      subtotal += line.price * quantity;
    }
    const amount = copies > 0 ? toMoney(toMoney(subtotal * offer.discountPct / 100) * copies) : 0;
    if (amount > best.amount) best = { amount, name: offer.name, bundleId: offer.id };
  }
  return best;
}
