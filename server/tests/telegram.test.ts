import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The owner's phone ping per paid order. fetch is faked throughout: no request leaves the
// machine. The wiring tests fake the database claim and the emails too, so they need no DB.
const updateMany = vi.fn(async () => ({ count: 1 }));
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    order: { updateMany: (...a: unknown[]) => updateMany(...(a as [])) },
    breadOrder: { updateMany: (...a: unknown[]) => updateMany(...(a as [])) },
    groceryOrder: { updateMany: (...a: unknown[]) => updateMany(...(a as [])) },
    setting: { findUnique: async () => null },
    breadShopSetting: { findUnique: async () => null },
    groceryShopSetting: { findUnique: async () => null },
  },
}));
vi.mock("../src/lib/notify", () => ({
  notifyOrderReceived: async () => {},
  notifyShopOfOrder: async () => {},
  notifyShopDepositPaid: async () => {},
  notifyBreadOrderReceived: async () => {},
  notifyShopOfBreadOrder: async () => {},
  notifyGroceryOrderReceived: async () => {},
  notifyShopOfGroceryOrder: async () => {},
}));

import { orderPingText, pingPaidOrder, telegramEnabled, headlineFor, HEADLINES, type OrderPing } from "../src/lib/telegram";
import { sendOrderEmails, type OrderForEmail } from "../src/lib/order-emails";
import { sendSimpleOrderEmails } from "../src/lib/simple-order-payments";

const ping: OrderPing = {
  kind: "board",
  ref: "KD-7Q2M4X",
  customerName: "Sarah Jones",
  paid: 85,
  total: 85,
  locationName: "Bentley Heath",
  collectionDate: "2026-11-14",
  items: [{ name: "Medium Platter", qty: 1 }, { name: "Napkins pack", qty: 2 }],
};

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }));
const sent = () => fetchMock.mock.calls.map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }));

beforeEach(() => {
  fetchMock.mockClear();
  updateMany.mockReset();
  updateMany.mockResolvedValue({ count: 1 });
  vi.stubGlobal("fetch", fetchMock);
  process.env.TELEGRAM_BOT_TOKEN = "123456:test-token";
  process.env.TELEGRAM_CHAT_ID = "987654321";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
});

const firstPick = () => 0;
const lastPick = () => 0.999999;

