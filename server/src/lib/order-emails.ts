import { prisma } from "./prisma";
import { formatDate } from "./capacity";
import { notifyOrderReceived, notifyShopOfOrder, notifyShopDepositPaid, type OrderNotifyInput } from "./notify";

/** The board order as loaded for its emails: boards with their platter, add-ons, shop. */
export interface OrderForEmail {
  id: string;
  ref: string;
  customerName: string;
  phone: string;
  email: string;
  total: unknown;
  deposit: unknown;
  collectionOrDeliveryDate: Date;
  location: { name: string };
  items: { quantity: number; unitPrice: unknown; platter: { name: string; imageUrl: string | null; serves: string | null } }[];
  addOns: { name: string; quantity: number; unitPrice: unknown }[];
}

export const orderEmailInclude = { location: true, items: { include: { platter: true } }, addOns: true } as const;

function notifyInput(o: OrderForEmail, depositPaid: boolean): OrderNotifyInput {
  return {
    ref: o.ref,
    total: Number(o.total),
    deposit: Number(o.deposit),
    collectionDate: formatDate(o.collectionOrDeliveryDate),
    locationName: o.location.name,
    // The confirmation shows what they actually ordered, photos and all.
    boards: o.items.map((i) => ({
      name: i.platter.name,
      qty: i.quantity,
      lineTotal: Number(i.unitPrice) * i.quantity,
      imageUrl: i.platter.imageUrl,
      meta: i.platter.serves ? `Feeds ${i.platter.serves}` : null,
    })),
    addOns: o.addOns.map((a) => ({ name: a.name, qty: a.quantity, lineTotal: Number(a.unitPrice) * a.quantity })),
    depositPaid,
  };
}

async function shopInbox(): Promise<string | null> {
  return (await prisma.setting.findUnique({ where: { key: "orderNotifyEmail" } }))?.value?.trim() || null;
}

/**
 * The customer's confirmation and the shop's alert for a board order. Online-deposit
 * orders call this only once the deposit is paid (depositPaid), so an abandoned payment
 * page never looks like a confirmed order to either side.
 *
 * The first call for an order stamps confirmationSentAt (claimed atomically, so two
 * callers can't both send the "new order" alert) and sends the full emails. A later call
 * (a deposit paid for an order both sides were already told about) sends the customer
 * "you're booked in" and the shop a short "deposit paid" note, not a second "new order".
 * The order is already committed when this runs: a mail failure is logged, never thrown.
 */
export async function sendOrderEmails(o: OrderForEmail, opts: { depositPaid?: boolean } = {}): Promise<void> {
  const depositPaid = opts.depositPaid ?? false;
  const first = (await prisma.order.updateMany({ where: { id: o.id, confirmationSentAt: null }, data: { confirmationSentAt: new Date() } })).count > 0;
  if (!first && !depositPaid) return;
  const input = notifyInput(o, depositPaid);
  const target = { name: o.customerName, phone: o.phone, email: o.email };
  await notifyOrderReceived(target, input).catch((err) => console.error(`[orders] customer notice failed for ${o.ref}`, err));
  try {
    const to = await shopInbox();
    if (!to) return;
    if (first) {
      // The shop's copy leaves the photos out: it's read at the counter, not admired.
      await notifyShopOfOrder(to, target, { ...input, boards: input.boards?.map(({ imageUrl: _i, meta: _m, ...b }) => b) });
    } else {
      await notifyShopDepositPaid(to, target, input);
    }
  } catch (err) {
    console.error(`[orders] shop alert failed for ${o.ref}`, err);
  }
}
