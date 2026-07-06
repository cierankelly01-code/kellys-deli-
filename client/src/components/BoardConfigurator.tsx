import { useEffect, useMemo, useState } from "react";
import { api, type Platter, type BoardGroup, type BoardSize } from "../lib/api";
import { extrasForSelection } from "../lib/boardPricing";
import { gbp } from "../lib/format";

// All configurator behaviour (headings, selection limits, defaults, extra charges) is
// admin-managed via /api/board-config — nothing menu-related is hardcoded here.
const SIZE_ORDER: BoardSize[] = ["small", "medium", "large"];
const SIZE_LABEL: Record<BoardSize, string> = { small: "Small", medium: "Medium", large: "Large" };

export function BoardConfigurator({
  customPlatters,
  onAdd,
}: {
  customPlatters: Platter[];
  onAdd: (platterId: string, quantity: number, customItems: string[]) => void;
}) {
  const [groups, setGroups] = useState<BoardGroup[] | null>(null);
  const [size, setSize] = useState<BoardSize>(
    customPlatters.find((p) => p.size === "medium")?.size ?? (customPlatters[0].size as BoardSize),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [maxHint, setMaxHint] = useState<string | null>(null);

  const [qty, setQty] = useState(1);

  useEffect(() => {
    api.boardConfig().then((c) => setGroups(c.groups)).catch(() => setGroups([]));
  }, []);

  // Pre-select the deli's defaults. A single-pick group with no default falls back to
  // its first option, so crackers/jam always start with something included.
  useEffect(() => {
    if (!groups || groups.length === 0) return;
    setSelected((prev) => {
      if (prev.size > 0) return prev; // don't clobber choices already made
      const next = new Set<string>();
      for (const g of groups) {
        const defaults = g.options.filter((o) => o.isDefault);
        for (const o of defaults) next.add(o.label);
        if (defaults.length === 0 && g.maxSelections === 1 && g.options[0]) next.add(g.options[0].label);
      }
      return next;
    });
  }, [groups]);

  const platter = customPlatters.find((p) => p.size === size) ?? customPlatters[0];

  function toggle(group: BoardGroup, label: string) {
    setMaxHint(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
        return next;
      }
      const picked = group.options.filter((o) => next.has(o.label));
      if (group.maxSelections != null && picked.length >= group.maxSelections) {
        if (group.maxSelections === 1) {
          for (const o of picked) next.delete(o.label); // radio behaviour: swap
        } else {
          setMaxHint(`${group.heading}: max ${group.maxSelections}`);
          return prev;
        }
      }
      next.add(label);
      return next;
    });
  }

  const cheeseGroup = groups?.find((g) => g.key === "cheese");
  const hasCheese = !cheeseGroup || cheeseGroup.options.some((o) => selected.has(o.label));
  const extras = useMemo(() => (groups ? extrasForSelection(groups, selected) : 0), [groups, selected]);

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
      </div>
      {platter.serves && <p className="muted board-feature-serves">Serves {platter.serves}</p>}

      {!groups && <p className="muted center">Loading ingredients…</p>}

      {groups?.map((g) => {
        if (g.options.length === 0) return null;
        return (
          <div className="field" key={g.id}>
            <label>{g.heading}</label>
            <div className="chip-select">
              {g.options.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${selected.has(c.label) ? "selected" : ""}`}
                  onClick={() => toggle(g, c.label)}
                >
                  {c.label}
                  {c.price > 0 && <span className="chip-price">+{gbp(c.price)}</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {maxHint && <p className="muted" style={{ fontSize: "0.85rem" }}>{maxHint}</p>}
      {!hasCheese && <p className="muted" style={{ fontSize: "0.85rem" }}>Pick at least one cheese to continue.</p>}

      {extras > 0 && (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Extras +{gbp(extras)} per board
        </p>
      )}

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
          Add · {gbp((platter.fixedPrice! + extras) * qty)}
        </button>
      </div>
      <p className="buy-reassure">Just £25 today · balance on delivery · 48hrs notice</p>
    </div>
  );
}
