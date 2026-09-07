// Order references and referral codes.
// Base32-ish alphabet without ambiguous chars (no 0/O/1/I).
import { randomInt } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

// Cryptographically secure: an order ref is the ONLY gate on the unauthenticated
// order lookup (GET /orders/:ref), so it must not be predictable. Math.random()
// (V8 xorshift128+) is state-recoverable from a few outputs — never use it here.
function randomChars(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/** Order reference, e.g. "KD-7F3K9Q". Collision-checked by the caller. */
export function genRef(): string {
  return `KD-${randomChars(6)}`;
}

/**
 * Bread pre-order reference, e.g. "KDB-7F3K9Q". Distinct prefix from genRef() so a bread
 * order ref is never confusable with a platter order ref when staff search by ref.
 * Collision-checked by the caller (against BreadOrder.ref, a separate table).
 */
export function genBreadRef(): string {
  return `KDB-${randomChars(6)}`;
}

/** A customer's shareable referral code, e.g. "KELLY-4QF9KP". */
export function randomReferralCode(): string {
  return `KELLY-${randomChars(6)}`;
}
