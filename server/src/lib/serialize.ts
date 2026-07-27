// Convert Prisma rows (with Decimal/Date types) into plain JSON-friendly DTOs
// with numbers and 'YYYY-MM-DD' date strings, so the client never deals with Decimal.
import type {
  Platter,
  Location,
  Order,
  Customer,
  Experience,
  BoardComponent,
  BoardComponentGroup,
  AddOn,
  OrderItem,
  OrderAddOn,
  Category,
  CorporateEnquiry,
  Subscription,
  Bundle,
  BundleItem,
  GiftVoucherRequest,
} from "@prisma/client";
import { formatDate } from "./capacity";
import { toMoney } from "./money";

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
    items: Array.isArray(p.items) ? (p.items as unknown as PlatterItem[]) : [],
    imageUrl: p.imageUrl,
    active: p.active,
    sortOrder: p.sortOrder,
    isFixed: p.fixedPrice != null,
    // From-price for display: fixed price, or per-head * minHeadcount. Rounded, and
    // guarded so a row with neither price shows null rather than a silent "from £0".
    fromPrice:
      p.fixedPrice != null
        ? Number(p.fixedPrice)
        : p.pricePerHead != null
          ? toMoney(Number(p.pricePerHead) * p.minHeadcount)
          : null,
    boardType: p.boardType,
    size: p.size,
    tier: p.tier,
    feedsMin: p.feedsMin,
    feedsMax: p.feedsMax,
    recommendEligible: p.recommendEligible,
    recommendPriority: p.recommendPriority,
    // Sizes & options — boards sharing a group render as one tile (see groupVariants on the client).
    variantGroup: p.variantGroup,
    variantLabel: p.variantLabel,
    variantOrder: p.variantOrder,
  };
  if (opts.includeCost) return { ...dto, cost: Number(p.cost) };
  return dto;
}

export function addOnDTO(a: AddOn) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    price: Number(a.price),
    unitType: a.unitType,
    unitLabel: a.unitLabel,
    servesPerUnit: a.servesPerUnit,
    suggestFromHeadcount: a.suggestFromHeadcount,
    imageUrl: a.imageUrl,
    active: a.active,
    sortOrder: a.sortOrder,
  };
}

export function orderItemDTO(i: OrderItem & { platter?: Platter | null }) {
  return {
    id: i.id,
    platterId: i.platterId,
    platterName: i.platter?.name ?? null,
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    lineTotal: toMoney(Number(i.unitPrice) * i.quantity),
  };
}

export function orderAddOnDTO(a: OrderAddOn) {
  return {
    id: a.id,
    addOnId: a.addOnId,
    name: a.name,
    quantity: a.quantity,
    unitPrice: Number(a.unitPrice),
    lineTotal: toMoney(Number(a.unitPrice) * a.quantity),
  };
}

export function boardComponentDTO(c: BoardComponent) {
  return {
    id: c.id,
    category: c.category,
    label: c.label,
    imageUrl: c.imageUrl,
    price: Number(c.price),
    isDefault: c.isDefault,
    active: c.active,
    sortOrder: c.sortOrder,
  };
}

export function boardGroupDTO(g: BoardComponentGroup, options?: BoardComponent[]) {
  return {
    id: g.id,
    key: g.key,
    heading: g.heading,
    maxSelections: g.maxSelections,
    includedFree: g.includedFree,
    sortOrder: g.sortOrder,
    active: g.active,
    ...(options ? { options: options.map(boardComponentDTO) } : {}),
  };
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

// Occasion category. `boardCount` / `boards` are attached by the route when it loads
// the assignments (list view sends the count; the landing page sends the full boards).
export function categoryDTO(
  c: Category & { platters?: { platter: Platter; sortOrder: number }[] | null },
  opts: { boardCount?: number } = {},
) {
  const assigned = c.platters
    ? [...c.platters].sort((a, b) => a.sortOrder - b.sortOrder).map((pc) => platterDTO(pc.platter))
    : undefined;
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    description: c.description,
    heroImageUrl: c.heroImageUrl,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    isCorporate: c.isCorporate,
    promotePlanner: c.promotePlanner,
    active: c.active,
    sortOrder: c.sortOrder,
    boardCount: opts.boardCount ?? assigned?.length ?? 0,
    ...(assigned ? { boards: assigned } : {}),
  };
}

export function corporateEnquiryDTO(e: CorporateEnquiry) {
  return {
    id: e.id,
    company: e.company,
    contactName: e.contactName,
    email: e.email,
    phone: e.phone,
    headcount: e.headcount,
    frequency: e.frequency,
    message: e.message,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
  };
}

/** A bundle with its items resolved to real board/add-on details + an honest component total.
 * `resolve` maps (kind, refId) -> the live board/add-on so a bundle reflects current prices. */
