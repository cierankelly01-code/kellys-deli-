// Online payment for bread (KDB-) and deli counter (KDS-) orders: the whole order is paid
// upfront on Stripe Checkout, like boards (owner, 29 Oct 2026). Both order types share one
// shape, so one module serves them. Board orders (KD-) keep their own code in public.ts/app.ts.
//
// The flow mirrors boards: an order sent to Stripe sends no email until the webhook sees it
// paid; an unpaid one is released after the hold (unpaid-orders.ts). If Stripe is off or
// down when the order is placed, it falls back to pay on collection (paymentStatus "none")
// and both emails go at once, as before Stripe.
import { prisma } from "./prisma";
import { env, stripeEnabled } from "./env";
import { formatDate } from "./capacity";
import { createDepositCheckout, expireCheckout, DepositAlreadyPaidError, type WebhookResult } from "./payments";
import { breadOrderDTO, groceryOrderDTO, maskPhone, maskEmail } from "./serialize";
import { notifyBreadOrderReceived, notifyShopOfBreadOrder, notifyGroceryOrderReceived, notifyShopOfGroceryOrder } from "./notify";
import type { BreadOrderEmailData } from "./emailTemplate";
import { UNPAID_HOLD_MINUTES } from "./unpaid-orders";

export type SimpleKind = "bread" | "grocery";

export function simpleKindForRef(ref: string): SimpleKind | null {
  if (ref.startsWith("KDB-")) return "bread";
  if (ref.startsWith("KDS-")) return "grocery";
  return null;
}

// Stripe won't take a card payment under 30p; anything that small is paid on collection.
const STRIPE_MINIMUM = 0.3;

/* eslint-disable @typescript-eslint/no-explicit-any -- the two Prisma delegates share a shape but not a type */
const orders = (k: SimpleKind): any => (k === "bread" ? prisma.breadOrder : prisma.groceryOrder);
const include = { location: true, items: true } as const;
type SimpleOrder = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const dtoOf = (k: SimpleKind, o: SimpleOrder) => (k === "bread" ? breadOrderDTO(o) : groceryOrderDTO(o));

export async function loadSimpleOrder(k: SimpleKind, ref: string): Promise<SimpleOrder | null> {
  return orders(k).findUnique({ where: { ref }, include });
}

/** What the customer pays: the order total (grocery Subscribe & Save discount included). */
export function simpleOrderTotal(k: SimpleKind, o: SimpleOrder): number {
  return dtoOf(k, o).total;
}

async function shopInbox(k: SimpleKind, locationId: string): Promise<string | null> {
  const s = k === "bread"
    ? await prisma.breadShopSetting.findUnique({ where: { locationId } })
    : await prisma.groceryShopSetting.findUnique({ where: { locationId } });
  return s?.notifyEmail?.trim() || null;
}

/**
 * The customer's confirmation (if they gave an email) and the shop's alert. Claims
 * confirmationSentAt first, so each order is announced once, however many callers race.
 * Never throws: the order is already saved.
 */
