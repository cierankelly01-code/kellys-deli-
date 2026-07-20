// Typed API client. In dev, Vite proxies /api -> :4000 (see vite.config.ts).
// For a split deploy, set VITE_API_URL to the API origin.
const BASE = import.meta.env.VITE_API_URL || "";

export interface PlatterItem {
  label: string;
  qtyPerUnit: number;
}

export type Category = "home" | "events" | "seasonal" | "platters" | "board";
export type BoardType = "charcuterie" | "savoury" | "cheese" | "salmon";
export type BoardSize = "small" | "medium" | "large";
export type BoardTier = "signature" | "gallery";
export type BoardComponentCategory = "cheese" | "meat" | "savoury" | "cracker" | "jam";

export interface Platter {
  id: string;
  category: Category;
  name: string;
  description: string;
  pricePerHead: number | null;
  fixedPrice: number | null;
  serves: string | null;
  minHeadcount: number;
  items: PlatterItem[];
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
  isFixed: boolean;
  fromPrice: number;
  boardType: BoardType | null;
  size: BoardSize | null;
  // v2 board catalogue
  tier: BoardTier | null;
  feedsMin: number | null;
  feedsMax: number | null;
  recommendEligible: boolean;
  recommendPriority: number;
  cost?: number; // admin only
}

export type AddOnUnitType = "per_person" | "per_order" | "serves";

export interface AddOn {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unitType: AddOnUnitType;
  unitLabel: string | null;
  servesPerUnit: number | null;
  suggestFromHeadcount: boolean;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
}

export interface RecommendItem {
  boardId: string;
  qty: number;
  board: Platter;
  feedsEach: number;
}

export interface RecommendResponse {
  headcount: number;
  items: RecommendItem[];
  totalFeeds: number;
  totalPrice: number;
  undercatered: boolean;
}

export const OCCASIONS = ["Birthday", "Corporate", "Family gathering", "Other"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const SUBSCRIPTION_FREQUENCIES = ["weekly", "fortnightly", "monthly"] as const;
export type SubscriptionFrequency = (typeof SUBSCRIPTION_FREQUENCIES)[number];
export const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  weekly: "Every week",
  fortnightly: "Every two weeks",
  monthly: "Every month",
};

// Occasion-based storefront category (admin-managed). Distinct from the `Category`
// string union above, which is the Platter *type* classifier.
export interface ShopCategory {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  heroImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isCorporate: boolean;
  promotePlanner: boolean;
  active: boolean;
  sortOrder: number;
  boardCount: number;
  boards?: Platter[]; // present on the single-category (landing page) response
}

export interface CorporateEnquiryInput {
  company: string;
  contactName: string;
  email: string;
  phone?: string;
  headcount?: number;
  frequency?: "one-off" | "weekly" | "fortnightly" | "monthly";
  message?: string;
}

export interface ReminderInput {
  email: string;
  occasion: string;
  reminderDate?: string;
}

export interface BoardComponent {
  id: string;
  category: BoardComponentCategory;
  label: string;
  imageUrl: string | null;
  price: number; // £ added when the selection exceeds the group's free allowance
  isDefault: boolean; // pre-selected in the configurator
  active: boolean;
  sortOrder: number;
}

// Configurator group rules + options, from GET /api/board-config.
export interface BoardGroup {
  id: string;
  key: BoardComponentCategory;
  heading: string;
  maxSelections: number | null; // null = unlimited
  includedFree: number; // this many picks are free (cheapest first) before option prices apply
  sortOrder: number;
  active: boolean;
  options: BoardComponent[];
}

export interface Experience {
  id: string;
  name: string;
  description: string;
  pricePerHead: number;
  capacity: number;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
  cost?: number; // admin only
}

export interface LocationT {
  id: string;
  name: string;
  slug: string;
  weeklyCapacity: number;
  active: boolean;
}

export interface CategoryCounts {
  home: number;
  events: number;
  seasonal: number;
  platters: number;
  experiences: number;
  tastingsComingSoon: boolean;
  clickCollectComingSoon: boolean;
  openingHours: string | null;
  aboutText: string | null;
  heroImageUrl: string | null;
  missionTagline: string | null;
  founderNote: string | null;
  reviewRating: string | null;
  reviewCount: string | null;
  firstOrderHook: boolean;
  firstOrderHookText: string | null;
  subscribeSave: boolean;
  subscribeSaveDiscountPct: number;
  corporateNextDayDelivery: boolean;
  freeGift: boolean;
  freeGiftThreshold: number;
  freeGiftText: string | null;
}

export interface OpeningHours {
  mon: string; tue: string; wed: string; thu: string; fri: string; sat: string; sun: string;
}

export type DayStatus = "open" | "limited" | "full" | "closed";

export interface DayAvailability {
  date: string;
  capacity: number;
  booked: number;
  remaining: number;
  status: DayStatus;
  bookable: boolean;
}

export interface AvailabilityResponse {
  locationId: string;
  capacity: number;
  days: DayAvailability[];
}

export interface Pricing {
  base: number;
  discount: number;
  total: number;
  deposit: number;
  balance?: number;
  boardsTotal?: number;
  addOnsTotal?: number;
  subscriptionDiscount?: number;
}

