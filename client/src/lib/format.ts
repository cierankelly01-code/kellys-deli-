/** £8.50, £175 (drops .00 on whole pounds). */
export function gbp(n: number): string {
  return `£${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

/** "Fri 14 Jun" from a 'YYYY-MM-DD' string or a full ISO timestamp
 * (treated as a calendar date, no TZ shift). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "Friday 14 June 2026" — longer form for the confirmation screen. */
export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Admin labels for a bread or deli counter order's payment. */
export const PAYMENT_LABEL: Record<string, string> = {
  none: "Pay on collection",
  pending: "Awaiting payment",
  paid: "Paid online",
  refunded: "Refunded",
};
