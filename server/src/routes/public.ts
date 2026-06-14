import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  createOrderSchema,
  createBookingSchema,
  availabilityQuerySchema,
  experienceAvailabilityQuerySchema,
} from "../lib/validation";
import { priceOrder } from "../lib/money";
import { buildAvailability, canBook, getDayAvailability, meetsNotice, parseDate, formatDate } from "../lib/capacity";
import { genRef, randomReferralCode } from "../lib/ref";
import { captureDepositIntent } from "../lib/payments";
import { notifyOrderReceived } from "../lib/notify";
import { platterDTO, experienceDTO, locationDTO, orderDTO } from "../lib/serialize";

export const publicRouter = Router();

class CapacityError extends Error {}

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? null;
}

// Generate a unique order ref within a transaction.
async function uniqueRef(tx: { order: { findUnique: (a: any) => Promise<unknown> } }): Promise<string> {
  let ref = genRef();
  for (let i = 0; i < 5; i++) {
    if (!(await tx.order.findUnique({ where: { ref } }))) break;
    ref = genRef();
  }
  return ref;
}

// --- Menu ---
publicRouter.get("/platters", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const platters = await prisma.platter.findMany({
    where: { active: true, ...(category ? { category } : {}) },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(platters.map((p) => platterDTO(p)));
});

publicRouter.get("/platters/:id", async (req, res) => {
  const platter = await prisma.platter.findUnique({ where: { id: req.params.id } });
  if (!platter || !platter.active) return res.status(404).json({ error: "Platter not found" });
  res.json(platterDTO(platter));
});

publicRouter.get("/experiences", async (_req, res) => {
  const experiences = await prisma.experience.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(experiences.map((e) => experienceDTO(e)));
});

publicRouter.get("/locations", async (_req, res) => {
  const locations = await prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  res.json(locations.map(locationDTO));
});

// Which categories should the choice screen show? (those with ≥1 active platter)
publicRouter.get("/categories", async (_req, res) => {
  const rows = await prisma.platter.groupBy({
    by: ["category"],
    where: { active: true },
    _count: true,
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.category] = r._count as unknown as number;
  const experiences = await prisma.experience.count({ where: { active: true } });
  res.json({
    home: counts.home ?? 0,
    events: counts.events ?? 0,
    seasonal: counts.seasonal ?? 0,
    experiences,
    // Tastings show as "coming soon" (not bookable) unless explicitly switched on.
    tastingsComingSoon: (await getSetting("tastingsComingSoon")) !== "off",
  });
});

// --- Availability (platters: per-day order count vs location capacity) ---
publicRouter.get("/availability", async (req, res) => {
  const parsed = availabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
  const { locationId, from, days } = parsed.data;
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location || !location.active) return res.status(404).json({ error: "Location not available" });

  const now = new Date();
  const fromDate = from ?? formatDate(now);
  const span = days ?? 21;
  const start = parseDate(fromDate);
  const end = new Date(start.getTime() + span * 86_400_000);

  const orders = await prisma.order.findMany({
    where: { locationId, status: { not: "cancelled" }, type: { in: ["platter", "gift"] }, collectionOrDeliveryDate: { gte: start, lt: end } },
    select: { collectionOrDeliveryDate: true },
  });
  const bookedByDate: Record<string, number> = {};
  for (const o of orders) {
    const key = formatDate(o.collectionOrDeliveryDate);
    bookedByDate[key] = (bookedByDate[key] ?? 0) + 1;
  }
  res.json({ locationId, capacity: location.weeklyCapacity, days: buildAvailability(fromDate, span, location.weeklyCapacity, bookedByDate, now) });
});

// --- Availability (experiences: Σ party size per (experience,location,date) vs session capacity) ---
publicRouter.get("/experiences/availability", async (req, res) => {
  const parsed = experienceAvailabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
  const { experienceId, locationId, from, days } = parsed.data;
  const experience = await prisma.experience.findUnique({ where: { id: experienceId } });
  if (!experience || !experience.active) return res.status(404).json({ error: "Experience not available" });

  const now = new Date();
  const fromDate = from ?? formatDate(now);
  const span = days ?? 21;
  const start = parseDate(fromDate);
  const end = new Date(start.getTime() + span * 86_400_000);

  const bookings = await prisma.order.findMany({
    where: { type: "experience", experienceId, locationId, status: { not: "cancelled" }, collectionOrDeliveryDate: { gte: start, lt: end } },
    select: { collectionOrDeliveryDate: true, headcount: true },
  });
  const guestsByDate: Record<string, number> = {};
  for (const b of bookings) {
    const key = formatDate(b.collectionOrDeliveryDate);
    guestsByDate[key] = (guestsByDate[key] ?? 0) + b.headcount;
  }
  res.json({ experienceId, locationId, capacity: experience.capacity, days: buildAvailability(fromDate, span, experience.capacity, guestsByDate, now) });
});

// --- Order lookup ---
publicRouter.get("/orders/:ref", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { ref: req.params.ref },
    include: { platter: true, experience: true, location: true, customer: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(orderDTO(order));
});

// --- Re-order ---
publicRouter.get("/reorder", async (req, res) => {
  const contact = String(req.query.contact ?? "").trim();
  if (!contact) return res.status(400).json({ error: "Enter your phone or email" });
  const order = await prisma.order.findFirst({
    where: { OR: [{ phone: contact }, { email: contact }], type: { in: ["platter", "gift"] }, platter: { active: true } },
    orderBy: { createdAt: "desc" },
    include: { platter: true, location: true },
  });
  if (!order) return res.status(404).json({ error: "We couldn't find a previous order for that" });
  // Return only the order *selection* to pre-fill the basket — never echo back the
  // contact details (name/phone/email), so a known email can't be used to harvest PII.
  res.json({
    platterId: order.platterId,
    platterName: order.platter?.name ?? null,
    headcount: order.headcount,
    locationId: order.locationId,
    locationName: order.location.name,
    notes: order.notes,
  });
});

// --- Create a platter order (collection) or gift (delivery) ---
publicRouter.post("/orders", async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid order", details: parsed.error.flatten() });
  const input = parsed.data;
  const now = new Date();

  if (Number.isNaN(parseDate(input.collectionOrDeliveryDate).getTime())) {
    return res.status(400).json({ error: "Invalid date" });
  }
  const platter = await prisma.platter.findUnique({ where: { id: input.platterId } });
  if (!platter || !platter.active) return res.status(404).json({ error: "Platter not available" });
  const location = await prisma.location.findUnique({ where: { id: input.locationId } });
  if (!location || !location.active) return res.status(404).json({ error: "Location not available" });
  if (input.headcount < platter.minHeadcount) {
    return res.status(400).json({ error: `Minimum headcount for ${platter.name} is ${platter.minHeadcount}` });
  }
  if (!meetsNotice(input.collectionOrDeliveryDate, now)) {
    return res.status(400).json({ error: "Orders need at least 48 hours notice" });
  }

  // referral validity (no self-referral)
  let referrerCode: string | null = null;
  if (input.referralCodeUsed) {
    const referrer = await prisma.customer.findUnique({ where: { referralCode: input.referralCodeUsed } });
    if (referrer && referrer.phone !== input.phone) referrerCode = input.referralCodeUsed;
  }

  const pricing = priceOrder(
    { pricePerHead: platter.pricePerHead ? Number(platter.pricePerHead) : null, fixedPrice: platter.fixedPrice ? Number(platter.fixedPrice) : null },
    input.headcount,
    referrerCode != null,
  );

  // First-order hook: free item for a customer's first catering order, if enabled.
  const priorOrders = await prisma.order.count({ where: { phone: input.phone, type: { in: ["platter", "gift"] } } });
  let freebie: string | null = null;
  if (priorOrders === 0 && (await getSetting("firstOrderHook")) === "on") {
    freebie = (await getSetting("firstOrderHookText")) || "FREE first-order treat";
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const booked = await tx.order.count({
        where: { locationId: input.locationId, collectionOrDeliveryDate: parseDate(input.collectionOrDeliveryDate), type: { in: ["platter", "gift"] }, status: { not: "cancelled" } },
      });
      if (!canBook(input.collectionOrDeliveryDate, location.weeklyCapacity, booked, now)) throw new CapacityError();

      const ref = await uniqueRef(tx);
      const customer = await tx.customer.upsert({
        where: { phone: input.phone },
        update: { name: input.customerName, email: input.email },
        create: { name: input.customerName, phone: input.phone, email: input.email, referralCode: randomReferralCode() },
      });

      const created = await tx.order.create({
        data: {
          ref,
          type: input.isGift ? "gift" : "platter",
          platterId: input.platterId,
          headcount: input.headcount,
          total: pricing.total,
          deposit: pricing.deposit,
          depositStatus: "pending",
          isGift: !!input.isGift,
          recipientName: input.isGift ? input.recipientName ?? null : null,
          deliveryAddress: input.isGift ? input.deliveryAddress ?? null : null,
          giftMessage: input.isGift ? input.giftMessage ?? null : null,
          collectionOrDeliveryDate: parseDate(input.collectionOrDeliveryDate),
          locationId: input.locationId,
          customerName: input.customerName,
          phone: input.phone,
          email: input.email,
          notes: input.notes ?? null,
          freebie,
          src: input.src ?? "direct",
          referralCodeUsed: referrerCode,
          customerId: customer.id,
        },
        include: { platter: true, location: true },
      });
      await tx.customer.update({ where: { id: customer.id }, data: { lastOrderId: created.id } });
      if (referrerCode) await tx.referral.create({ data: { code: referrerCode, orderId: created.id, discount: pricing.discount } });
      return created;
    });

    await captureDepositIntent(pricing.deposit, order.ref);
    await notifyOrderReceived(
      { name: order.customerName, phone: order.phone, email: order.email },
      { ref: order.ref, total: pricing.total, deposit: pricing.deposit, collectionDate: formatDate(order.collectionOrDeliveryDate), locationName: order.location.name },
    );
    res.status(201).json({ order: orderDTO(order), pricing, freebie });
  } catch (err) {
    if (err instanceof CapacityError) return res.status(409).json({ error: "That date is fully booked at this location" });
    console.error("[orders] create failed", err);
    res.status(500).json({ error: "Could not place order" });
  }
});

