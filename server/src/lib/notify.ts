// Notifications. Email sends for real via Resend when RESEND_API_KEY is set;
// otherwise payloads are logged so you can see exactly what would go out.
// SMS is still a logged stub — swap sendSms for Twilio when ready.

import { orderReceivedHtml, orderReceivedText, type OrderEmailLine } from "./emailTemplate";

export interface NotifyTarget {
  name: string;
  phone: string;
  email: string;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const SANDBOX_FROM = "Kelly's Deli <onboarding@resend.dev>";

/**
 * Whether real customer email can be delivered, for /api/health — so this is
 * checkable from outside without shell access to the host. Never exposes the key.
 *  "live"    — key + a verified from-address: customers get their emails.
 *  "sandbox" — key but no EMAIL_FROM: only ever reaches the Resend account owner.
 *  "off"     — no key: emails are logged and silently never sent.
 */
export const emailMode: "live" | "sandbox" | "off" =
  !RESEND_API_KEY ? "off" : EMAIL_FROM ? "live" : "sandbox";

// Fail loud (once, at boot) if production is missing real email config — otherwise
// order/review/referral emails silently never send and nobody notices.
if (process.env.NODE_ENV === "production") {
  if (!RESEND_API_KEY) console.error("[notify] RESEND_API_KEY is not set — customer emails will NOT be delivered in production.");
  else if (!EMAIL_FROM) console.error("[notify] EMAIL_FROM is not set — falling back to the Resend sandbox sender, which only delivers to the account owner. Set a verified EMAIL_FROM.");
}

// Redact a phone to its last 3 digits for logs (avoid dumping PII to stdout).
const redactPhone = (p: string) => { const d = p.replace(/\D/g, ""); return d.length < 4 ? "•••" : `•••••${d.slice(-3)}`; };

async function sendSms(to: string, _body: string): Promise<void> {
  console.log(`[notify:sms] -> ${redactPhone(to)} (message body omitted)`);
}

/**
 * Normalise a "Display Name <addr@host>" sender into RFC 5322 form by quoting the
 * display name. An unquoted name containing punctuation — an apostrophe in
 * "Kelly's Deli", a comma, a dot after an initial — is parsed loosely and arrives
 * mangled in some clients. Quoting is always valid, so we quote unconditionally.
 * A bare address, or a name already quoted, is passed through untouched.
 */
export function normaliseFrom(from: string): string {
  const m = from.trim().match(/^(.*?)\s*<([^>]+)>$/);
  if (!m) return from.trim(); // bare address — nothing to quote
  const [, rawName, addr] = m;
  const name = rawName.trim();
  if (!name) return addr.trim();
  if (/^".*"$/.test(name)) return `${name} <${addr.trim()}>`;
  return `"${name.replace(/[\\"]/g, "\\$&")}" <${addr.trim()}>`;
}

async function sendEmail(to: string, subject: string, body: string, html?: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(`[notify:email dry-run] -> ${to} | ${subject}\n  ${body}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      // The text part always goes alongside the HTML: it is the fallback for
      // plain-text clients, and HTML-only mail is markedly more likely to be
      // filtered as spam.
      body: JSON.stringify({
        from: normaliseFrom(EMAIL_FROM || SANDBOX_FROM),
        to: [to],
        subject,
        text: body,
        ...(html ? { html } : {}),
      }),
    });
    if (!res.ok) console.error(`[notify:email] Resend ${res.status}: ${await res.text()}`);
  } catch (e) {
    // Never let a failed notification break order placement.
    console.error("[notify:email] send failed:", e);
  }
}

/** Sent when an order request is placed. */
export async function notifyOrderReceived(
  t: NotifyTarget,
  o: {
    ref: string; total: number; deposit: number; collectionDate: string; locationName: string;
    boards?: OrderEmailLine[]; addOns?: OrderEmailLine[];
  },
): Promise<void> {
  const balance = Math.max(0, Math.round((o.total - o.deposit) * 100) / 100);
  // SMS stays a single line — it is charged per segment and read at a glance.
  const sms =
    `Thanks ${t.name} — your Kelly's Deli order request ${o.ref} is in. ` +
    `Collection ${o.collectionDate} at ${o.locationName}. Total £${o.total.toFixed(2)}. ` +
    `We'll contact you shortly with a secure payment link for a 25% deposit (£${o.deposit.toFixed(2)}) to confirm your order. ` +
    `The balance (£${balance.toFixed(2)}) is payable on collection.`;

  const data = {
    customerName: t.name,
    ref: o.ref,
    collectionDate: o.collectionDate,
    locationName: o.locationName,
    boards: o.boards ?? [],
    addOns: o.addOns ?? [],
    total: o.total,
    deposit: o.deposit,
    balance,
  };
  await Promise.all([
    sendSms(t.phone, sms),
    sendEmail(t.email, `Order ${o.ref} confirmed — Kelly's Deli`, orderReceivedText(data), orderReceivedHtml(data)),
  ]);
}

/** Sent when an order is marked Completed — the review engine. */
export async function notifyReviewRequest(t: NotifyTarget, reviewLink: string): Promise<void> {
  const msg = `Thanks ${t.name}! Hope the food went down well. Leave a 30-second Google review: ${reviewLink}`;
  await Promise.all([sendSms(t.phone, msg), sendEmail(t.email, "How did we do?", msg)]);
}

/** SMS marketing blast (stub) — logs the recipient count target, not the PII payload. */
export async function notifyBlast(phone: string, _message: string): Promise<void> {
  console.log(`[notify:sms-blast] -> ${redactPhone(phone)} (message body omitted)`);
}

/** Sent when an order is marked Completed — the referral engine. */
export async function notifyReferralOffer(t: NotifyTarget, referralCode: string, shareLink: string): Promise<void> {
  const msg =
    `Know an office that needs lunch? Share your code ${referralCode} (${shareLink}) — ` +
    `you both get £15 off your next order.`;
  await Promise.all([sendSms(t.phone, msg), sendEmail(t.email, "Get £15 off — refer a friend", msg)]);
}
