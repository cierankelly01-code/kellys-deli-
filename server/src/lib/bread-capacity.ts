// Bread pre-order availability rules. Pure functions (no DB), mirroring the style of
// capacity.ts. Bread has its own rules (closed days, two lead-time modes, per-shop item
// capacity) so it gets its own module rather than overloading the platter one.

import { parseDate, formatDate, meetsLeadTime } from "./capacity";

export type BreadDayReason = "closed" | "too_soon" | "full" | null;

export interface BreadDayAvailability {
  date: string; // YYYY-MM-DD
  bookable: boolean;
  reason: BreadDayReason; // null when bookable
  remaining: number | null; // null = unlimited capacity at this shop
}

export interface BreadOrderingSettings {
  leadTimeHours: number; // used when cutoffMode = "rolling", or as a fallback
  cutoffMode: "rolling" | "cutoff";
  cutoffDaysBefore: number | null;
  cutoffTime: string | null; // "HH:MM", Europe/London local time
}

/** Subtract `n` days from a UTC-midnight Date. */
function subtractDays(d: Date, n: number): Date {
  return new Date(d.getTime() - n * 86_400_000);
}

/**
 * The Europe/London UTC offset (in minutes) in effect at noon UTC on `dateStr`. Noon is a
 * safe reference instant — the BST/GMT transition always happens around 1am, never near
 * midday — so this can't straddle the transition on the date it's checking.
 */
function londonOffsetMinutes(dateStr: string): number {
  const refUtc = new Date(`${dateStr}T12:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(refUtc);
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  return hour * 60 + minute - 12 * 60; // 0 = GMT, 60 = BST
}

/**
 * Convert a Europe/London wall-clock date + "HH:MM" into the UTC instant it represents,
 * correctly across the BST/GMT boundary — using only Node's built-in Intl (no tz library).
 */
export function londonWallTimeToUtc(dateStr: string, hhmm: string): Date {
  const offsetMin = londonOffsetMinutes(dateStr);
  const [h, m] = hhmm.split(":").map(Number);
  const naiveUtc = parseDate(dateStr).getTime() + (h * 60 + m) * 60_000;
  return new Date(naiveUtc - offsetMin * 60_000);
}

/** True if `dateStr`'s day-of-week (0=Sun..6=Sat, UTC) is in the shop's recurring closures. */
export function isClosedWeekday(dateStr: string, closedWeekdays: number[]): boolean {
  return closedWeekdays.includes(parseDate(dateStr).getUTCDay());
}

/** True if `dateStr` is a one-off closure for the shop (bank holiday, etc.). */
export function isOneOffClosure(dateStr: string, closureDates: Iterable<string>): boolean {
  for (const d of closureDates) if (d === dateStr) return true;
  return false;
}

/**
 * Does `dateStr` meet the configured lead time / cutoff for placing an order right now?
 *  - "rolling": at least `leadTimeHours` from now (same shape as the platter flow).
 *  - "cutoff": orders close at `cutoffTime` (Europe/London), `cutoffDaysBefore` days before
 *    the collection date. Falls back to rolling if cutoff fields aren't fully configured.
 */
export function meetsBreadLeadTime(dateStr: string, now: Date, settings: BreadOrderingSettings): boolean {
  if (settings.cutoffMode === "cutoff" && settings.cutoffDaysBefore != null && settings.cutoffTime) {
    const cutoffDate = formatDate(subtractDays(parseDate(dateStr), settings.cutoffDaysBefore));
    const cutoffInstant = londonWallTimeToUtc(cutoffDate, settings.cutoffTime);
    return now.getTime() <= cutoffInstant.getTime();
  }
  return meetsLeadTime(dateStr, now, settings.leadTimeHours);
}

/** Full availability for one (shop, date), given that day's booked item quantity. */
export function getBreadDayAvailability(
  dateStr: string,
  now: Date,
  settings: BreadOrderingSettings,
  closedWeekdays: number[],
  closureDates: Iterable<string>,
  dailyCapacity: number | null,
  bookedQty: number,
): BreadDayAvailability {
  const remaining = dailyCapacity == null ? null : Math.max(0, dailyCapacity - bookedQty);
  if (isClosedWeekday(dateStr, closedWeekdays) || isOneOffClosure(dateStr, closureDates)) {
    return { date: dateStr, bookable: false, reason: "closed", remaining };
  }
  if (!meetsBreadLeadTime(dateStr, now, settings)) {
    return { date: dateStr, bookable: false, reason: "too_soon", remaining };
  }
  if (remaining !== null && remaining <= 0) {
    return { date: dateStr, bookable: false, reason: "full", remaining: 0 };
  }
  return { date: dateStr, bookable: true, reason: null, remaining };
}

/** Availability for a run of `days` consecutive dates starting at `fromDateStr`. */
export function buildBreadAvailability(
  fromDateStr: string,
  days: number,
  now: Date,
  settings: BreadOrderingSettings,
  closedWeekdays: number[],
  closureDates: Iterable<string>,
  dailyCapacity: number | null,
  bookedByDate: Record<string, number>,
): BreadDayAvailability[] {
  const closures = closureDates instanceof Set ? closureDates : new Set(closureDates);
  const start = parseDate(fromDateStr);
  const out: BreadDayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const dateStr = formatDate(new Date(start.getTime() + i * 86_400_000));
    out.push(
      getBreadDayAvailability(dateStr, now, settings, closedWeekdays, closures, dailyCapacity, bookedByDate[dateStr] ?? 0),
    );
  }
  return out;
}

/** Server-side gate at submit time — never trust the client's calendar state. */
export function canBookBread(
  dateStr: string,
  now: Date,
  settings: BreadOrderingSettings,
  closedWeekdays: number[],
  closureDates: Iterable<string>,
  dailyCapacity: number | null,
  bookedQty: number,
): boolean {
  return getBreadDayAvailability(dateStr, now, settings, closedWeekdays, closureDates, dailyCapacity, bookedQty).bookable;
}