// --- Create an experience booking ---
publicRouter.post("/bookings", async (req, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid booking", details: parsed.error.flatten() });
  const input = parsed.data;
  const now = new Date();

  // Tastings aren't open for booking yet (admin toggle) — block at the API too.
  if ((await getSetting("tastingsComingSoon")) !== "off") {
    return res.status(403).json({ error: "Tastings aren't open for booking yet — coming soon!" });
  }

  if (Number.isNaN(parseDate(input.date).getTime())) return res.status(400).json({ error: "Invalid date" });
  const experience = await prisma.experience.findUnique({ where: { id: input.experienceId } });
  if (!experience || !experience.active) return res.status(404).json({ error: "Experience not available" });
  const location = await prisma.location.findUnique({ where: { id: input.locationId } });
  if (!location || !location.active) return res.status(404).json({ error: "Location not available" });
  if (!meetsNotice(input.date, now)) return res.status(400).json({ error: "Bookings need at least 48 hours notice" });

  const pricing = priceOrder({ pricePerHead: Number(experience.pricePerHead), fixedPrice: null }, input.partySize, false);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const agg = await tx.order.aggregate({
        where: { type: "experience", experienceId: input.experienceId, locationId: input.locationId, collectionOrDeliveryDate: parseDate(input.date), status: { not: "cancelled" } },
        _sum: { headcount: true },
      });
      const bookedGuests = agg._sum.headcount ?? 0;
      const avail = getDayAvailability(input.date, experience.capacity, bookedGuests, now);
      if (!avail.bookable || avail.remaining < input.partySize) throw new CapacityError();

      const ref = await uniqueRef(tx);
      const customer = await tx.customer.upsert({
        where: { phone: input.phone },
        update: { name: input.customerName, email: input.email },
        create: { name: input.customerName, phone: input.phone, email: input.email, referralCode: randomReferralCode() },
      });
      const created = await tx.order.create({
        data: {
          ref,
          type: "experience",
          experienceId: input.experienceId,
          headcount: input.partySize,
          total: pricing.total,
          deposit: pricing.deposit,
          depositStatus: "pending",
          collectionOrDeliveryDate: parseDate(input.date),
          locationId: input.locationId,
          customerName: input.customerName,
          phone: input.phone,
          email: input.email,
          notes: input.notes ?? null,
          src: input.src ?? "direct",
          customerId: customer.id,
        },
        include: { experience: true, location: true },
      });
      await tx.customer.update({ where: { id: customer.id }, data: { lastOrderId: created.id } });
      return created;
    });

    await captureDepositIntent(pricing.deposit, order.ref);
    await notifyOrderReceived(
      { name: order.customerName, phone: order.phone, email: order.email },
      { ref: order.ref, total: pricing.total, deposit: pricing.deposit, collectionDate: formatDate(order.collectionOrDeliveryDate), locationName: order.location.name },
    );
    res.status(201).json({ order: orderDTO(order), pricing });
  } catch (err) {
    if (err instanceof CapacityError) return res.status(409).json({ error: "That session is fully booked — try another date" });
    console.error("[bookings] create failed", err);
    res.status(500).json({ error: "Could not place booking" });
  }
});
