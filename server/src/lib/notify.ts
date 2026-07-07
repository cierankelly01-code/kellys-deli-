// Notifications. Email sends for real via Resend when RESEND_API_KEY is set;
// otherwise payloads are logged so you can see exactly what would go out.
// SMS is still a logged stub — swap sendSms for Twilio when ready.

export interface NotifyTarget {
  name: string;
  phone: string;
  email: string;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const SANDBOX_FROM = "Kelly's Deli <onboarding@resend.dev>";

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

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(`[notify:email dry-run] -> ${to} | ${subject}\n  ${body}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM || SANDBOX_FROM, to: [to], subject, text: body }),
    });
    if (!res.ok) console.error(`[notify:email] Resend ${res.status}: ${await res.text()}`);
  } catch (e) {
    // Never let a failed notification break order placement.
    console.error("[notify:email] send failed:", e);
  }
}

/** Sent when an order is placed. */
export async function notifyOrderReceived(
  t: NotifyTarget,
  o: { ref: string; total: number; deposit: number; collectionDate: string; locationName: string },
): Promise<void> {
  const msg =
    `Hi ${t.name}, thanks for your Kelly's Deli catering order ${o.ref}! ` +
    `Collection ${o.collectionDate} at ${o.locationName}. Total £${o.total.toFixed(2)}, ` +
    `deposit £${o.deposit.toFixed(2)} (pending). We'll confirm shortly.`;
  await Promise.all([sendSms(t.phone, msg), sendEmail(t.email, `Order ${o.ref} received`, msg)]);
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
