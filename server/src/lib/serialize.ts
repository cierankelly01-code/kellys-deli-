// Convert Prisma rows (with Decimal/Date types) into plain JSON-friendly DTOs
// with numbers and 'YYYY-MM-DD' date strings, so the client never deals with Decimal.
import type { Platter, Location, Order, Customer, Experience } from "@prisma/client";
import { formatDate } from "./capacity";

const num = (d: unknown): number | null => (d == null ? null : Number(d));

export interface PlatterItem {
  label: string;
  qtyPerUnit: number;
}

export function platterDTO(p: Platter, opts: { includeCost?: boolean } = {}) {
  const dto = {
    id: p.id,
    category: p.category,
    name: p.name,
    description: p.description,
    pricePerHead: num(p.pricePerHead),
    fixedPrice: num(p.fixedPrice),
    serves: p.serves,
    minHeadcount: p.minHeadcount,
    items: (p.items as unknown as PlatterItem[]) ?? [],
    imageUrl: p.imageUrl,
    active: p.active,
    sortOrder: p.sortOrder,
    isFixed: p.fixedPrice != null,
    // From-price for display: fixed price, or per-head * minHeadcount.
    fromPrice: p.fixedPrice != null ? Number(p.fixedPrice) : Number(p.pricePerHead) * p.minHeadcount,
  };
  if (opts.includeCost) return { ...dto, cost: Number(p.cost) };
  return dto;
}

export function experienceDTO(e: Experience, opts: { includeCost?: boolean } = {}) {
  const dto = {
    id: e.id,
    name: e.name,
    description: e.description,
    pricePerHead: Number(e.pricePerHead),
    capacity: e.capacity,
    imageUrl: e.imageUrl,
    active: e.active,
    sortOrder: e.sortOrder,
  };
  if (opts.includeCost) return { ...dto, cost: Number(e.cost) };
  return dto;
}

export function locationDTO(l: Location) {
  return {
    id: l.id,
    name: l.name,
    slug: l.slug,
    weeklyCapacity: l.weeklyCapacity, // per-day capacity (see SPEC #2)
    active: l.active,
  };
}

export function orderDTO(
  o: Order & {
    platter?: Platter | null;
    experience?: Experience | null;
    location?: Location | null;
    customer?: Customer | null;
  },
) {
  return {
    customerReferralCode: o.customer?.referralCode ?? null,
    id: o.id,
    ref: o.ref,
    type: o.type,
    platterId: o.platterId,
    platterName: o.platter?.name ?? null,
    experienceId: o.experienceId,
    experienceName: o.experience?.name ?? null,
    headcount: o.headcount,
    total: Number(o.total),
    deposit: Number(o.deposit),
    depositStatus: o.depositStatus,
    isGift: o.isGift,
    recipientName: o.recipientName,
    deliveryAddress: o.deliveryAddress,
    giftMessage: o.giftMessage,
    collectionOrDeliveryDate: formatDate(o.collectionOrDeliveryDate),
    locationId: o.locationId,
    locationName: o.location?.name ?? null,
    customerName: o.customerName,
    phone: o.phone,
    email: o.email,
    notes: o.notes,
    freebie: o.freebie,
    status: o.status,
    src: o.src,
    referralCodeUsed: o.referralCodeUsed,
    createdAt: o.createdAt.toISOString(),
  };
}
