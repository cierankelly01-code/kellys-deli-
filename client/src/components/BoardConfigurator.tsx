import { useEffect, useState } from "react";
import { api, type Platter, type BoardComponent, type BoardComponentCategory, type BoardSize } from "../lib/api";
import { gbp } from "../lib/format";

const CATEGORY_LABEL: Record<BoardComponentCategory, string> = {
  cheese: "Choose your cheeses",
  meat: "Add a meat (optional)",
  savoury: "Included as standard — swap anything you don't want",
  cracker: "Your crackers",
  jam: "Your chutney or jam",
};
// Multi-select categories: pick any number. Single-select: exactly one, always included.
const SINGLE_SELECT: BoardComponentCategory[] = ["cracker", "jam"];
const SIZE_ORDER: BoardSize[] = ["small", "medium", "large"];
const SIZE_LABEL: Record<BoardSize, string> = { small: "Small", medium: "Medium", large: "Large" };

function groupByCategory(components: BoardComponent[]): Map<BoardComponentCategory, BoardComponent[]> {
  const grouped = new Map<BoardComponentCategory, BoardComponent[]>();
  for (const c of [...components].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = grouped.get(c.category) ?? [];
    list.push(c);
    grouped.set(c.category, list);
  }
  return grouped;
}

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

  // Standard board extras come pre-picked (customer can still deselect to swap them out).
  // Single-select categories (crackers, jam) default to whichever the deli lists first.
  useEffect(() => {
    if (!components || components.length === 0) return;
    setSelected((prev) => {
      if (prev.size > 0) return prev; // don't clobber choices already made
      const grouped = groupByCategory(components);
      const next = new Set<string>();
      const standard = ["Salami", "Stuffed Peppers", "Mixed Olives"];
      for (const label of standard) {
        if (grouped.get("savoury")?.some((c) => c.label === label)) next.add(label);
      }
      for (const cat of SINGLE_SELECT) {
        const first = grouped.get(cat)?.[0];
        if (first) next.add(first.label);
      }
      return next;
    });
  }, [components]);

  const platter = customPlatters.find((p) => p.size === size) ?? customPlatters[0];
  const grouped = groupByCategory(components ?? []);

  function toggle(category: BoardComponentCategory, label: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (SINGLE_SELECT.includes(category)) {
        for (const item of grouped.get(category) ?? []) next.delete(item.label);
        next.add(label);
      } else if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  const hasCheese = [...selected].some((l) => grouped.get("cheese")?.some((c) => c.label === l));

  return (
    <div className="card configurator">
      <h3 className="configurator-h">Configure your own</h3>
      <p className="muted" style={{ marginTop: -4 }}>Pick your cheeses and extras — same board, made your way.</p>

      <div className="field">
        <label>How many people?</label>
        <div className="size-select">
          {SIZE_ORDER.filter((s) => customPlatters.some((p) => p.size === s)).map((s) => {
            const p = customPlatters.find((x) => x.size === s)!;
            return (
              <button key={s} className={`chip ${size === s ? "selected" : ""}`} onClick={() => setSize(s)}>
                {SIZE_LABEL[s]} <span className="chip-price">{gbp(p.fixedPrice!)}</span>
              </button>
            );
          })}
        </div>
        {platter.serves && <p className="muted board-feature-serves">Serves {platter.serves}</p>}
      </div>

      {!components && <p className="muted center">Loading ingredients…</p>}

      {(["cheese", "meat", "savoury", "cracker", "jam"] as BoardComponentCategory[]).map((cat) => {
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
                  onClick={() => toggle(cat, c.label)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {!hasCheese && <p className="muted" style={{ fontSize: "0.85rem" }}>Pick at least one cheese to continue.</p>}

      <div className="buy-bar">
        <div className="buy-bar-qty">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="fewer">−</button>
          <span>{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} aria-label="more">＋</button>
        </div>
        <button
          className="btn buy-bar-add"
          disabled={!hasCheese}
          onClick={() => onAdd(platter.id, qty, [...selected])}
        >
          Add · {gbp(platter.fixedPrice! * qty)}
        </button>
      </div>
      <p className="buy-reassure">Just £25 today · balance on delivery · 48hrs notice</p>
    </div>
  );
}
