import { useMemo } from "react";
import type { DayAvailability } from "../lib/api";

interface Props {
  days: DayAvailability[];
  selected: string | null;
  onSelect: (date: string) => void;
  /** First day of the month on show, as YYYY-MM-01. */
  month: string;
  onMonthChange: (month: string) => void;
  /** How many months ahead bookings are taken. */
  monthsAhead?: number;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** YYYY-MM-01 for the month containing `iso`. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Monday-first column index (0-6) of the 1st of the month. */
function leadingBlanks(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
}

/**
 * Capacity-aware date picker. Pages a month at a time so a birthday or Christmas
 * order can be booked months ahead — the old flat strip only ever showed the next
 * three weeks, which quietly made advance booking impossible.
 * Full / too-soon dates are disabled; low stock shows the remaining slots.
 */
export function CapacityCalendar({
  days, selected, onSelect, month, onMonthChange, monthsAhead = 12,
}: Props) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const thisMonth = monthStart(new Date().toISOString().slice(0, 10));
  const lastMonth = shiftMonth(thisMonth, monthsAhead);
  const canGoBack = month > thisMonth;
  const canGoForward = month < lastMonth;

  const total = daysInMonth(month);
  const blanks = leadingBlanks(month);

  return (
    <div className="cal">
      <div className="cal-head">
        <button
          type="button"
          className="cal-nav"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          ‹
        </button>
        <strong className="cal-month" aria-live="polite">{monthLabel(month)}</strong>
        <button
          type="button"
          className="cal-nav"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          disabled={!canGoForward}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-wd" aria-hidden="true">{w}</span>
        ))}
        {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} className="cal-blank" />)}
        {Array.from({ length: total }, (_, i) => {
          const dom = i + 1;
          const date = `${month.slice(0, 7)}-${String(dom).padStart(2, "0")}`;
          const d = byDate.get(date);
          // Dates outside the fetched window render as unavailable rather than
          // vanishing, so the month grid never has holes in it.
          const status = d?.status ?? "closed";
          const disabled = !d?.bookable;
          return (
            <button
              key={date}
              type="button"
              className={`cal-day ${status}${selected === date ? " selected" : ""}`}
              disabled={disabled}
              onClick={() => onSelect(date)}
              aria-label={`${dom} ${monthLabel(month)} — ${d ? labelFor(d) : "not available"}`}
              aria-pressed={selected === date}
            >
              <span className="cal-dom">{dom}</span>
              <span className="cal-tag">{d ? shortTag(d) : "—"}</span>
            </button>
          );
        })}
      </div>

      <div className="cal-legend muted">
        <span><i className="dot open" /> Available</span>
        <span><i className="dot limited" /> Filling up</span>
        <span><i className="dot full" /> Full</span>
        <span>— Too soon (48hrs&apos; notice)</span>
      </div>
    </div>
  );
}

function shortTag(d: DayAvailability): string {
  if (d.status === "closed") return "—";
  if (d.status === "full") return "Full";
  if (d.status === "limited") return `${d.remaining} left`;
  return "";
}

function labelFor(d: DayAvailability): string {
  if (d.status === "closed") return "too soon (48h notice)";
  if (d.status === "full") return "fully booked";
  if (d.status === "limited") return `only ${d.remaining} slots left`;
  return "available";
}
