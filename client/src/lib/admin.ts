// Admin API client + JWT token storage.
import { ApiError, type OrderDTO, type Platter, type PlatterItem, type LocationT, type Experience, type Category, type BoardComponent, type BoardComponentCategory, type BoardGroup, type BoardType, type BoardSize, type BoardTier, type AddOn, type AddOnUnitType, type ShopCategory, type SubscriptionFrequency, type Bundle, type BundleInput, type GiftVoucherRequestDTO, type BreadProduct, type BreadOrderDTO, type BreadOrderStatus } from "./api";

const BASE = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "kd_admin_token";

export const auth = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
  get isAuthed() {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};

async function authedReq<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { headers, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token ?? ""}`,
      ...(headers ?? {}),
    },
  });
  if (res.status === 401) {
    auth.clear();
    throw new ApiError("Session expired — please log in again", 401);
  }
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

export type AdminOrder = OrderDTO & { cost: number; profit: number };

export interface GroupTotals {
  revenue: number;
  profit: number;
  orders: number;
}
export interface OrdersSummary {
  combined: GroupTotals;
  byLocation: Array<{ locationId: string; locationName: string } & GroupTotals>;
  bySrc: Array<{ src: string } & GroupTotals>;
  byPlatter: Array<{ platterId: string; platterName: string } & GroupTotals>;
}
export interface PlatterMarginRow {
  id: string;
  name: string;
  basis: "fixed" | "per-head";
  price: number;
  cost: number;
  profit: number;
  marginPct: number;
}
export interface StatsResponse {
  all: OrdersSummary;
  month: OrdersSummary;
  week: OrdersSummary;
  marginRanking: PlatterMarginRow[];
}

export interface FillSlot {
  locationId: string;
  locationName: string;
  date: string;
  humanDate: string;
  capacity: number;
  booked: number;
  remaining: number;
  withinNotice: boolean;
  promo: string;
}
export interface FillSlotsResponse {
  days: number;
  slots: FillSlot[];
}

export interface PrepLine {
  label: string;
  quantity: number;
}
export interface PrepSheetResponse {
  location: { id: string; name: string };
  date: string;
  sheet: {
    totalOrders: number;
    totalHeadcount: number;
    lines: PrepLine[];
    byPlatter: Array<{ platterName: string; orders: number; headcount: number }>;
  };
  orders: Array<{ ref: string; platterName: string; headcount: number; customerName: string; status: string }>;
}

export type AdminPlatter = Platter & { cost: number };

export interface PlatterUpsertInput {
  category: Category;
  name: string;
  description: string;
  pricePerHead: number | null;
  fixedPrice: number | null;
  cost: number;
  serves: string | null;
  minHeadcount: number;
  items: PlatterItem[];
  imageUrl: string | null;
  active?: boolean;
  sortOrder?: number;
  boardType?: BoardType | null;
  size?: BoardSize | null;
  tier?: BoardTier | null;
  feedsMin?: number | null;
  feedsMax?: number | null;
  recommendEligible?: boolean;
  recommendPriority?: number;
  // Sizes & options. Send null explicitly to take a board back out of its group.
  variantGroup?: string | null;
  variantLabel?: string | null;
  variantOrder?: number;
}

export type AdminAddOn = AddOn;

export interface AddOnUpsertInput {
  name: string;
  description?: string | null;
  price: number;
  unitType: AddOnUnitType;
  unitLabel?: string | null;
  servesPerUnit?: number | null;
  suggestFromHeadcount?: boolean;
  imageUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export interface BoardComponentUpsertInput {
  category: BoardComponentCategory;
  label: string;
  imageUrl?: string | null;
  price?: number; // £ added when beyond the group's free allowance
  isDefault?: boolean; // pre-selected in the customer configurator
  active?: boolean;
  sortOrder?: number;
}

// Group rules are edit-only: the five groups are fixed, admin tunes their behaviour.
export type AdminBoardGroup = Omit<BoardGroup, "options">;

export interface BoardGroupUpdateInput {
  heading?: string;
  maxSelections?: number | null;
  includedFree?: number;
  sortOrder?: number;
  active?: boolean;
}

export type AdminExperience = Experience & { cost: number };

export interface ExperienceUpsertInput {
  name: string;
  description: string;
  pricePerHead: number;
  cost: number;
  capacity: number;
  imageUrl: string | null;
  active?: boolean;
  sortOrder?: number;
}

export interface SmsCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  referralCode: string;
  isBigSpender: boolean;
  lifetimeSpend: number;
  orderCount: number;
  lastOrderAt: string | null;
}

export type AdminShopCategory = ShopCategory & { boards: Platter[] };

export interface CategoryUpsertInput {
  slug: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  heroImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isCorporate?: boolean;
  promotePlanner?: boolean;
  active?: boolean;
  sortOrder?: number;
}

export interface CorporateEnquiryDTO {
  id: string;
  company: string;
  contactName: string;
  email: string;
  phone: string | null;
  headcount: number | null;
  frequency: string | null;
  message: string | null;
  status: "new" | "contacted" | "closed";
  createdAt: string;
}

export interface AdminReminder {
  id: string;
  email: string;
  occasion: string;
  reminderDate: string | null;
  phone?: string | null;
  emailStatus?: string;
  smsStatus?: string;
  cancelled?: boolean;
  notified: boolean;
  createdAt: string;
}

export interface SubscriptionDTO {
  id: string;
  status: "pending" | "active" | "paused" | "cancelled";
  frequency: SubscriptionFrequency;
  discountPct: number;
  customerName: string;
  email: string;
  phone: string;
  invoiced: boolean;
  notes: string | null;
  orderCount: number;
  createdAt: string;
}

// --- Bread pre-ordering ---

export interface BreadProductUpsertInput {
  name: string;
  description?: string | null;
  price: number;
  active?: boolean;
  sortOrder?: number;
  locationIds: string[];
}

export interface BreadSettingsDTO {
  leadTimeHours: number;
  cutoffMode: "rolling" | "cutoff";
  cutoffDaysBefore: number | null;
  cutoffTime: string | null;
  minOrderQty: number;
  maxItemQty: number;
}

export interface BreadShopSettingDTO {
  locationId: string;
  locationName: string;
  dailyCapacity: number | null;
  closedWeekdays: number[];
  notifyEmail: string | null;
}

export interface BreadClosureDTO {
  id: string;
  locationId: string;
  date: string;
  reason: string | null;
}

export interface BreadBakeSheetLine {
  name: string;
  quantity: number;
}
export interface BreadBakeSheetOrder {
  ref: string;
  customerName: string;
  status: BreadOrderStatus;
  notes: string | null;
  items: { name: string; quantity: number }[];
}
export interface BreadBakeSheetResponse {
  date: string;
  shops: Array<{
    location: { id: string; name: string };
    sheet: { totalOrders: number; totalItems: number; lines: BreadBakeSheetLine[]; orders: BreadBakeSheetOrder[] };
  }>;
}

export const adminApi = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error || "Login failed", res.status);
    }
    const data = (await res.json()) as { token: string; user: { email: string; role: string } };
    auth.set(data.token);
    return data;
  },
  orders: (filters: { location?: string; date?: string; status?: string; type?: string } = {}) => {
    const q = new URLSearchParams();
    if (filters.location) q.set("location", filters.location);
    if (filters.date) q.set("date", filters.date);
    if (filters.status) q.set("status", filters.status);
    if (filters.type) q.set("type", filters.type);
    const qs = q.toString();
    return authedReq<AdminOrder[]>(`/api/admin/orders${qs ? `?${qs}` : ""}`);
  },
  setStatus: (id: string, status: string) =>
    authedReq<AdminOrder>(`/api/admin/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  prepSheet: (locationId: string, date: string) =>
    authedReq<PrepSheetResponse>(`/api/admin/prep-sheet?locationId=${locationId}&date=${date}`),
  stats: () => authedReq<StatsResponse>(`/api/admin/stats`),

  // Menu & pricing
  platters: () => authedReq<AdminPlatter[]>(`/api/admin/platters`),
  createPlatter: (input: PlatterUpsertInput) =>
    authedReq<AdminPlatter>(`/api/admin/platters`, { method: "POST", body: JSON.stringify(input) }),
  updatePlatter: (id: string, input: PlatterUpsertInput) =>
    authedReq<AdminPlatter>(`/api/admin/platters/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deletePlatter: (id: string) => authedReq<{ ok: boolean }>(`/api/admin/platters/${id}`, { method: "DELETE" }),
  locations: () => authedReq<LocationT[]>(`/api/admin/locations`),
  updateLocation: (id: string, patch: { name?: string; weeklyCapacity?: number; active?: boolean }) =>
    authedReq<LocationT>(`/api/admin/locations/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  // Build-your-own board ingredients
  boardComponents: () => authedReq<BoardComponent[]>(`/api/admin/board-components`),
  createBoardComponent: (input: BoardComponentUpsertInput) =>
    authedReq<BoardComponent>(`/api/admin/board-components`, { method: "POST", body: JSON.stringify(input) }),
  updateBoardComponent: (id: string, input: BoardComponentUpsertInput) =>
    authedReq<BoardComponent>(`/api/admin/board-components/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteBoardComponent: (id: string) =>
    authedReq<{ ok: boolean }>(`/api/admin/board-components/${id}`, { method: "DELETE" }),
  boardGroups: () => authedReq<AdminBoardGroup[]>(`/api/admin/board-groups`),
  updateBoardGroup: (id: string, patch: BoardGroupUpdateInput) =>
    authedReq<AdminBoardGroup>(`/api/admin/board-groups/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  // Experiences
  experiences: () => authedReq<AdminExperience[]>(`/api/admin/experiences`),
  createExperience: (input: ExperienceUpsertInput) =>
    authedReq<AdminExperience>(`/api/admin/experiences`, { method: "POST", body: JSON.stringify(input) }),
  updateExperience: (id: string, input: ExperienceUpsertInput) =>
    authedReq<AdminExperience>(`/api/admin/experiences/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  // Add-ons (upsell items)
  addOns: () => authedReq<AdminAddOn[]>(`/api/admin/add-ons`),
  createAddOn: (input: AddOnUpsertInput) =>
    authedReq<AdminAddOn>(`/api/admin/add-ons`, { method: "POST", body: JSON.stringify(input) }),
  updateAddOn: (id: string, input: AddOnUpsertInput) =>
    authedReq<AdminAddOn>(`/api/admin/add-ons/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteAddOn: (id: string) => authedReq<{ ok: boolean }>(`/api/admin/add-ons/${id}`, { method: "DELETE" }),

  // Occasion categories
  categories: () => authedReq<AdminShopCategory[]>(`/api/admin/categories`),
  createCategory: (input: CategoryUpsertInput) =>
    authedReq<AdminShopCategory>(`/api/admin/categories`, { method: "POST", body: JSON.stringify(input) }),
  updateCategory: (id: string, input: CategoryUpsertInput) =>
    authedReq<AdminShopCategory>(`/api/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteCategory: (id: string) => authedReq<{ ok: boolean }>(`/api/admin/categories/${id}`, { method: "DELETE" }),
  assignCategoryBoards: (id: string, platterIds: string[]) =>
    authedReq<AdminShopCategory>(`/api/admin/categories/${id}/boards`, { method: "PUT", body: JSON.stringify({ platterIds }) }),

  // Corporate enquiries + reminders + subscriptions
  corporateEnquiries: () => authedReq<CorporateEnquiryDTO[]>(`/api/admin/corporate-enquiries`),
  setEnquiryStatus: (id: string, status: "new" | "contacted" | "closed") =>
    authedReq<CorporateEnquiryDTO>(`/api/admin/corporate-enquiries/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  reminders: () => authedReq<AdminReminder[]>(`/api/admin/reminders`),
  subscriptions: () => authedReq<SubscriptionDTO[]>(`/api/admin/subscriptions`),
  setSubscriptionStatus: (id: string, status: "pending" | "active" | "paused" | "cancelled") =>
    authedReq<SubscriptionDTO>(`/api/admin/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // Bundles (curated one-tap combos)
  bundles: () => authedReq<Bundle[]>(`/api/admin/bundles`),
  createBundle: (input: BundleInput) =>
    authedReq<Bundle>(`/api/admin/bundles`, { method: "POST", body: JSON.stringify(input) }),
  updateBundle: (id: string, input: BundleInput) =>
    authedReq<Bundle>(`/api/admin/bundles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteBundle: (id: string) => authedReq<{ ok: boolean }>(`/api/admin/bundles/${id}`, { method: "DELETE" }),

  // Gift voucher requests
  giftVouchers: () => authedReq<GiftVoucherRequestDTO[]>(`/api/admin/gift-vouchers`),
  setGiftVoucherStatus: (id: string, status: "new" | "contacted" | "fulfilled" | "closed") =>
    authedReq<GiftVoucherRequestDTO>(`/api/admin/gift-vouchers/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // Settings (global toggles)
  settings: () => authedReq<Record<string, string>>(`/api/admin/settings`),
  setSetting: (key: string, value: string) =>
    authedReq<{ key: string; value: string }>(`/api/admin/settings/${key}`, { method: "PATCH", body: JSON.stringify({ value }) }),

  // SMS list + blast
  customers: () => authedReq<SmsCustomer[]>(`/api/admin/customers`),
  setBigSpender: (id: string, isBigSpender: boolean) =>
    authedReq<{ id: string; isBigSpender: boolean }>(`/api/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify({ isBigSpender }) }),
  customersCsv: async (): Promise<string> => {
    const res = await fetch(`${BASE}/api/admin/customers/export`, { headers: { Authorization: `Bearer ${auth.token ?? ""}` } });
    if (res.status === 401) { auth.clear(); throw new ApiError("Session expired — please log in again", 401); }
    if (!res.ok) throw new ApiError("Export failed", res.status);
    return res.text();
  },
  blast: (message: string, audience: "all" | "big_spenders") =>
    authedReq<{ sent: number; audience: string }>(`/api/admin/sms/blast`, { method: "POST", body: JSON.stringify({ message, audience }) }),

  uploadImage: async (file: File): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append("image", file);
    // Note: do NOT set Content-Type — the browser sets the multipart boundary itself.
    const res = await fetch(`${BASE}/api/admin/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token ?? ""}` },
      body: fd,
    });
    if (res.status === 401) { auth.clear(); throw new ApiError("Session expired — please log in again", 401); }
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new ApiError(b.error || "Upload failed", res.status);
    }
    return res.json();
  },

  fillSlots: (days = 7) => authedReq<FillSlotsResponse>(`/api/admin/fill-slots?days=${days}`),

  wipeTestData: () =>
    authedReq<{ orders: number; customers: number; referrals: number }>(`/api/admin/wipe-test-data`, {
      method: "POST",
      body: JSON.stringify({ confirm: "DELETE ALL DATA" }),
    }),

  // Bread pre-ordering
  bread: {
    products: () => authedReq<BreadProduct[]>(`/api/admin/bread/products`),
    createProduct: (input: BreadProductUpsertInput) =>
      authedReq<BreadProduct>(`/api/admin/bread/products`, { method: "POST", body: JSON.stringify(input) }),
    updateProduct: (id: string, input: Partial<BreadProductUpsertInput>) =>
      authedReq<BreadProduct>(`/api/admin/bread/products/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteProduct: (id: string) => authedReq<{ ok: boolean }>(`/api/admin/bread/products/${id}`, { method: "DELETE" }),

    orders: (filters: { locationId?: string; date?: string; status?: string; q?: string } = {}) => {
      const q = new URLSearchParams();
      if (filters.locationId) q.set("locationId", filters.locationId);
      if (filters.date) q.set("date", filters.date);
      if (filters.status) q.set("status", filters.status);
      if (filters.q) q.set("q", filters.q);
      const qs = q.toString();
      return authedReq<BreadOrderDTO[]>(`/api/admin/bread/orders${qs ? `?${qs}` : ""}`);
    },
    setOrderStatus: (id: string, status: BreadOrderStatus) =>
      authedReq<BreadOrderDTO>(`/api/admin/bread/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    deleteOrder: (id: string) => authedReq<{ ok: boolean }>(`/api/admin/bread/orders/${id}`, { method: "DELETE" }),

    bakeSheet: (date: string, locationId?: string) =>
      authedReq<BreadBakeSheetResponse>(`/api/admin/bread/bake-sheet?date=${date}${locationId ? `&locationId=${locationId}` : ""}`),

    settings: () => authedReq<BreadSettingsDTO>(`/api/admin/bread/settings`),
    updateSettings: (patch: Partial<BreadSettingsDTO>) =>
      authedReq<BreadSettingsDTO>(`/api/admin/bread/settings`, { method: "PATCH", body: JSON.stringify(patch) }),

    shopSettings: () => authedReq<BreadShopSettingDTO[]>(`/api/admin/bread/shop-settings`),
    updateShopSettings: (locationId: string, patch: { dailyCapacity?: number | null; closedWeekdays?: number[]; notifyEmail?: string | null }) =>
      authedReq<BreadShopSettingDTO>(`/api/admin/bread/shop-settings/${locationId}`, { method: "PATCH", body: JSON.stringify(patch) }),

    closures: (locationId?: string) =>
      authedReq<BreadClosureDTO[]>(`/api/admin/bread/closures${locationId ? `?locationId=${locationId}` : ""}`),
    createClosure: (input: { locationId: string; date: string; reason?: string | null }) =>
      authedReq<BreadClosureDTO>(`/api/admin/bread/closures`, { method: "POST", body: JSON.stringify(input) }),
    deleteClosure: (id: string) => authedReq<{ ok: boolean }>(`/api/admin/bread/closures/${id}`, { method: "DELETE" }),
  },
};
