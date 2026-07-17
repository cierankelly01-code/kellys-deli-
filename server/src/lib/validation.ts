import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

// v2 line-item order: one or more boards + optional add-ons, plus the shared contact fields.
// Also accepts the legacy single-platter shape ({ platterId, quantity }) and normalises it
// to a single item downstream, so old links / clients keep working.
const orderItemInput = z.object({
  platterId: z.string().min(1),
  quantity: z.number().int().positive().max(50),
});
const orderAddOnInput = z.object({
  addOnId: z.string().min(1),
  quantity: z.number().int().positive().max(500),
});

export const OCCASIONS = ["Birthday", "Corporate", "Family gathering", "Other"] as const;

export const SUBSCRIPTION_FREQUENCIES = ["weekly", "fortnightly", "monthly"] as const;

export const createOrderSchema = z
  .object({
    items: z.array(orderItemInput).min(1, "Add at least one board").max(20).optional(),
    addOns: z.array(orderAddOnInput).max(30).optional(),
    headcount: z.number().int().positive().max(1000, "Headcount looks too large"),
    occasion: z.enum(OCCASIONS).optional(),
    collectionOrDeliveryDate: dateString,
    locationId: z.string().min(1),
    customerName: z.string().min(1, "Name is required").max(120),
    phone: z.string().min(5, "A contact phone is required").max(30),
    email: z.string().email("A valid email is required"),
    notes: z.string().max(1000).optional(),
    src: z.enum(["direct", "qr", "instagram", "referral"]).optional(),
    referralCodeUsed: z.string().max(40).optional(),
    // Subscribe & Save recurring intent. The server reprices with the discount and creates
    // a Subscription record; no card is taken (payment-ready, not payment-live).
    isSubscription: z.boolean().optional(),
    subscriptionFrequency: z.enum(SUBSCRIPTION_FREQUENCIES).optional(),
    // Gift-a-board: a printed note tucked with the board (surfaces recipientName/giftMessage).
    isGift: z.boolean().optional(),
    recipientName: z.string().max(120).optional(),
    giftMessage: z.string().max(500).optional(),
    // Legacy single-board shape (normalised to a one-item `items` array in the route).
    platterId: z.string().min(1).optional(),
    quantity: z.number().int().positive().max(50).optional(),
  })
  .refine((d) => (d.items && d.items.length > 0) || !!d.platterId, {
    message: "Add at least one board",
    path: ["items"],
  })
  .refine((d) => !d.isSubscription || !!d.subscriptionFrequency, {
    message: "Choose how often you'd like your board",
    path: ["subscriptionFrequency"],
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// Experience (tasting) booking.
export const createBookingSchema = z.object({
  experienceId: z.string().min(1),
  partySize: z.number().int().positive().max(100),
  date: dateString,
  locationId: z.string().min(1),
  customerName: z.string().min(1, "Name is required").max(120),
  phone: z.string().min(5, "A contact phone is required").max(30),
  email: z.string().email("A valid email is required"),
  notes: z.string().max(1000).optional(),
  src: z.enum(["direct", "qr", "instagram", "referral"]).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const availabilityQuerySchema = z.object({
  locationId: z.string().min(1),
  from: dateString.optional(),
  days: z.coerce.number().int().min(1).max(60).optional(),
});

export const experienceAvailabilityQuerySchema = availabilityQuerySchema.extend({
  experienceId: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const platterItemSchema = z.object({
  label: z.string().min(1).max(80),
  qtyPerUnit: z.number().positive(),
});

// Full platter payload (the editor sends the whole object on Save).
export const platterUpsertSchema = z
  .object({
    // "board" is the v2 catalogue category (signature + gallery boards).
    category: z.enum(["home", "events", "seasonal", "platters", "board"]).default("board"),
    name: z.string().min(1).max(120),
    description: z.string().max(2000),
    pricePerHead: z.number().positive().nullable().optional(),
    fixedPrice: z.number().positive().nullable().optional(),
    cost: z.number().nonnegative(),
    serves: z.string().max(40).nullable().optional(),
    minHeadcount: z.number().int().positive().default(1),
    items: z.array(platterItemSchema).default([]), // prep items optional — photo/description/price is enough
    imageUrl: z.string().max(500).nullable().optional(), // absolute URL or /uploads/... path
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    // Board configurator only (category = "platters").
    boardType: z.enum(["charcuterie", "savoury", "cheese", "salmon"]).nullable().optional(),
    size: z.enum(["small", "medium", "large"]).nullable().optional(),
    // v2 board catalogue fields.
    tier: z.enum(["signature", "gallery"]).nullable().optional(),
    feedsMin: z.number().int().positive().max(1000).nullable().optional(),
    feedsMax: z.number().int().positive().max(1000).nullable().optional(),
    recommendEligible: z.boolean().optional(),
    recommendPriority: z.number().int().min(0).max(1000).optional(),
  })
  .refine((d) => (d.pricePerHead != null) !== (d.fixedPrice != null), {
    message: "Set either a per-head price OR a fixed price (not both, not neither)",
    path: ["pricePerHead"],
  })
  // Board-configurator platters MUST be fixed-price: pricing folds extras into the
  // fixed price and multiplies by quantity, both of which are ignored for per-head.
  .refine((d) => d.category !== "platters" || d.fixedPrice != null, {
    message: "Build-your-own boards must use a fixed price, not a per-head price",
    path: ["fixedPrice"],
  })
  // v2 boards are flat fixed-price items.
  .refine((d) => d.category !== "board" || d.fixedPrice != null, {
    message: "Boards must use a fixed price",
    path: ["fixedPrice"],
  })
  // Feeds range must be coherent when both are set.
  .refine((d) => d.feedsMin == null || d.feedsMax == null || d.feedsMax >= d.feedsMin, {
    message: "Max feeds must be greater than or equal to min feeds",
    path: ["feedsMax"],
  });

export type PlatterUpsertInput = z.infer<typeof platterUpsertSchema>;

// Add-on editor payload (admin-managed upsell items).
export const addOnUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().nonnegative().max(99999),
  unitType: z.enum(["per_person", "per_order", "serves"]).default("per_order"),
  unitLabel: z.string().max(60).nullable().optional(),
  servesPerUnit: z.number().int().positive().max(1000).nullable().optional(),
  suggestFromHeadcount: z.boolean().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type AddOnUpsertInput = z.infer<typeof addOnUpsertSchema>;

// Event recommender query.
export const recommendQuerySchema = z.object({
  headcount: z.coerce.number().int().positive().max(1000),
});

// Build-your-own ingredient picker (admin-managed).
export const boardComponentUpsertSchema = z.object({
  category: z.enum(["cheese", "meat", "savoury", "cracker", "jam"]),
  // No commas: chosen labels travel comma-joined in the order URL (client Order.tsx).
  label: z.string().min(1).max(80).refine((s) => !s.includes(","), "Labels can't contain commas"),
  imageUrl: z.string().max(500).nullable().optional(),
  price: z.number().nonnegative().max(9999).optional(), // £ added when beyond the group's free allowance
  isDefault: z.boolean().optional(), // pre-selected in the customer configurator
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type BoardComponentUpsertInput = z.infer<typeof boardComponentUpsertSchema>;

// Configurator group rules (fixed set of five rows; admin edits rules, never creates groups).
export const boardGroupUpdateSchema = z.object({
  heading: z.string().min(1).max(120).optional(),
  maxSelections: z.number().int().positive().max(30).nullable().optional(),
  includedFree: z.number().int().nonnegative().max(30).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export type BoardGroupUpdateInput = z.infer<typeof boardGroupUpdateSchema>;

// Experience editor payload.
export const experienceUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000),
  pricePerHead: z.number().positive(),
  cost: z.number().nonnegative(),
  capacity: z.number().int().positive().max(500),
  imageUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type ExperienceUpsertInput = z.infer<typeof experienceUpsertSchema>;

export const locationUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  weeklyCapacity: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const settingSchema = z.object({
  value: z.string().max(500),
});

export const blastSchema = z.object({
  message: z.string().min(1, "Message is required").max(640),
  audience: z.enum(["all", "big_spenders"]).default("all"),
});

// --- Occasion categories (admin-managed storefront) ---
const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const categoryUpsertSchema = z.object({
  slug: z.string().min(1).max(60).regex(slugRe, "Slug must be lowercase words separated by hyphens"),
  name: z.string().min(1).max(80),
  tagline: z.string().max(160).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  heroImageUrl: z.string().max(500).nullable().optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(320).nullable().optional(),
  isCorporate: z.boolean().optional(),
  promotePlanner: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type CategoryUpsertInput = z.infer<typeof categoryUpsertSchema>;

// Replace a category's assigned boards (ordered).
export const categoryAssignSchema = z.object({
  platterIds: z.array(z.string().min(1)).max(200),
});

// --- Corporate / office enquiry (lands in admin) ---
export const corporateEnquirySchema = z.object({
  company: z.string().min(1, "Company name is required").max(160),
  contactName: z.string().min(1, "Your name is required").max(120),
  email: z.string().email("A valid email is required"),
  phone: z.string().max(30).optional(),
  headcount: z.number().int().positive().max(100000).optional(),
  frequency: z.enum(["one-off", "weekly", "fortnightly", "monthly"]).optional(),
  message: z.string().max(2000).optional(),
});
export type CorporateEnquiryInput = z.infer<typeof corporateEnquirySchema>;

// --- "Never miss it" reminder capture ---
export const reminderSchema = z.object({
  email: z.string().email("A valid email is required"),
  occasion: z.string().min(1, "Tell us the occasion").max(120),
  reminderDate: dateString.optional(),
});
export type ReminderInput = z.infer<typeof reminderSchema>;

export const enquiryStatusSchema = z.object({ status: z.enum(["new", "contacted", "closed"]) });
export const subscriptionStatusSchema = z.object({ status: z.enum(["pending", "active", "paused", "cancelled"]) });
