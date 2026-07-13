// Capacity + 48h-notice rules. Pure functions (no DB) so they're easy to test.
// Capacity is PER DAY per location (SPEC decision #2): a date is full when that
// day's non-cancelled order count reaches the location's weeklyCapacity value.

export const MIN_NOTICE_HOURS = 48;
export const LIMITED_THRESHOLD = 2; // show urgency when remaining <= this

export type DayStatus = "open" | "limited" | "full" | "closed";

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  capacity: number;
  booked: number;
  remaining: number;
  status: DayStatus; // closed = inside the 48h notice window
  bookable: boolean; // true only if it meets notice AND has room
}

/** Parse a 'YYYY-MM-DD' string as UTC midnight. */
export function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Format a Date as 'YYYY-MM-DD' (UTC). */
export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Hours from `now` until UTC-midnight of the given collection date. */
export function hoursUntilDate(dateStr: string, now: Date): number {
  return (parseDate(dateStr).getTime() - now.getTime()) / 3_600_000;
}

/**
 * A collection date meets the lead time if its start is at least `leadHours` from now.
 * The lead time is admin-configurable (Setting "orderLeadTimeHours"); defaults to 48h.
 */
export function meetsLeadTime(dateStr: string, now: Date, leadHours: number = MIN_NOTICE_HOURS): boolean {
  return hoursUntilDate(dateStr, now) >= leadHours;
}

/** Back-compat alias for the fixed 48h notice check. Prefer meetsLeadTime. */
export function meetsNotice(dateStr: string, now: Date): boolean {
  return meetsLeadTime(dateStr, now, MIN_NOTICE_HOURS);
}

/** Availability for a single (location-)date given that day's booked count. */
export function getDayAvailability(
  dateStr: string,
  capacity: number,
  booked: number,
  now: Date,
  leadHours: number = MIN_NOTICE_HOURS,
): DayAvailability {
  const remaining = Math.max(0, capacity - booked);
  const notice = meetsLeadTime(dateStr, now, leadHours);
  let status: DayStatus;
  if (!notice) status = "closed";
  else if (remaining <= 0) status = "full";
  else if (remaining <= LIMITED_THRESHOLD) status = "limited";
  else status = "open";
  return {
    date: dateStr,
    capacity,
    booked,
    remaining,
    status,
    bookable: notice && remaining > 0,
  };
}

/**
 * Availability for a run of `days` consecutive dates starting at `fromDateStr`.
 * `bookedByDate` maps 'YYYY-MM-DD' -> non-cancelled order count for the location.
 */
export function buildAvailability(
  fromDateStr: string,
  days: number,
  capacity: number,
  bookedByDate: Record<string, number>,
  now: Date,
  leadHours: number = MIN_NOTICE_HOURS,
): DayAvailability[] {
  const start = parseDate(fromDateStr);
  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const dateStr = formatDate(d);
    out.push(getDayAvailability(dateStr, capacity, bookedByDate[dateStr] ?? 0, now, leadHours));
  }
  return out;
}

/** Can an order be placed for this date? (server-side gate). */
export function canBook(
  dateStr: string,
  capacity: number,
  booked: number,
  now: Date,
  leadHours: number = MIN_NOTICE_HOURS,
): boolean {
  return getDayAvailability(dateStr, capacity, booked, now, leadHours).bookable;
}
