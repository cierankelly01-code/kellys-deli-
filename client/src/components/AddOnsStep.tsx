import type { AddOn } from "../lib/api";
import type { CartAddOn } from "../lib/cart";
import { suggestAddOnQty } from "../lib/addOnPricing";
import { gbp } from "../lib/format";

interface Props {
  addOns: AddOn[];
  headcount: number; // drives suggested quantities
  value: CartAddOn[];
  onChange: (next: CartAddOn[]) => void;
}

/**
 * Shared "add the extras" upsell step (build spec §3). Suggested quantities are pre-computed
 * from the headcount but NOTHING is added until the customer taps — suggestions only.
 */
export function AddOnsStep({ addOns, headcount, value, onChange }: Props) {
  const qtyOf = (id: string) => value.find((a) => a.addOnId === id)?.quantity ?? 0;

  const setQty = (id: string, qty: number) => {
    const clamped = Math.max(0, Math.min(qty, 999));
    const rest = value.filter((a) => a.addOnId !== id);
    onChange(clamped > 0 ? [...rest, { addOnId: id, quantity: clamped }] : rest);
  };

  const runningTotal = value.reduce((sum, sel) => {
    const a = addOns.find((x) => x.id === sel.addOnId);
    return sum + (a ? a.price * sel.quantity : 0);
  }, 0);

  if (addOns.length === 0) return null;

  return (
    <section className="addons-step">
      <h2 className="step-h">Make it effortless — add the extras</h2>
      <p className="muted addons-sub">Tap to add. Suggested amounts are worked out from your numbers — adjust anything.</p>

      <ul className="addon-list">
        {addOns.map((a) => {
          const qty = qtyOf(a.id);
          const suggested = suggestAddOnQty(a, headcount);
          const active = qty > 0;
          return (
            <li key={a.id} className={`addon-card${active ? " is-added" : ""}`}>
              {a.imageUrl && <div className="addon-thumb" style={{ backgroundImage: `url(${a.imageUrl})` }} aria-hidden="true" />}
              <div className="addon-body">
                <div className="addon-head">
                  <span className="addon-name">{a.name}</span>
                  <span className="addon-price">{gbp(a.price)}{a.unitLabel ? ` · ${a.unitLabel}` : ""}</span>
                </div>
                {suggested > 0 && !active && (
                  <button type="button" className="btn-ghost addon-suggest" onClick={() => setQty(a.id, suggested)}>
                    Add ×{suggested} (suggested)
                  </button>
                )}
                {active ? (
                  <div className="stepper addon-stepper" role="group" aria-label={`${a.name} quantity`}>
                    <button type="button" onClick={() => setQty(a.id, qty - 1)} aria-label="Decrease">−</button>
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => setQty(a.id, parseInt(e.target.value || "0", 10))}
                      aria-label={`${a.name} quantity`}
                    />
                    <button type="button" onClick={() => setQty(a.id, qty + 1)} aria-label="Increase">+</button>
                  </div>
                ) : (
                  suggested === 0 && (
                    <button type="button" className="btn-ghost addon-add" onClick={() => setQty(a.id, 1)}>
                      Add
                    </button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="addons-running">
        <span>Extras</span>
        <strong>{gbp(runningTotal)}</strong>
      </div>
    </section>
  );
}
