import type { DayAvailability } from "../lib/api";

interface Props {
  days: DayAvailability[];
  selected: string | null;
  onSelect: (date: string) => void;
}

function dayParts(iso: string): { dow: string; dom: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    dow: dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
    dom: String(d),
  };
}

/** Capacity-aware date picker. Full/too-soon dates are disabled; low stock shows urgency. */
export function CapacityCalendar({ days, selected, onSelect }: Props) {
  return (
    <div>
      <div className="cal-grid">
        {days.map((d) => {
          const { dow, dom } = dayParts(d.date);
          const disabled = !d.bookable;
          const cls = `cal-day ${d.status}${selected === d.date ? " selected" : ""}`;
          return (
            <button
              key={d.date}
              type="button"
              className={cls}
              disabled={disabled}
              onClick={() => onSelect(d.date)}
              aria-label={`${dow} ${dom} — ${labelFor(d)}`}
            >
              <span className="cal-dow">{dow}</span>
              <span className="cal-dom">{dom}</span>
              <span className="cal-tag">{shortTag(d)}</span>
            </button>
          );
        })}
      </div>
      <div className="cal-legend muted">
        <span><i className="dot open" /> Available</span>
        <span><i className="dot limited" /> Filling up</span>
        <span><i className="dot full" /> Full</span>
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
