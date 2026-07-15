// Lightweight order cart persisted in localStorage so a half-finished order survives
// the customer closing the tab (abandoned-basket recovery), with a freshness window so
// a weeks-old cart doesn't reappear. Carries multiple boards + add-ons + a headcount
// through the flow (direct order or event planner). The server always reprices on submit.
import type { Occasion } from "./api";

export interface CartBoard {
  platterId: string;
  quantity: number;
}
export interface CartAddOn {
  addOnId: string;
  quantity: number;
}
export interface Cart {
  boards: CartBoard[];
  addOns: CartAddOn[];
  headcount: number;
  occasion?: Occasion;
  src?: string;
  // "event" (Plan My Event) suggests add-on quantities from headcount; "direct" from the
  // board's feeds midpoint. Purely a suggestion hint — nothing is auto-added.
  origin: "direct" | "event";
}

const KEY = "kd-cart";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // drop carts older than 14 days

interface StoredCart {
  savedAt: number;
  cart: Cart;
}

export const emptyCart = (origin: Cart["origin"] = "direct"): Cart => ({
  boards: [],
  addOns: [],
  headcount: 0,
  origin,
});

export function loadCart(): Cart | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCart> & Partial<Cart>;
    // Support both the new {savedAt, cart} envelope and any legacy bare-cart value.
    const stored: StoredCart | null =
      parsed && typeof parsed === "object" && "cart" in parsed && parsed.cart
        ? (parsed as StoredCart)
        : Array.isArray((parsed as Partial<Cart>).boards)
          ? { savedAt: Date.now(), cart: parsed as Cart }
          : null;
    if (!stored || !Array.isArray(stored.cart.boards)) return null;
    if (Date.now() - stored.savedAt > MAX_AGE_MS) {
      clearCart();
      return null;
    }
    const c = stored.cart;
    return {
      boards: c.boards,
      addOns: c.addOns ?? [],
      headcount: c.headcount ?? 0,
      occasion: c.occasion,
      src: c.src,
      origin: c.origin ?? "direct",
    };
  } catch {
    return null;
  }
}

export function saveCart(cart: Cart): void {
  try {
    const payload: StoredCart = { savedAt: Date.now(), cart };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage full / unavailable — the flow still works in-memory */
  }
}

export function clearCart(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Total number of boards in the cart. */
export const boardCount = (cart: Cart): number => cart.boards.reduce((n, b) => n + b.quantity, 0);

/** Merge one board into the saved cart (incrementing if already present) and persist. */
export function addBoard(platterId: string, origin: Cart["origin"] = "direct"): Cart {
  const cart = loadCart() ?? emptyCart(origin);
  const existing = cart.boards.find((b) => b.platterId === platterId);
  if (existing) existing.quantity += 1;
  else cart.boards.push({ platterId, quantity: 1 });
  saveCart(cart);
  return cart;
}
