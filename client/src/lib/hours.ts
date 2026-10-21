// Opening hours (Site Settings → "openingHours", JSON of "9:00 - 17:00" | "Closed" per day)
// and the live "Open now, closes 17:00" line shown in the header, footer and homepage.
import type { OpeningHours } from "./api";

export const DAY_LABELS: Array<{ key: keyof OpeningHours; label: string; long: string }> = [
  { key: "mon", label: "Mon", long: "Monday" }, { key: "tue", label: "Tue", long: "Tuesday" },
  { key: "wed", label: "Wed", long: "Wednesday" }, { key: "thu", label: "Thu", long: "Thursday" },
  { key: "fri", label: "Fri", long: "Friday" }, { key: "sat", label: "Sat", long: "Saturday" },
  { key: "sun", label: "Sun", long: "Sunday" },
];

export function parseHours(raw: string | null | undefined): OpeningHours | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OpeningHours;
  } catch {
    return null;
  }
}

function toMinutes(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

function parseRange(str: string | undefined): [number, number] | null {
  if (!str || /closed/i.test(str)) return null;
  const [a, b] = str.split("-").map((s) => s.trim());
  const start = a ? toMinutes(a) : null;
  const end = b ? toMinutes(b) : null;
  return start != null && end != null ? [start, end] : null;
}

const fmt = (mins: number) => `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;

/** Today's index into DAY_LABELS (Monday = 0). */
export const todayIndex = (now = new Date()) => (now.getDay() + 6) % 7;

export function openStatus(hours: OpeningHours, now = new Date()): { open: boolean; text: string } {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dayIdx = todayIndex(now);
  const todayRange = parseRange(hours[DAY_LABELS[dayIdx].key]);
  if (todayRange && nowMin >= todayRange[0] && nowMin < todayRange[1]) {
    return { open: true, text: `Open now, closes ${fmt(todayRange[1])}` };
  }
  for (let i = 0; i <= 7; i++) {
    const idx = (dayIdx + i) % 7;
    const range = parseRange(hours[DAY_LABELS[idx].key]);
    if (!range) continue;
    if (i === 0 && nowMin < range[0]) return { open: false, text: `Closed, opens today ${fmt(range[0])}` };
    if (i > 0) return { open: false, text: `Closed, opens ${DAY_LABELS[idx].label} ${fmt(range[0])}` };
  }
  return { open: false, text: "Closed" };
}

export const SHOP_ADDRESS = "1 Slater Road, Bentley Heath, Solihull B93 8AQ";
export const SHOP_MAP_URL = "https://www.google.com/maps/search/?api=1&query=Kelly%27s+Deli+1+Slater+Road+Solihull+B93+8AQ";
export const SHOP_EMAIL = "hello@kellysdeli.co.uk";
