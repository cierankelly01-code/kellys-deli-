// Order references and referral codes.
// Base32-ish alphabet without ambiguous chars (no 0/O/1/I).
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomChars(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Order reference, e.g. "KD-7F3K9Q". Collision-checked by the caller. */
export function genRef(): string {
  return `KD-${randomChars(6)}`;
}

/** A customer's shareable referral code, e.g. "KELLY-4QF9KP". */
export function randomReferralCode(): string {
  return `KELLY-${randomChars(6)}`;
}
