import { useEffect, useState } from "react";
import { api, type Platter, type BoardComponent, type BoardComponentCategory, type BoardSize } from "../lib/api";
import { gbp } from "../lib/format";

const CATEGORY_LABEL: Record<BoardComponentCategory, string> = {
  cheese: "Choose your cheeses",
  meat: "Add a meat (optional)",
  savoury: "Savoury extras",
  extra: "Always included",
};
const SIZE_ORDER: BoardSize[] = ["small", "medium", "large"];
const SIZE_LABEL: Record<BoardSize, string> = { small: "Small", medium: "Medium", large: "Large" };

export function BoardConfigurator({
  customPlatters,
  onAdd,
}: {
  customPlatters: Platter[];
  onAdd: (platterId: string, quantity: number, customItems: string[]) => void;
}) {
  const [components, setComponents] = useState<BoardComponent[] | null>(null);
  const [size, setSize] = useState<BoardSize>(
    customPlatters.find((p) => p.size === "medium")?.size ?? (customPlatters[0].size as BoardSize),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(1);

  useEffect(() => {
    api.boardComponents().then(setComponents).catch(() => setComponents([]));
  }, []);

  const platter = customPlatters.find((p) => p.size === size) ?? customPlatters[0];
  const grouped = new Map<BoardComponentCategory, BoardComponent[]>();
  for (const c of components ?? []) {
    const list = grouped.get(c.category) ?? [];
    list.push(c);
    grouped.set(c.category, list);
  }

  function toggle(label: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const hasCheese = [...selected].some((l) => grouped.get("cheese")?.some((c) => c.label === l));

  return (
    <div className="card configurator">
      <h3 className="configurator-h">Configure your own</h3>
      <p className="muted" style={{ marginTop: -4 }}>Pick your cheeses and extras — same board, made your way.</p>

      <div className="field">
        <label>Board size</label>
        <div className="seg wide">
          {SIZE_ORDER.filter((s) => customPlatters.some((p) => p.size === s)).map((s) => (
            <button key={s} className={size === s ? "active" : ""} onClick={() => setSize(s)}>{SIZE_LABEL[s]}</button>
          ))}
        </div>
      </div>

      {!components && <p className="muted center">Loading ingredients…</p>}

      {(["cheese", "meat", "savoury", "extra"] as BoardComponentCategory[]).map((cat) => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        return (
          <div className="field" key={cat}>
            <label>{CATEGORY_LABEL[cat]}</label>
            <div className="chip-select">
              {items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${selected.has(c.label) ? "selected" : ""}`}
                  onClick={() => toggle(c.label)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="stepper-input compact">
        <button className="round" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="fewer">−</button>
        <span className="qty-value">{qty}</span>
        <button className="round" onClick={() => setQty((q) => q + 1)} aria-label="more">＋</button>
      </div>
      <p className="center estimate">{gbp(platter.fixedPrice!)} each · estimated total <strong>{gbp(platter.fixedPrice! * qty)}</strong></p>
      {!hasCheese && <p className="center muted" style={{ fontSize: "0.85rem" }}>Pick at least one cheese to continue.</p>}

      <div className="nav-row" style={{ position: "static", background: "none" }}>
        <button
          className="btn"
          disabled={!hasCheese}
          onClick={() => onAdd(platter.id, qty, [...selected])}
        >
          Add to order
        </button>
      </div>
    </div>
  );
}
