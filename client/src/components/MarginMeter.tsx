import { gbp } from "../lib/format";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Live "Profit £X / Y% margin" readout. Colour reflects health of the margin. */
export function MarginMeter({ price, cost, unit }: { price: number; cost: number; unit?: string }) {
  const profit = round2(price - cost);
  const pct = price > 0 ? Math.round((profit / price) * 100) : 0;
  const tone = profit < 0 ? "bad" : pct >= 50 ? "good" : pct >= 30 ? "ok" : "low";
  return (
    <div className={`margin-meter ${tone}`}>
      <span className="mm-profit">
        Profit {gbp(profit)}
        {unit ? <small> {unit}</small> : null}
      </span>
      <span className="mm-pct">{pct}% margin</span>
    </div>
  );
}
