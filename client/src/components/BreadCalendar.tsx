import { useMemo } from "react";
import type { BreadDayAvailability } from "../lib/api";
import { monthStart, shiftMonth, daysInMonth } from "./CapacityCalendar";

interface Props {
  days: BreadDayAvailability[];
  selected: string | null;
  onSelect: (date: string) => void;
  /** First day of the month on show, as YYYY-MM-01. */
  month: string;
  onMonthChange: (month: string) => void;
  /** How many months ahead orders are taken. */
  monthsAhead?: number;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Monday-first column index (0-6) of the 1st of the month. */
function leadingBlanks(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
}

/** Bread's reasons (closed/too_soon/full) collapse to the same three visual buckets the
 * platter calendar already uses — "closed" and "too_soon" both render as unavailable/grey,
 * but keep distinct wording so the customer knows *why*. */
function visualStatus(d: BreadDayAvailability): "open" | "limited" | "full" | "closed" {
  if (!d.bookable) return d.reason === "full" ? "full" : "closed";
  if (d.remaining !== null && d.remaining <= 2) return "limited";
  return "open";
}

function reasonText(d: BreadDayAvailability): string {
  if (d.reason === "closed") return "we're closed that day";
  if (d.reason === "too_soon") return "too soon to order";
  if (d.reason === "full") return "fully booked";
  if (d.remaining !== null) return `${d.remaining} left today`;
  return "available";
}

function shortTag(d: BreadDayAvailability): string {
  if (d.reason === "closed") return "Closed";
  if (d.reason === "too_soon") return "—";
  if (d.reason === "full") return "Full";
  if (d.remaining !== null && d.remaining <= 2) return `${d.remaining} left`;
  return "";
}

/**
 * Bread order date picker — same look as CapacityCalendar (shared cal-* CSS), but keyed to
 * bread's reason-based availability so "we're closed" and "too soon" read differently even
 * though both grey the day out.
 */
export function BreadCalendar({ days, selected, onSelect, month, onMonthChange, monthsAhead = 6 }: Props) {
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
        <button type="button" className="cal-nav" onClick={() => onMonthChange(shiftMonth(month, -1))} disabled={!canGoBack} aria-label="Previous month">‹</button>
        <strong className="cal-month" aria-live="polite">{monthLabel(month)}</strong>
        <button type="button" className="cal-nav" onClick={() => onMonthChange(shiftMonth(month, 1))} disabled={!canGoForward} aria-label="Next month">›</button>
      </div>

      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((w) => <span key={w} className="cal-wd" aria-hidden="true">{w}</span>)}
        {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} className="cal-blank" />)}
        {Array.from({ length: total }, (_, i) => {
          const dom = i + 1;
          const date = `${month.slice(0, 7)}-${String(dom).padStart(2, "0")}`;
          const d = byDate.get(date);
          const status = d ? visualStatus(d) : "closed";
          const disabled = !d?.bookable;
          return (
            <button
              key={date}
              type="button"
              className={`cal-day ${status}${selected === date ? " selected" : ""}`}
              disabled={disabled}
              onClick={() => onSelect(date)}
              aria-label={`${dom} ${monthLabel(month)} — ${d ? reasonText(d) : "not available"}`}
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
        <span><i className="dot full" /> Fully booked</span>
        <span>— Closed / too soon to order</span>
      </div>
    </div>
  );
}

/** Human message for the selected date, when it turns out not to be bookable. */
export function unavailableReason(d: BreadDayAvailability | undefined): string | null {
  if (!d || d.bookable) return null;
  if (d.reason === "closed") return "We're closed that day — please choose another date.";
  if (d.reason === "too_soon") return "That date doesn't give us enough notice — please choose a later date.";
  if (d.reason === "full") return "Fully booked that day — please choose another date.";
  return "That date isn't available.";
}