describe("telegram ping — message", () => {
  it("leads with a headline, then the money and name, the ref, shop and date, and the items", () => {
    expect(orderPingText(ping, firstPick)).toBe(
      "💷 KA-CHING! The cheese drawer approves.\n£85.00 — Sarah Jones\nKD-7Q2M4X · Bentley Heath · Sat 14 Nov\n1× Medium Platter, 2× Napkins pack",
    );
  });

  it("picks the headline from the pool for the order's size, at each boundary", () => {
    const headline = (paid: number, rand = firstPick) => headlineFor(paid, rand);
    expect(headline(19.99)).toBe(HEADLINES.small[0]);
    expect(headline(20)).toBe(HEADLINES.medium[0]);
    expect(headline(99.99)).toBe(HEADLINES.medium[0]);
    expect(headline(100)).toBe(HEADLINES.big[0]);
    expect(headline(0.3, lastPick)).toBe(HEADLINES.small[HEADLINES.small.length - 1]);
    expect(headline(500, lastPick)).toBe(HEADLINES.big[HEADLINES.big.length - 1]);
    expect(headline(500, () => 1)).toBe(HEADLINES.big[HEADLINES.big.length - 1]); // never off the end
  });

  it("tiers a deposit on the order total, and says only the deposit was paid", () => {
    const text = orderPingText({ ...ping, paid: 35.75, total: 143 }, firstPick).split("\n");
    expect(text[0]).toBe(HEADLINES.big[0]);
    expect(text[1]).toBe("£35.75 deposit (£143.00 total) — Sarah Jones");
  });

  it("keeps every headline short, on one line, and clean of markup", () => {
    for (const h of [...HEADLINES.small, ...HEADLINES.medium, ...HEADLINES.big]) {
      expect(h.length).toBeLessThanOrEqual(60);
      expect(h).not.toMatch(/[\n<>*_`[\]]/);
    }
    expect(new Set([...HEADLINES.small, ...HEADLINES.medium, ...HEADLINES.big]).size).toBe(24);
  });

  it("keeps a customer-typed name to one plain line, and copes with none", () => {
    const second = (name: string) => orderPingText({ ...ping, customerName: name }, firstPick).split("\n")[1];
    expect(second("Sarah\nKD-FAKE01 · Refund me\u0000 ")).toBe("£85.00 — Sarah KD-FAKE01 · Refund me");
    expect(second("x".repeat(200)).length).toBeLessThan(75);
    expect(second("   ")).toBe("£85.00");
  });

  it("keeps a long order to one short line of items", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ name: `Loaf ${i}`, qty: 1 }));
    expect(orderPingText({ ...ping, items }, firstPick).split("\n")[3]).toMatch(/1× Loaf 5 \+ 3 more$/);
  });
});

describe("telegram ping — sending", () => {
  it("posts the message to the configured chat with the Bot API", async () => {
    await pingPaidOrder(ping, firstPick);
    expect(sent()).toEqual([{ url: "https://api.telegram.org/bot123456:test-token/sendMessage", body: { chat_id: "987654321", text: orderPingText(ping, firstPick), disable_web_page_preview: true } }]);
  });

  it("is off, and sends nothing, unless both the token and the chat id are set", async () => {
    delete process.env.TELEGRAM_CHAT_ID;
    expect(telegramEnabled()).toBe(false);
    await pingPaidOrder(ping);
    process.env.TELEGRAM_CHAT_ID = "987654321";
    process.env.TELEGRAM_BOT_TOKEN = "  ";
    await pingPaidOrder(ping);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when Telegram is down or refuses, and never logs the token", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to parse URL from https://api.telegram.org/bot123456:test-token/sendMessage"));
    await expect(pingPaidOrder(ping)).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));
    await expect(pingPaidOrder(ping)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-token");
  });
});

const board = (): OrderForEmail => ({
  id: "o1",
  ref: "KD-7Q2M4X",
  customerName: "Dawn Fletcher",
  phone: "07700900123",
  email: "dawn@example.com",
  total: 85,
  deposit: 85,
  collectionOrDeliveryDate: new Date("2026-11-14T00:00:00Z"),
  location: { name: "Bentley Heath" },
  items: [{ quantity: 1, unitPrice: 82, platter: { name: "Medium Platter", imageUrl: null, serves: "6-8" } }],
  addOns: [{ name: "Napkins pack", quantity: 1, unitPrice: 3 }],
});

const loaf = (overrides: Record<string, unknown> = {}) => ({
  id: "b1",
  ref: "KDB-AAAAAA",
  customerName: "Dawn Fletcher",
  phone: "07700900123",
  email: "dawn@example.com",
  notes: null,
  status: "pending",
  locationId: "loc1",
  location: { name: "Bentley Heath" },
  collectionDate: new Date("2026-11-14T00:00:00Z"),
  items: [{ name: "Sourdough", quantity: 2, unitPrice: 4.5 }],
  createdAt: new Date(),
  ...overrides,
});

describe("telegram ping — wired into the paid confirmations", () => {
  beforeEach(() => { vi.spyOn(Math, "random").mockReturnValue(0); }); // first headline of each pool

  it("pings once when a board order is paid online: name yes, phone and email no, plain text", async () => {
    await sendOrderEmails(board(), { depositPaid: true });
    expect(sent()).toHaveLength(1);
    const text: string = sent()[0].body.text;
    expect(text).toBe(`${HEADLINES.medium[0]}\n£85.00 — Dawn Fletcher\nKD-7Q2M4X · Bentley Heath · Sat 14 Nov\n1× Medium Platter, 1× Napkins pack`);
    for (const secret of ["07700900123", "dawn@example.com"]) expect(text).not.toContain(secret);
    expect(sent()[0].body).not.toHaveProperty("parse_mode");
  });

  it("pings for a payment on a board order the shop already had, but not for a webhook retry", async () => {
    updateMany.mockResolvedValue({ count: 0 }); // confirmation already sent
    await sendOrderEmails(board(), { depositPaid: true });
    expect(sent()).toHaveLength(1);
    await sendOrderEmails(board(), { depositPaid: true, onlyIfFirst: true });
    expect(sent()).toHaveLength(1);
  });

  it("pings when Stripe retries a board payment we recorded but crashed before confirming", async () => {
    await sendOrderEmails(board(), { depositPaid: true, onlyIfFirst: true }); // claim succeeds
    expect(sent()).toHaveLength(1);
  });

  it("doesn't ping for an unpaid board order or a deposit the shop took by phone", async () => {
    await sendOrderEmails(board());
    await sendOrderEmails(board(), { depositPaid: true, depositPaidBy: "shop" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pings when a bread or deli order is paid, and not for one paid on collection", async () => {
    await sendSimpleOrderEmails("bread", loaf(), { paid: true });
    await sendSimpleOrderEmails("grocery", loaf({ ref: "KDS-BBBBBB" }), { paid: true });
    await sendSimpleOrderEmails("bread", loaf({ ref: "KDB-CCCCCC" }), { paid: false });
    expect(sent().map((s) => s.body.text)).toEqual([
      `${HEADLINES.small[0]}\n£9.00 — Dawn Fletcher\nKDB-AAAAAA · Bentley Heath · Sat 14 Nov\n2× Sourdough`,
      `${HEADLINES.small[0]}\n£9.00 — Dawn Fletcher\nKDS-BBBBBB · Bentley Heath · Sat 14 Nov\n2× Sourdough`,
    ]);
  });

  it("doesn't ping again when Stripe retries a bread payment that was already confirmed", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await sendSimpleOrderEmails("bread", loaf(), { paid: true, onlyIfFirst: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still sends the confirmation path through when Telegram fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(sendOrderEmails(board(), { depositPaid: true })).resolves.toBeUndefined();
    await expect(sendSimpleOrderEmails("bread", loaf(), { paid: true })).resolves.toBeUndefined();
  });
});
