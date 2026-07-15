/* Conversion plugins — Kelly's Deli. Real data only: the deadline chip is
 * computed from the genuine 48-hour notice rule, and the stars widget renders
 * the shop's actual Google rating passed in from site settings. */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Earliest honest collection date under the 48-hour rule. */
function earliestCollection(): Date {
  return new Date(Date.now() + 48 * 60 * 60 * 1000);
}

/** "Order today, collect from Thursday 17 Jul" — honest urgency, no fake countdowns. */
export function DeadlineChip() {
  const d = earliestCollection();
  return (
    <p className="deadline-chip">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Order today, collect from {DAYS[d.getDay()]} {d.getDate()} {MONTHS[d.getMonth()]}
    </p>
  );
}

/** Reassurance chips for decision points — all three statements are policy. */
export function TrustChips() {
  const chips: Array<{ icon: JSX.Element; label: string }> = [
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M9 12.5l2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: "Only 25% today",
    },
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 12a8 8 0 1 0 3-6.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 5v4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      label: "Refundable to 48 hrs",
    },
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21c-5-3.4-8-6.6-8-10a8 8 0 0 1 16 0c0 3.4-3 6.6-8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      ),
      label: "Built fresh the day you collect",
    },
  ];
  return (
    <ul className="trust-chips" aria-label="Ordering reassurance">
      {chips.map((c) => (
        <li key={c.label}>{c.icon}{c.label}</li>
      ))}
    </ul>
  );
}

/** Aggregate Google rating — real settings data only, linked to the live Google listing. */
const GOOGLE_LISTING =
  "https://www.google.com/maps/search/?api=1&query=Kelly%27s%20Deli%2C%201%20Slater%20Road%2C%20Bentley%20Heath%2C%20Solihull%20B93%208AQ";

export function Stars({ rating, count }: { rating: string; count?: string | number | null }) {
  return (
    <a
      className="stars-widget"
      href={GOOGLE_LISTING}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Rated ${rating} out of 5 on Google${count ? ` from ${count} reviews` : ""} — read the reviews`}
    >
      <span className="stars" aria-hidden="true">★★★★★</span>
      <strong>{rating}</strong>
      {count ? <span className="muted">· {count} Google reviews</span> : null}
    </a>
  );
}
