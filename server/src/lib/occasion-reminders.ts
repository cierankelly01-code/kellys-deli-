import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "./env";
import { prisma } from "./prisma";

export const occasionReminderSchema = z.object({
  email: z.string().trim().email().max(200).or(z.literal("")).default(""),
  phone: z.string().trim().max(30).default(""),
  occasion: z.enum(["A birthday", "Mother's Day", "Father's Day", "Christmas", "An anniversary", "Something else"]),
  reminderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  daysBefore: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(14),
  emailConsent: z.boolean().default(false),
  smsConsent: z.boolean().default(false),
}).superRefine((d, ctx) => {
  if (!d.emailConsent && !d.smsConsent) ctx.addIssue({ code: "custom", message: "Choose at least one reminder channel." });
  if (d.emailConsent && !d.email) ctx.addIssue({ code: "custom", path: ["email"], message: "Enter your email for email reminders." });
  if (d.smsConsent && !/^\+[1-9]\d{7,14}$/.test(d.phone)) ctx.addIssue({ code: "custom", path: ["phone"], message: "Use an international phone number, for example +447700900123." });
  const date = new Date(`${d.reminderDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== d.reminderDate) ctx.addIssue({ code: "custom", path: ["reminderDate"], message: "Choose a valid date." });
});

export function reminderDueAt(date: string, daysBefore: number, now = new Date()) {
  const event = new Date(`${date}T12:00:00Z`);
  const due = new Date(event.getTime() - daysBefore * 86400000);
  if (!Number.isFinite(due.getTime()) || due <= now || event.getTime() > now.getTime() + 730 * 86400000) throw new Error("Choose an occasion far enough ahead for your reminder, within the next two years.");
  return due;
}

export function reminderChannels() {
  return {
    enabled: process.env.REMINDERS_ENABLED === "on",
    email: !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
    sms: !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_MESSAGING_SERVICE_SID,
  };
}

export function cancelToken(id: string) {
  return `${id}.${createHmac("sha256", env.jwtSecret).update(`reminder-cancel:${id}`).digest("base64url")}`;
}
export function verifyCancelToken(token: string): string | null {
  if (!/^[a-zA-Z0-9_-]{1,100}\.[a-zA-Z0-9_-]{43}$/.test(token)) return null;
  const id = token.split(".")[0];
  const a = Buffer.from(token), b = Buffer.from(cancelToken(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

/** Claim each channel once before contacting its provider. Uncertain attempts stay
 * 'sending' for staff review; they are never blindly retried (avoids duplicate SMS). */
export async function dispatchOccasionReminders() {
  const channels = reminderChannels();
  if (!channels.enabled) return;
  const setting = await prisma.setting.findUnique({ where: { key: "remindersEnabled" } });
  if (setting?.value !== "on") return;
  const now = new Date();
  const sendable = [
    ...(channels.email ? [{ emailConsent: true, emailStatus: "pending" }] : []),
    ...(channels.sms ? [{ smsConsent: true, smsStatus: "pending" }] : []),
  ];
  if (!sendable.length) return;
  const rows = await prisma.reminderSignup.findMany({ where: { cancelled: false, dueAt: { lte: now }, reminderDate: { gt: now }, OR: sendable }, take: 100, orderBy: { dueAt: "asc" } });
  for (const row of rows) {
    for (const channel of ["email", "sms"] as const) {
      if (!channels[channel] || !(channel === "email" ? row.emailConsent : row.smsConsent)) continue;
      const statusKey = channel === "email" ? "emailStatus" : "smsStatus";
      const claimed = await prisma.reminderSignup.updateMany({ where: { id: row.id, cancelled: false, [statusKey]: "pending" }, data: { [statusKey]: "sending" } });
      if (!claimed.count) continue;
      const unsubscribe = `${env.publicUrl}/api/occasion-reminders/cancel/${cancelToken(row.id)}`;
      const text = `Kelly's Deli: your ${row.occasion.toLowerCase()} is coming up on ${row.reminderDate!.toISOString().slice(0, 10)}. Plan something lovely: ${env.publicUrl}/platters\nCancel this reminder: ${unsubscribe}`;
      try {
        let response: Response;
        if (channel === "email") {
          response = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `occasion-${row.id}-email` }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [row.email], subject: "A little reminder from Kelly’s Deli", text }) });
        } else {
          const sid = process.env.TWILIO_ACCOUNT_SID!;
          response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ To: row.phone!, MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!, Body: text }) });
        }
        await prisma.reminderSignup.update({ where: { id: row.id }, data: { [statusKey]: response.ok ? "accepted" : "failed" } });
        if (!response.ok) console.error(`[reminders] ${channel} provider rejected request (${response.status}); see admin.`);
      } catch { console.error(`[reminders] ${channel} delivery uncertain; review provider before retrying.`); }
    }
  }
}

export function startReminderWorker() {
  if (!reminderChannels().enabled) return;
  let running = false;
  const tick = async () => { if (running) return; running = true; try { await dispatchOccasionReminders(); } catch { console.error("[reminders] worker failed; check database configuration"); } finally { running = false; } };
  void tick();
  setInterval(() => void tick(), 15 * 60 * 1000).unref();
}