export function bundleDTO(
  b: Bundle & { items?: BundleItem[] | null },
  resolve: (kind: string, refId: string) => { name: string; price: number; imageUrl: string | null } | null,
) {
  const items = (b.items ?? [])
    .slice()
    .sort((x, y) => x.sortOrder - y.sortOrder)
    .map((it) => {
      const r = resolve(it.kind, it.refId);
      return r ? { kind: it.kind, refId: it.refId, quantity: it.quantity, name: r.name, price: r.price, imageUrl: r.imageUrl } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const total = toMoney(items.reduce((sum, it) => sum + it.price * it.quantity, 0));
  return {
    id: b.id,
    name: b.name,
    tagline: b.tagline,
    description: b.description,
    imageUrl: b.imageUrl,
    active: b.active,
    sortOrder: b.sortOrder,
    items,
    total,
  };
}

export function giftVoucherDTO(g: GiftVoucherRequest) {
  return {
    id: g.id,
    amount: Number(g.amount),
    buyerName: g.buyerName,
    buyerEmail: g.buyerEmail,
    buyerPhone: g.buyerPhone,
    recipientName: g.recipientName,
    message: g.message,
    status: g.status,
    createdAt: g.createdAt.toISOString(),
  };
}

export function subscriptionDTO(s: Subscription & { orders?: Order[] | null }) {
  return {
    id: s.id,
    status: s.status,
    frequency: s.frequency,
    discountPct: s.discountPct,
    customerName: s.customerName,
    email: s.email,
    phone: s.phone,
    invoiced: s.invoiced,
    notes: s.notes,
    orderCount: s.orders?.length ?? 0,
    createdAt: s.createdAt.toISOString(),
  };
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

// Mask contact details for the *public* order-lookup (GET /orders/:ref), which is
// reachable by anyone holding the order reference (a capability URL that customers
// are told to screenshot/bookmark). The owner still recognises their own masked
// phone/email; a leaked link no longer hands a stranger full contact details.
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `•••••${digits.slice(-3)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const head = local.slice(0, 1);
  return `${head}${"•".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

export function orderDTO(
  o: Order & {
    platter?: Platter | null;
    experience?: Experience | null;
    location?: Location | null;
    customer?: Customer | null;
    items?: (OrderItem & { platter?: Platter | null })[] | null;
    addOns?: OrderAddOn[] | null;
  },
) {
  const total = Number(o.total);
  const deposit = Number(o.deposit);
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
    quantity: o.quantity,
    occasion: o.occasion,
    customItems: Array.isArray(o.customItems) ? (o.customItems as string[]) : null,
    // v2 itemisation (boards + add-ons). Empty arrays for legacy single-platter orders.
    items: o.items ? o.items.map(orderItemDTO) : [],
    addOns: o.addOns ? o.addOns.map(orderAddOnDTO) : [],
    total,
    deposit,
    balance: toMoney(total - deposit), // payable on collection
    depositStatus: o.depositStatus,
    depositPaidAt: o.depositPaidAt ? o.depositPaidAt.toISOString() : null,
    // Subscribe & Save recurring intent (payment-ready, not payment-live).
    isSubscription: o.isSubscription,
    subscriptionFrequency: o.subscriptionFrequency,
    subscriptionDiscount: o.subscriptionDiscount != null ? Number(o.subscriptionDiscount) : null,
    subscriptionId: o.subscriptionId,
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

/**
 * Public-safe order view for the unauthenticated lookup (GET /orders/:ref).
 * Same shape as orderDTO, but the customer's phone/email are masked so a leaked
 * reference link can't be used to harvest full contact details. Admin routes keep
 * the full orderDTO.
 */
export function publicOrderDTO(
  o: Order & {
    platter?: Platter | null;
    experience?: Experience | null;
    location?: Location | null;
    customer?: Customer | null;
  },
) {
  const dto = orderDTO(o);
  // The confirmation page renders phone/email (masked), the gift address, the gift
  // message, the recipient and the referral code — but never the full customerName
  // or the free-text notes. So on this unauthenticated, link-shareable lookup we
  // return only the customer's FIRST name and drop notes entirely: a leaked ref
  // link can't yield a full identity or whatever the customer typed into notes.
  return {
    ...dto,
    customerName: dto.customerName.split(/\s+/)[0] ?? "",
    notes: null,
    phone: maskPhone(dto.phone),
    email: maskEmail(dto.email),
    // A delivery address is postal PII and must never travel on a link-shareable,
    // ref-only lookup. Latent today (orders are collection-only) but masked now so it
    // stays hidden the day delivery ships. The gift recipient/message are intentionally
    // shown on the buyer's own confirmation page and are left as-is.
    deliveryAddress: null,
  };
}
