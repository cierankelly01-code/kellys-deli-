// What happens around an order's payment: the customer + shop notifications, and the
// once-only flip to "paid" when Stripe confirms the money (webhook or return-trip check).
import { prisma } from "./prisma";
import { formatDate } from "./capacity";
import { notifyOrderReceived, notifyShopOfOrder } from "./notify";
import { retrieveCheckoutSession } from "./payments";

/**
 * Email/SMS the customer their confirmation and alert the shop inbox. The order is already
 * committed when this runs, so a mail failure is logged and never surfaces to the customer.
 */
export async function sendOrderNotifications(orderId: string, paidOnline?: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { location: true, items: { include: { platter: true } }, addOns: true },
  });
  if (!order) return;
  const base = {
    ref: order.ref,
    total: Number(order.total),
    deposit: Number(order.deposit),
    collectionDate: formatDate(order.collectionOrDeliveryDate),
    locationName: order.location.name,
    paidOnline,
    addOns: order.addOns.map((a) => ({ name: a.name, qty: a.quantity, lineTotal: Number(a.unitPrice) * a.quantity })),
  };
  const target = { name: order.customerName, phone: order.phone, email: order.email };
  try {
    await notifyOrderReceived(target, {
      ...base,
      // The confirmation shows what they actually ordered, photos and all.
      boards: order.items.map((i) => ({
        name: i.platter.name,
        qty: i.quantity,
        lineTotal: Number(i.unitPrice) * i.quantity,
        imageUrl: i.platter.imageUrl,
        meta: i.platter.unitLabel ?? (i.platter.serves ? `Feeds ${i.platter.serves}` : null),
      })),
    });
  } catch (err) {
    console.error("[orders] customer notification failed", err);
  }
  try {
    const to = (await prisma.setting.findUnique({ where: { key: "orderNotifyEmail" } }))?.value?.trim();
    if (to) {
      await notifyShopOfOrder(to, target, {
        ...base,
        boards: order.items.map((i) => ({ name: i.platter.name, qty: i.quantity, lineTotal: Number(i.unitPrice) * i.quantity })),
      });
    }
  } catch (err) {
    console.error("[orders] shop alert failed", err);
  }
}

/**
 * Mark an order's online payment as received. Atomic and idempotent: only the call that
 * actually flips pending -> paid sends the confirmations, so the webhook and the customer's
 * return trip racing each other can't double-email anyone.
 */
export async function markOrderPaid(ref: string, info: { intentId?: string | null; sessionId?: string | null } = {}): Promise<boolean> {
  const flipped = await prisma.order.updateMany({
    where: { ref, depositStatus: "pending" },
    data: {
      depositStatus: "paid",
      depositPaidAt: new Date(),
      ...(info.intentId ? { depositIntentId: info.intentId } : {}),
      ...(info.sessionId ? { checkoutSessionId: info.sessionId } : {}),
    },
  });
  if (flipped.count !== 1) return false;
  const order = await prisma.order.findUnique({ where: { ref } });
  if (order) await sendOrderNotifications(order.id, Number(order.deposit));
  return true;
}

/**
 * The webhook-free confirmation path: look the order's Checkout Session up on Stripe and
 * mark it paid if the money's in. Returns the order's current deposit status.
 */
export async function reconcileOrderPayment(ref: string): Promise<string | null> {
  const order = await prisma.order.findUnique({ where: { ref } });
  if (!order) return null;
  if (order.depositStatus !== "pending" || !order.checkoutSessionId) return order.depositStatus;
  try {
    const session = await retrieveCheckoutSession(order.checkoutSessionId);
    // Only trust a session that belongs to this order.
    if (session?.paid && session.orderRef === ref) {
      await markOrderPaid(ref, { intentId: session.paymentIntentId });
      return "paid";
    }
  } catch (err) {
    console.error("[payments] reconcile failed", err);
  }
  return order.depositStatus;
}
