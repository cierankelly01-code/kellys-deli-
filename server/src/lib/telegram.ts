// A phone ping per paid order, like a Shopify "new order" notification: one Telegram
// message to the owner from a bot (docs/RUNBOOK.md has the setup). Off unless both
// TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set. Never throws: the order is already
// saved and paid when this runs, so a failed ping is logged and forgotten.
//
// It goes to the owner's own private chat, so it names the customer (owner's ask,
// 29 Oct 2026), but never their phone or email. Sent as plain text (no parse_mode), so
// nothing a customer types can turn into Telegram markup or links.

export interface OrderPing {
  kind: "board" | "bread" | "deli";
  ref: string;
  customerName: string;
  /** What was paid online just now. */
  paid: number;
  /** The order total, when more than was paid (a tasting's deposit). */
  total?: number;
  locationName: string;
  /** YYYY-MM-DD. */
  collectionDate: string;
  items: { name: string; qty: number }[];
}

// The headline is picked at random from a pool sized to the order (owner: "make it funny").
// Kept clean: it may be read out at the counter. Tiered on the order total.
export const HEADLINES = {
  /** Under £20. */
  small: [
    "🥖 Small but mighty! A cob has found a home.",
    "🧀 Ding! Someone's snack game just levelled up.",
    "🍞 Bread money is still money.",
    "🥪 A humble order, but a noble one.",
    "🥐 Every crumb counts. Ka-ching (quietly).",
    "🫙 One jar at a time, we take over the Midlands.",
    "🍪 Little order, big appetite.",
    "🧈 Small order, big potential. Butter them up.",
  ],
  /** £20 to £99.99. */
  medium: [
    "💷 KA-CHING! The cheese drawer approves.",
    "🥂 Another board leaves the nest.",
    "🔔 Order up! Fiona's going to want to see this.",
    "🫒 Olives are being counted as we speak.",
    "🧀 Brie-lliant news: a new order's in.",
    "🥓 Somebody's having a proper spread this weekend.",
    "🍇 Grapes on standby. This one's a goodun.",
    "🥖 Cheese, please! The till is singing.",
  ],
  /** £100 and up. */
  big: [
    "🚨 BIG ORDER ALERT 🚨 Clear the counter!",
    "🎉 Somebody's throwing a PARTY. Get the big boards out.",
    "💰 KA-CHING KA-CHING! Mark, put the kettle on.",
    "👑 Grazing table royalty has entered the chat.",
    "🏆 Order of the week contender, right here.",
    "🧀🧀🧀 Triple cheese alert. Fetch the big knife.",
    "📣 Hold the phone. That's a serious order.",
    "🥳 Someone's about to be the hero of their party.",
  ],
} as const;

export function headlineFor(amount: number, rand: () => number = Math.random): string {
  const pool = amount >= 100 ? HEADLINES.big : amount >= 20 ? HEADLINES.medium : HEADLINES.small;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

const MAX_ITEMS_SHOWN = 6;
const MAX_NAME = 60;

/** The customer's name on one short line: control characters and line breaks out. */
function oneLine(s: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = s.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > MAX_NAME ? `${clean.slice(0, MAX_NAME - 1)}…` : clean;
}

/** "2026-11-14" -> "Sat 14 Nov". Dates are stored as UTC midnight, so read them in UTC. */
function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

const money = (n: number) => `£${n.toFixed(2)}`;

/** `rand` picks the headline; tests pass a fixed one. */
export function orderPingText(p: OrderPing, rand: () => number = Math.random): string {
  const deposit = p.total !== undefined && p.total > p.paid;
  const amount = deposit ? `${money(p.paid)} deposit (${money(p.total!)} total)` : money(p.paid);
  const name = oneLine(p.customerName);
  const lines = [
    headlineFor(deposit ? p.total! : p.paid, rand),
    `${amount}${name ? ` — ${name}` : ""}`,
    `${p.ref} · ${p.locationName} · ${shortDate(p.collectionDate)}`,
  ];
  if (p.items.length) {
    const shown = p.items.slice(0, MAX_ITEMS_SHOWN).map((i) => `${i.qty}× ${i.name}`);
    const more = p.items.length - shown.length;
    lines.push(`${shown.join(", ")}${more > 0 ? ` + ${more} more` : ""}`);
  }
  return lines.join("\n");
}

/** Whether the ping is configured, read at call time so tests (and a redeploy) can change it. */
export const telegramEnabled = () => !!process.env.TELEGRAM_BOT_TOKEN?.trim() && !!process.env.TELEGRAM_CHAT_ID?.trim();

export async function pingPaidOrder(p: OrderPing, rand: () => number = Math.random): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: orderPingText(p, rand), disable_web_page_preview: true }),
      // The Stripe webhook waits on this; a slow Telegram must not hold it up for long.
      signal: AbortSignal.timeout(5000),
    });
    // The URL holds the bot token, so log the status and Telegram's reason, never the URL.
    if (!res.ok) console.error(`[notify:telegram] ${p.ref}: Telegram ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    console.error(`[notify:telegram] ${p.ref}: send failed: ${err instanceof Error ? err.name : "error"}`);
  }
}
