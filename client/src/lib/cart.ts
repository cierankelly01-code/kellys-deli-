// Lightweight order cart persisted in sessionStorage. Replaces the old single-platter
// URL-param contract so an order can carry multiple boards + add-ons + a headcount
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

export const emptyCart = (origin: Cart["origin"] = "direct"): Cart => ({
  boards: [],
  addOns: [],
  headcount: 0,
  origin,
});

export function loadCart(): Cart | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<Cart>;
    if (!Array.isArray(c.boards)) return null;
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
    sessionStorage.setItem(KEY, JSON.stringify(cart));
  } catch {
    /* storage full / unavailable — the flow still works in-memory */
  }
}

export function clearCart(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Total number of boards in the cart. */
export const boardCount = (cart: Cart): number => cart.boards.reduce((n, b) => n + b.quantity, 0);
