// A phone ping per paid order, like a Shopify "new order" notification: one Telegram
// message to the owner from a bot (docs/RUNBOOK.md has the setup). Off unless both
// TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set. Never throws: the order is already
// saved and paid when this runs, so a failed ping is logged and forgotten.
//
// Telegram is a third party, so the message carries no customer details (name, phone,
// email): only the ref, what was ordered, the money, the shop and the date.

export interface OrderPing {
  kind: "board" | "bread" | "deli";
  ref: string;
  /** What was paid online just now. */
  paid: number;
  /** The order total, when more than was paid (a tasting's deposit). */
  total?: number;
  locationName: string;
  /** YYYY-MM-DD. */
  collectionDate: string;
  items: { name: string; qty: number }[];
}

const KIND_LABEL: Record<OrderPing["kind"], string> = { board: "order", bread: "bread order", deli: "deli order" };
const MAX_ITEMS_SHOWN = 6;

/** "2026-11-14" -> "Sat 14 Nov". Dates are stored as UTC midnight, so read them in UTC. */
function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

const money = (n: number) => `£${n.toFixed(2)}`;

export function orderPingText(p: OrderPing): string {
  const amount = p.total !== undefined && p.total > p.paid ? `${money(p.paid)} deposit (${money(p.total)} total)` : money(p.paid);
  const head = `New ${KIND_LABEL[p.kind]} ${p.ref} — ${amount} — ${p.locationName}, ${shortDate(p.collectionDate)}`;
  if (!p.items.length) return head;
  const shown = p.items.slice(0, MAX_ITEMS_SHOWN).map((i) => `${i.qty}× ${i.name}`);
  const more = p.items.length - shown.length;
  return `${head}\n${shown.join(", ")}${more > 0 ? ` + ${more} more` : ""}`;
}

/** Whether the ping is configured, read at call time so tests (and a redeploy) can change it. */
export const telegramEnabled = () => !!process.env.TELEGRAM_BOT_TOKEN?.trim() && !!process.env.TELEGRAM_CHAT_ID?.trim();

export async function pingPaidOrder(p: OrderPing): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: orderPingText(p), disable_web_page_preview: true }),
      // The Stripe webhook waits on this; a slow Telegram must not hold it up for long.
      signal: AbortSignal.timeout(5000),
    });
    // The URL holds the bot token, so log the status and Telegram's reason, never the URL.
    if (!res.ok) console.error(`[notify:telegram] ${p.ref}: Telegram ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    console.error(`[notify:telegram] ${p.ref}: send failed: ${err instanceof Error ? err.name : "error"}`);
  }
}