export async function sendSimpleOrderEmails(k: SimpleKind, o: SimpleOrder, opts: { paid: boolean; onlyIfFirst?: boolean }): Promise<void> {
  const first = (await orders(k).updateMany({ where: { id: o.id, confirmationSentAt: null }, data: { confirmationSentAt: new Date() } })).count > 0;
  // Already claimed: nothing more for an unpaid order or a catch-up send (webhook retry).
  // A fresh payment still confirms, e.g. on an order the shop handled before it was paid
  // (handling it stamps confirmationSentAt, but nobody has emailed the customer).
  if (!first && (!opts.paid || opts.onlyIfFirst)) return;
  const dto = dtoOf(k, o);
  const data: BreadOrderEmailData = {
    ref: dto.ref,
    customerName: dto.customerName,
    phone: dto.phone,
    email: dto.email,
    locationName: dto.locationName ?? "",
    collectionDate: dto.collectionDate,
    notes: dto.notes,
    items: dto.items.map((i: { name: string; quantity: number; unitPrice: number; lineTotal: number }) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
    total: dto.total,
    paid: opts.paid,
  };
  try {
    if (dto.email) await (k === "bread" ? notifyBreadOrderReceived : notifyGroceryOrderReceived)(dto.email, data);
  } catch (err) {
    console.error(`[orders] customer notice failed for ${o.ref}`, err);
  }
  try {
    const to = await shopInbox(k, o.locationId);
    if (to) await (k === "bread" ? notifyShopOfBreadOrder : notifyShopOfGroceryOrder)(to, data);
  } catch (err) {
    console.error(`[orders] shop alert failed for ${o.ref}`, err);
  }
}

const summaryOf = (o: SimpleOrder) => `Collect from ${o.location?.name ?? "the shop"}, ${formatDate(o.collectionDate)}`;

/**
 * Right after a bread/deli order is saved: send the customer to Stripe for the full total,
 * or, with no payment page possible, fall back to pay on collection and email now.
 * Returns the Stripe URL, or null for pay on collection.
 */
export async function startSimpleCheckout(k: SimpleKind, o: SimpleOrder): Promise<string | null> {
  const amount = simpleOrderTotal(k, o);
  if (stripeEnabled() && amount >= STRIPE_MINIMUM) {
    try {
      const checkout = await createDepositCheckout({ orderRef: o.ref, amount, summary: summaryOf(o), siteUrl: env.publicUrl });
      if (checkout.url) {
        await orders(k).update({ where: { id: o.id }, data: { paymentStatus: "pending", paymentIntentId: checkout.sessionId } });
        return checkout.url;
      }
    } catch (e) {
      console.error(`[payments] could not start checkout for ${o.ref}; falling back to pay on collection`, e);
    }
  }
  await sendSimpleOrderEmails(k, o, { paid: false });
  return null;
}

/** Payable online right now: waiting on its payment, not cancelled or collected, not in the past. */
export function canPaySimpleOnline(o: SimpleOrder): boolean {
  if (o.paymentStatus !== "pending") return false;
  if (o.status !== "pending" && o.status !== "confirmed") return false;
  return formatDate(o.collectionDate) >= formatDate(new Date());
}

export class SimplePayError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Reopen (or restart) the payment page from the order page. Same guards as the board route. */
export async function retrySimpleCheckout(k: SimpleKind, ref: string): Promise<string> {
  if (!stripeEnabled()) throw new SimplePayError("Online payment isn't switched on — please pay when you collect.", 409);
  const o = await loadSimpleOrder(k, ref);
  if (!o) throw new SimplePayError("Order not found", 404);
  if (!canPaySimpleOnline(o)) {
    throw new SimplePayError(o.paymentStatus === "paid" ? "This order has already been paid." : "This order can't be paid online — please pay when you collect.", 409);
  }
  let checkout;
  try {
    checkout = await createDepositCheckout({ orderRef: o.ref, amount: simpleOrderTotal(k, o), summary: summaryOf(o), siteUrl: env.publicUrl, existingSessionId: o.paymentIntentId });
  } catch (e) {
    if (e instanceof DepositAlreadyPaidError) throw new SimplePayError("This order has just been paid — refresh the page in a moment.", 409);
    console.error(`[payments] could not start checkout for ${o.ref}`, e);
    throw new SimplePayError("We couldn't open the payment page just now. Please try again in a minute.", 502);
  }
  // Compare-and-set, as for boards: a payment, a cancellation or another tab may have
  // changed the order while Stripe answered. Then this page must not stay payable.
  const saved = await orders(k).updateMany({
    where: { id: o.id, paymentStatus: "pending", paymentIntentId: o.paymentIntentId, status: { in: ["pending", "confirmed"] } },
    data: { paymentIntentId: checkout.sessionId },
  });
  if (saved.count === 0) {
    const now = await orders(k).findUnique({ where: { id: o.id }, select: { paymentStatus: true, status: true } });
    if (now?.paymentStatus !== "pending" || (now?.status !== "pending" && now?.status !== "confirmed")) {
      await expireCheckout(checkout.sessionId);
      throw new SimplePayError("This order can't be paid online any more — please refresh the page.", 409);
    }
    if (checkout.sessionId !== o.paymentIntentId) {
      if (!checkout.reused) await expireCheckout(checkout.sessionId);
      throw new SimplePayError("Your payment page is already open in another window. Please finish it there, or try again in a moment.", 409);
    }
  }
  return checkout.url!;
}

/** Link-shareable order view for the order page: first name only, contact details masked. */
export function publicSimpleOrderDTO(k: SimpleKind, o: SimpleOrder) {
  const dto = dtoOf(k, o);
  const payable = stripeEnabled() && canPaySimpleOnline(o);
  return {
    kind: k,
    ref: dto.ref,
    customerName: dto.customerName.split(/\s+/)[0] ?? "",
    phone: maskPhone(dto.phone),
    email: dto.email ? maskEmail(dto.email) : null,
    locationName: dto.locationName,
    collectionDate: dto.collectionDate,
    status: dto.status,
    items: dto.items,
    total: dto.total,
    paymentStatus: o.paymentStatus as string,
    canPayOnline: payable,
    holdEndsAt:
      payable && !o.confirmationSentAt && String(o.paymentIntentId ?? "").startsWith("cs_")
        ? new Date(o.createdAt.getTime() + UNPAID_HOLD_MINUTES * 60_000).toISOString()
        : null,
  };
}

/**
 * Webhook: Stripe says a bread/deli order's Checkout Session is paid. Mirrors the board
 * handler: only the exact amount on a live, pending order is recorded; anything odd goes
 * to the shop as ACTION NEEDED and changes nothing.
 */
export async function recordSimplePayment(k: SimpleKind, r: WebhookResult, problem: (ref: string, msg: string) => Promise<void>): Promise<boolean> {
  const ref = r.paidOrderRef!;
  const o = await loadSimpleOrder(k, ref);
  if (!o) {
    await problem(ref, `£${((r.amountPaidPence ?? 0) / 100).toFixed(2)} was paid online for order ${ref}, which no longer exists (deleted?). Refund it in Stripe.`);
    return false;
  }
  const owed = Math.round(simpleOrderTotal(k, o) * 100);
  const paidMoney = `£${((r.amountPaidPence ?? 0) / 100).toFixed(2)}`;
  if (r.amountPaidPence !== owed) {
    await problem(ref, `Stripe collected ${paidMoney} but the order total is £${(owed / 100).toFixed(2)}. Left unpaid.`);
    return false;
  }
  if (o.status === "cancelled") {
    await problem(ref, `${paidMoney} was paid online for an order that is CANCELLED. It has not been marked paid.`);
    return false;
  }
  const res = await orders(k).updateMany({
    where: { id: o.id, paymentStatus: "pending" },
    data: { paymentStatus: "paid", paidAt: new Date(), paymentIntentId: r.intentId ?? undefined, ...(o.email ? {} : r.customerEmail ? { email: r.customerEmail } : {}) },
  });
  if (res.count === 0) {
    if (o.paymentStatus === "paid" && o.paymentIntentId && r.intentId && o.paymentIntentId !== r.intentId) {
      await problem(ref, `This order was paid TWICE (payments ${o.paymentIntentId} and ${r.intentId}). Refund one of them.`);
    } else if (o.paymentStatus !== "paid") {
      await problem(ref, `${paidMoney} was paid online for an order set to "${o.paymentStatus}". Check it and refund if needed.`);
    } else if (!o.confirmationSentAt && o.paymentIntentId === r.intentId) {
      // Stripe retrying a payment we recorded but crashed before confirming.
      await sendSimpleOrderEmails(k, o, { paid: true, onlyIfFirst: true });
    }
    return false;
  }
  const fresh = await loadSimpleOrder(k, ref);
  if (fresh) await sendSimpleOrderEmails(k, fresh, { paid: true });
  return true;
}

/** Webhook: a full refund made in the Stripe dashboard. */
export async function recordSimpleRefund(intentId: string): Promise<number> {
  const where = { paymentIntentId: intentId, paymentStatus: "paid" };
  const a = await prisma.breadOrder.updateMany({ where, data: { paymentStatus: "refunded" } });
  const b = await prisma.groceryOrder.updateMany({ where, data: { paymentStatus: "refunded" } });
  return a.count + b.count;
}
