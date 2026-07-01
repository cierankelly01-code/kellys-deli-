// Typed API client. In dev, Vite proxies /api -> :4000 (see vite.config.ts).
// For a split deploy, set VITE_API_URL to the API origin.
const BASE = import.meta.env.VITE_API_URL || "";

export interface PlatterItem {
  label: string;
  qtyPerUnit: number;
}

export type Category = "home" | "events" | "seasonal" | "platters";
export type BoardType = "charcuterie" | "savoury" | "cheese" | "salmon";
export type BoardSize = "small" | "medium" | "large";
export type BoardComponentCategory = "cheese" | "meat" | "savoury" | "extra";

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
  cost?: number; // admin only
}

export interface BoardComponent {
  id: string;
  category: BoardComponentCategory;
  label: string;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
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
  customItems: string[] | null;
  total: number;
  deposit: number;
  depositStatus: string;
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

export interface CreateOrderInput {
  platterId: string;
  headcount: number;
  collectionOrDeliveryDate: string;
  locationId: string;
  customerName: string;
  phone: string;
  email: string;
  notes?: string;
  src?: string;
  referralCodeUsed?: string;
  isGift?: boolean;
  recipientName?: string;
  deliveryAddress?: string;
  giftMessage?: string;
  quantity?: number;
  customItems?: string[];
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
  platter: (id: string) => req<Platter>(`/api/platters/${id}`),
  experiences: () => req<Experience[]>("/api/experiences"),
  categories: () => req<CategoryCounts>("/api/categories"),
  locations: () => req<LocationT[]>("/api/locations"),
  boardComponents: () => req<BoardComponent[]>("/api/board-components"),
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
};
