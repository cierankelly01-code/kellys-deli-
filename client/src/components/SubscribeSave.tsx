import { SUBSCRIPTION_FREQUENCIES, FREQUENCY_LABELS, type SubscriptionFrequency } from "../lib/api";

/**
 * Subscribe & Save picker. Payment-READY, not payment-live: opting in flags a recurring
 * intent and applies the discount, charges only the first board at checkout — the copy says exactly that. Used on
 * the board page and in checkout; the choice is carried through the cart.
 */
export function SubscribeSave({
  value,
  onChange,
  discountPct = 10,
  invoiced = false,
}: {
  value: SubscriptionFrequency | null;
  onChange: (f: SubscriptionFrequency | null) => void;
  discountPct?: number;
  invoiced?: boolean;
}) {
  const on = value != null;
  return (
    <div className={`subscribe-save${on ? " is-on" : ""}`}>
      <label className="ss-head">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked ? value ?? "weekly" : null)}
        />
        <span className="ss-title">Subscribe &amp; save {discountPct}%</span>
        <span className="ss-badge" aria-hidden="true">−{discountPct}%</span>
      </label>
      {on && (
        <div className="ss-body">
          <p className="ss-freq-label">How often would you like it?</p>
          <div className="ss-freqs" role="group" aria-label="Delivery frequency">
            {SUBSCRIPTION_FREQUENCIES.map((f) => (
              <button
                key={f}
                type="button"
                className={`ss-freq${value === f ? " active" : ""}`}
                aria-pressed={value === f}
                onClick={() => onChange(f)}
              >
                {FREQUENCY_LABELS[f]}
              </button>
            ))}
          </div>
          <p className="ss-honest">
            {invoiced
              ? "You pay for your first board when you order. We'll set the rest of your schedule up with you, and you confirm every delivery before it's made."
              : "You pay for your first board when you order. Nothing else bills automatically: we'll set your schedule up with you and confirm each board before we make it. Pause, skip or cancel any time."}
          </p>
        </div>
      )}
    </div>
  );
}