export interface OrderItemDTO {
  id: string;
  platterId: string;
  platterName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderAddOnDTO {
  id: string;
  addOnId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderDTO {
  id: string;
  ref: string;
  type: string;
  platterId: string | null;
  platterName: string | null;
  experienceId: string | null;
  experienceName: string | null;
  headcount: number;
  quantity: number | null;
  occasion: string | null;
  customItems: string[] | null;
  items: OrderItemDTO[];
  addOns: OrderAddOnDTO[];
  total: number;
  deposit: number;
  balance: number;
  depositStatus: string;
  depositPaidAt: string | null;
  isSubscription: boolean;
  subscriptionFrequency: SubscriptionFrequency | null;
  subscriptionDiscount: number | null;
  subscriptionId: string | null;
  isGift: boolean;
  recipientName: string | null;
  deliveryAddress: string | null;
  giftMessage: string | null;
  collectionOrDeliveryDate: string;
  locationId: string;
  locationName: string | null;
  customerName: string;
  phone: string;
  email: string;
  notes: string | null;
  freebie: string | null;
  status: string;
  src: string;
  referralCodeUsed: string | null;
  customerReferralCode: string | null;
  createdAt: string;
}

export interface ReorderResult {
  platterId: string;
  platterName: string;
  headcount: number;
  locationId: string;
  locationName: string;
  notes: string | null;
}

export interface OrderItemInput {
  platterId: string;
  quantity: number;
}
export interface OrderAddOnInput {
  addOnId: string;
  quantity: number;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  addOns?: OrderAddOnInput[];
  headcount: number;
  occasion?: Occasion;
  collectionOrDeliveryDate: string;
  locationId: string;
  customerName: string;
  phone: string;
  email: string;
  notes?: string;
  src?: string;
  referralCodeUsed?: string;
  // Subscribe & Save recurring intent.
  isSubscription?: boolean;
  subscriptionFrequency?: SubscriptionFrequency;
  // Gift-a-board (printed note tucked with the board).
  isGift?: boolean;
  recipientName?: string;
  giftMessage?: string;
}

export interface CreateBookingInput {
  experienceId: string;
  partySize: number;
  date: string;
  locationId: string;
  customerName: string;
  phone: string;
  email: string;
  notes?: string;
  src?: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers, ...rest } = init ?? {};
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  platters: (category?: Category) =>
    req<Platter[]>(`/api/platters${category ? `?category=${category}` : ""}`),
  // v2 boards by tier (signature | gallery); omit for all boards.
  boards: (tier?: BoardTier) =>
    req<Platter[]>(`/api/platters?category=board${tier ? `&tier=${tier}` : ""}`),
  platter: (id: string) => req<Platter>(`/api/platters/${id}`),
  addOns: () => req<AddOn[]>("/api/add-ons"),
  recommend: (headcount: number) => req<RecommendResponse>(`/api/recommend?headcount=${headcount}`),
  experiences: () => req<Experience[]>("/api/experiences"),
  categories: () => req<CategoryCounts>("/api/categories"),
  // Occasion storefront categories.
  shopCategories: () => req<ShopCategory[]>("/api/categories/browse"),
  shopCategory: (slug: string) => req<ShopCategory>(`/api/categories/${encodeURIComponent(slug)}`),
  corporateEnquiry: (body: CorporateEnquiryInput) =>
    req<{ ok: true }>("/api/corporate-enquiry", { method: "POST", body: JSON.stringify(body) }),
  reminder: (body: ReminderInput) =>
    req<{ ok: true }>("/api/reminders", { method: "POST", body: JSON.stringify(body) }),
  paymentsStatus: () => req<{ enabled: boolean }>("/api/payments/status"),
  locations: () => req<LocationT[]>("/api/locations"),
  boardComponents: () => req<BoardComponent[]>("/api/board-components"),
  boardConfig: () => req<{ groups: BoardGroup[] }>("/api/board-config"),
  availability: (locationId: string, from?: string, days = 21) => {
    const q = new URLSearchParams({ locationId, days: String(days) });
    if (from) q.set("from", from);
    return req<AvailabilityResponse>(`/api/availability?${q.toString()}`);
  },
  experienceAvailability: (experienceId: string, locationId: string, from?: string, days = 21) => {
    const q = new URLSearchParams({ experienceId, locationId, days: String(days) });
    if (from) q.set("from", from);
    return req<AvailabilityResponse>(`/api/experiences/availability?${q.toString()}`);
  },
  createOrder: (body: CreateOrderInput) =>
    req<{ order: OrderDTO; pricing: Pricing; freebie: string | null }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createBooking: (body: CreateBookingInput) =>
    req<{ order: OrderDTO; pricing: Pricing }>("/api/bookings", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getOrder: (ref: string) => req<OrderDTO>(`/api/orders/${ref}`),
  reorder: (contact: string) => req<ReorderResult>(`/api/reorder?contact=${encodeURIComponent(contact)}`),
  // Validate a referral code against the buyer's contact before promising the discount.
  checkReferral: (code: string, phone: string, email: string) => {
    const q = new URLSearchParams({ code, phone, email });
    return req<{ valid: boolean; discount: number }>(`/api/referral/check?${q.toString()}`);
  },
};
