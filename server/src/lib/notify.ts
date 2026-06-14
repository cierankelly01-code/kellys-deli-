// Notification stub. SMS/email are not sent in v1 — payloads are logged so you can
// see exactly what would go out. Swap sendSms/sendEmail bodies for Twilio/Resend later.

export interface NotifyTarget {
  name: string;
  phone: string;
  email: string;
}

async function sendSms(to: string, body: string): Promise<void> {
  console.log(`[notify:sms] -> ${to}\n  ${body}`);
}

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  console.log(`[notify:email] -> ${to} | ${subject}\n  ${body}`);
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

/** SMS marketing blast (stub) — logs the payload per recipient. */
export async function notifyBlast(phone: string, message: string): Promise<void> {
  console.log(`[notify:sms-blast] -> ${phone}\n  ${message}`);
}

/** Sent when an order is marked Completed — the referral engine. */
export async function notifyReferralOffer(t: NotifyTarget, referralCode: string, shareLink: string): Promise<void> {
  const msg =
    `Know an office that needs lunch? Share your code ${referralCode} (${shareLink}) — ` +
    `you both get £15 off your next order.`;
  await Promise.all([sendSms(t.phone, msg), sendEmail(t.email, "Get £15 off — refer a friend", msg)]);
}
