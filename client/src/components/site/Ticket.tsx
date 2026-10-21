/**
 * The counter ticket: the little white price card pushed into the ham on the counter.
 * A 4px red stripe on top, the price in large condensed figures, the unit underneath
 * ("Half ham, approx 2.5kg"). It sits over the bottom-left corner of product photos and
 * carries the price on the product page. Styles: .ticket in styles/site.css.
 */
export function Ticket({
  price,
  from = false,
  unit,
  note,
  large = false,
  className = "",
}: {
  price: string; // already formatted, e.g. "£45"
  from?: boolean; // "From £45" when a product comes in more than one size
  unit?: string | null; // "Half ham, approx 2.5kg"
  note?: string | null; // a quieter second line, e.g. "Serves 8-10"
  large?: boolean;
  className?: string;
}) {
  return (
    <span className={`ticket${large ? " is-large" : ""}${className ? ` ${className}` : ""}`}>
      <span className="ticket-price">
        {from && <><span className="ticket-from">From</span>{" "}</>}
        {price}
      </span>
      {unit && <span className="ticket-unit">{unit}</span>}
      {note && <span className="ticket-note">{note}</span>}
    </span>
  );
}

/** Sentence case for owner-typed unit labels ("approx 1kg" → "Approx 1kg"). */
export function sentence(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
