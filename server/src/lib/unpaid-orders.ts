import { prisma } from "./prisma";
import { stripeEnabled } from "./env";
import { checkoutStatus } from "./payments";

/**
 * A board order sent to Stripe holds its collection slot for this long. If the deposit
 * still isn't paid (the customer closed Stripe's page and never came back), the order is
 * cancelled and the slot goes back on sale. No email was ever sent for it: online orders
 * only send their confirmation once the deposit is paid.
 */
export const UNPAID_HOLD_MINUTES = 60;

const RELEASED_NOTE = `Released automatically: the deposit wasn't paid online within ${UNPAID_HOLD_MINUTES} minutes.`;

/**
 * Cancel online-deposit orders older than the hold whose Stripe page can no longer be
 * paid. A page that's still open (the customer reopened it late) is left alone: Stripe
 * expires it within about 30 minutes and the next run picks it up. A completed page is
 * left for the webhook. Returns the refs released.
 */
export async function releaseUnpaidOrders(now = new Date()): Promise<string[]> {
  if (!stripeEnabled()) return [];
  const cutoff = new Date(now.getTime() - UNPAID_HOLD_MINUTES * 60_000);
  const candidates = await prisma.order.findMany({
    where: {
      type: { not: "experience" },
      status: "new",
      depositStatus: "pending",
      // Only orders that went to a Stripe page. Orders from before Stripe, or made while it
      // was down (stub_…), are waiting on the shop to take the deposit: never touched.
      depositIntentId: { startsWith: "cs_" },
      // Never emailed: an order the customer or shop has a confirmation for is never
      // cancelled behind their backs, even if a later payment page was abandoned.
      confirmationSentAt: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true, ref: true, depositIntentId: true, notes: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const released: string[] = [];
  for (const o of candidates) {
    let status;
    try {
      status = await checkoutStatus(o.depositIntentId!);
    } catch (e) {
      console.error(`[orders] couldn't check payment page for ${o.ref}; will retry`, e instanceof Error ? e.message : e);
      continue;
    }
    if (status === "open" || status === "complete") continue;
    // Conditional on the same pending session, so a payment or an admin change that lands
    // in the meantime wins.
    const r = await prisma.order.updateMany({
      where: { id: o.id, status: "new", depositStatus: "pending", depositIntentId: o.depositIntentId, confirmationSentAt: null },
      data: { status: "cancelled", notes: [o.notes, RELEASED_NOTE].filter(Boolean).join("\n") },
    });
    if (r.count > 0) released.push(o.ref);
  }
  if (released.length) console.log(`[orders] released ${released.length} unpaid order(s): ${released.join(", ")}`);
  return released;
}

export function startUnpaidOrderWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await releaseUnpaidOrders(); } catch (e) { console.error("[orders] unpaid-order release failed", e); } finally { running = false; }
  };
  void tick();
  setInterval(() => void tick(), 5 * 60 * 1000).unref();
}
