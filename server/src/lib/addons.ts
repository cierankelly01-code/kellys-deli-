// Add-on helpers. Pure functions (no DB) so they're easy to test and shared by the
// order route + mirrored client-side for live display.

export type AddOnUnitType = "per_person" | "per_order" | "serves";

export interface SuggestableAddOn {
  unitType: AddOnUnitType;
  suggestFromHeadcount: boolean;
  servesPerUnit?: number | null; // for unitType "serves", e.g. napkins pack serves 10
}

/**
 * Suggested (NOT auto-added) quantity for an add-on given a headcount.
 * The order flows pre-fill the stepper with this number but nothing is added until
 * the customer taps — see build spec §3.2 ("suggestions only").
 *
 *  - per_person + suggest → one per head
 *  - serves      + suggest → ceil(headcount / servesPerUnit)
 *  - anything else (or suggest off) → 0
 */
export function suggestAddOnQty(addOn: SuggestableAddOn, headcount: number): number {
  if (!addOn.suggestFromHeadcount || headcount <= 0) return 0;
  if (addOn.unitType === "per_person") return headcount;
  if (addOn.unitType === "serves") {
    const per = addOn.servesPerUnit && addOn.servesPerUnit > 0 ? addOn.servesPerUnit : 1;
    return Math.ceil(headcount / per);
  }
  return 0;
}
