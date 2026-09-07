import rateLimit from "express-rate-limit";
import express from "express";
import { createHash } from "node:crypto";
import { asyncRouter } from "../lib/async-router";
import { prisma } from "../lib/prisma";
import { occasionReminderSchema, reminderDueAt, reminderChannels, cancelToken, verifyCancelToken } from "../lib/occasion-reminders";

export const occasionReminderRouter = asyncRouter();
occasionReminderRouter.get("/status", async (_req, res) => {
  const channels = reminderChannels();
  const setting = await prisma.setting.findUnique({ where: { key: "remindersEnabled" } });
  res.json({ email: channels.enabled && channels.email && setting?.value === "on", sms: channels.enabled && channels.sms && setting?.value === "on" });
});
occasionReminderRouter.post("/", rateLimit({ windowMs: 3600000, limit: 5, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
  const parsed = occasionReminderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  const channels = reminderChannels();
  const setting = await prisma.setting.findUnique({ where: { key: "remindersEnabled" } });
  if (!channels.enabled || setting?.value !== "on" || (d.emailConsent && !channels.email) || (d.smsConsent && !channels.sms)) return res.status(503).json({ error: "Reminders are not available yet. Please try again later." });
  let dueAt: Date;
  try { dueAt = reminderDueAt(d.reminderDate, d.daysBefore); } catch (e) { return res.status(400).json({ error: (e as Error).message }); }
  const email = d.email.toLowerCase();
  const fingerprint = createHash("sha256").update(JSON.stringify([email, d.phone, d.occasion, d.reminderDate])).digest("hex");
  const row = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${fingerprint}))`;
    const existing = await tx.reminderSignup.findFirst({ where: { email, phone: d.phone || null, occasion: d.occasion, reminderDate: new Date(`${d.reminderDate}T12:00:00Z`), cancelled: false } });
    if (existing) return { conflict: existing.dueAt?.getTime() !== dueAt.getTime() || existing.emailConsent !== d.emailConsent || existing.smsConsent !== d.smsConsent, created: null };
    return { conflict: false, created: await tx.reminderSignup.create({ data: { email, phone: d.phone || null, occasion: d.occasion, reminderDate: new Date(`${d.reminderDate}T12:00:00Z`), dueAt, emailConsent: d.emailConsent, smsConsent: d.smsConsent, consentAt: new Date() } }) };
  });
  // Do not expose cancellation credentials for another person's existing signup.
  if (row.conflict) return res.status(409).json({ error: "A reminder already exists with different preferences. Cancel it using your original confirmation link before signing up again, or contact the deli for help." });
  if (!row.created) return res.status(200).json({ ok: true });
  res.status(201).json({ ok: true, cancelPath: `/api/occasion-reminders/cancel/${cancelToken(row.created.id)}` });
});

occasionReminderRouter.get("/cancel/:token", (req, res) => {
  if (!verifyCancelToken(req.params.token)) return res.status(400).send("This reminder link is invalid.");
  res.set("Cache-Control", "no-store").set("Referrer-Policy", "no-referrer").type("html").send(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Cancel your reminder — Kelly’s Deli</title><body><main><h1>Cancel your Kelly’s Deli reminder</h1><p>This stops both email and text reminders for this occasion.</p><form method="post"><button type="submit">Cancel this reminder</button></form></main></body></html>`);
});
occasionReminderRouter.post("/cancel/:token", express.urlencoded({ extended: false }), async (req, res) => {
  const id = verifyCancelToken(req.params.token);
  if (!id) return res.status(400).send("This reminder link is invalid.");
  await prisma.reminderSignup.updateMany({ where: { id }, data: { cancelled: true, emailConsent: false, smsConsent: false } });
  res.set("Cache-Control", "no-store").send("Your reminder is cancelled. You will not receive further reminders for this occasion.");
});
