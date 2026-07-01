import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

const boardComponentLabel = z.string().min(1).max(80);

// Platter order (collection) or gift delivery.
export const createOrderSchema = z
  .object({
    platterId: z.string().min(1),
    headcount: z.number().int().positive(),
    collectionOrDeliveryDate: dateString,
    locationId: z.string().min(1),
    customerName: z.string().min(1, "Name is required").max(120),
    phone: z.string().min(5, "A contact phone is required").max(30),
    email: z.string().email("A valid email is required"),
    notes: z.string().max(1000).optional(),
    src: z.enum(["direct", "qr", "instagram", "referral"]).optional(),
    referralCodeUsed: z.string().max(40).optional(),
    // gift
    isGift: z.boolean().optional(),
    recipientName: z.string().max(120).optional(),
    deliveryAddress: z.string().max(500).optional(),
    giftMessage: z.string().max(500).optional(),
    // board configurator only (category = "platters")
    quantity: z.number().int().positive().max(50).optional(),
    customItems: z.array(boardComponentLabel).max(30).optional(),
  })
  .refine((d) => !d.isGift || (!!d.recipientName?.trim() && !!d.deliveryAddress?.trim()), {
    message: "Gifts need a recipient name and delivery address",
    path: ["deliveryAddress"],
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
    category: z.enum(["home", "events", "seasonal", "platters"]).default("home"),
    name: z.string().min(1).max(120),
    description: z.string().max(2000),
    pricePerHead: z.number().positive().nullable().optional(),
    fixedPrice: z.number().positive().nullable().optional(),
    cost: z.number().nonnegative(),
    serves: z.string().max(40).nullable().optional(),
    minHeadcount: z.number().int().positive().default(1),
    items: z.array(platterItemSchema).min(1, "Add at least one item"),
    imageUrl: z.string().max(500).nullable().optional(), // absolute URL or /uploads/... path
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    // Board configurator only (category = "platters").
    boardType: z.enum(["charcuterie", "savoury", "cheese", "salmon"]).nullable().optional(),
    size: z.enum(["small", "medium", "large"]).nullable().optional(),
  })
  .refine((d) => (d.pricePerHead != null) !== (d.fixedPrice != null), {
    message: "Set either a per-head price OR a fixed price (not both, not neither)",
    path: ["pricePerHead"],
  });

export type PlatterUpsertInput = z.infer<typeof platterUpsertSchema>;

// Build-your-own ingredient picker (admin-managed).
export const boardComponentUpsertSchema = z.object({
  category: z.enum(["cheese", "meat", "savoury", "extra"]),
  label: z.string().min(1).max(80),
  imageUrl: z.string().max(500).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type BoardComponentUpsertInput = z.infer<typeof boardComponentUpsertSchema>;

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
