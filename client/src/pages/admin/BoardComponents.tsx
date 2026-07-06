import { useEffect, useState } from "react";
import { adminApi, type AdminBoardGroup } from "../../lib/admin";
import { type BoardComponent, type BoardComponentCategory } from "../../lib/api";

// Everything here is admin-managed: group rules (heading, selection limit, free allowance)
// drive the customer configurator directly — no configurator behaviour is hardcoded anymore.

function parsePrice(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function GroupRules({ group, onSaved, onError }: { group: AdminBoardGroup; onSaved: () => void; onError: (m: string) => void }) {
  const [heading, setHeading] = useState(group.heading);
  const [maxSel, setMaxSel] = useState(group.maxSelections == null ? "" : String(group.maxSelections));
  const [freeN, setFreeN] = useState(String(group.includedFree));
  const [busy, setBusy] = useState(false);

  const dirty =
    heading !== group.heading ||
    maxSel !== (group.maxSelections == null ? "" : String(group.maxSelections)) ||
    freeN !== String(group.includedFree);

  async function save() {
    setBusy(true);
    try {
      await adminApi.updateBoardGroup(group.id, {
        heading: heading.trim() || group.heading,
        maxSelections: maxSel.trim() === "" ? null : Math.max(1, parseInt(maxSel, 10) || 1),
        includedFree: Math.max(0, parseInt(freeN, 10) || 0),
      });
      onSaved();
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card bc-rules">
      <div className="field">
        <label>Section heading (what customers see)</label>
        <input className="input" value={heading} onChange={(e) => setHeading(e.target.value)} />
      </div>
      <div className="bc-rules-nums">
        <div className="field">
          <label>Max picks</label>
          <input
            className="input" inputMode="numeric" placeholder="No limit"
            value={maxSel} onChange={(e) => setMaxSel(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="field">
          <label>Included free</label>
          <input
            className="input" inputMode="numeric"
            value={freeN} onChange={(e) => setFreeN(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {dirty && (
          <button className="btn" style={{ width: "auto" }} disabled={busy} onClick={save}>
            Save rules
          </button>
        )}
      </div>
      <p className="muted bc-hint">
        The customer's cheapest picks are included free up to "Included free"; anything they add beyond that
        is charged at the item's price. Leave "Max picks" blank for no limit.
      </p>
    </div>
  );
}

function OptionRow({
  item, first, last, onSwap, onChanged, onError,
}: {
  item: BoardComponent; first: boolean; last: boolean;
  onSwap: (item: BoardComponent, dir: -1 | 1) => Promise<void>;
  onChanged: () => void; onError: (m: string) => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [price, setPrice] = useState(item.price > 0 ? String(item.price) : "");
  const [busy, setBusy] = useState(false);

  const dirty = label.trim() !== item.label || parsePrice(price) !== item.price;

  const payload = (over: Partial<Parameters<typeof adminApi.updateBoardComponent>[1]> = {}) => ({
    category: item.category,
    label: label.trim() || item.label,
    imageUrl: item.imageUrl,
    price: parsePrice(price),
    isDefault: item.isDefault,
    active: item.active,
    sortOrder: item.sortOrder,
    ...over,
  });

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`bc-row ${!item.active ? "bc-row-hidden" : ""}`}>
      <input className="input bc-row-label" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="bc-row-price">
        <span className="muted">+£</span>
        <input
          className="input" inputMode="decimal" placeholder="0"
          value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </div>
      <label className="bc-row-default" title="Pre-selected when the customer opens the configurator">
        <input
          type="checkbox" checked={item.isDefault} disabled={busy}
          onChange={() => run(() => adminApi.updateBoardComponent(item.id, payload({ isDefault: !item.isDefault })))}
        />
        <span>Pre-picked</span>
      </label>
      <div className="bc-row-actions">
        {dirty && (
          <button className="btn bc-save" disabled={busy} onClick={() => run(() => adminApi.updateBoardComponent(item.id, payload()))}>
            Save
          </button>
        )}
        <button
          className="icon-btn" disabled={busy} title={item.active ? "Hide from customers" : "Show to customers"}
          onClick={() => run(() => adminApi.updateBoardComponent(item.id, payload({ active: !item.active })))}
        >
          {item.active ? "👁" : "🚫"}
        </button>
        <button className="icon-btn" disabled={busy || first} title="Move up" onClick={() => run(() => onSwap(item, -1))}>↑</button>
        <button className="icon-btn" disabled={busy || last} title="Move down" onClick={() => run(() => onSwap(item, +1))}>↓</button>
        <button
          className="icon-btn danger" disabled={busy} title="Delete"
          onClick={() => {
            if (window.confirm(`Delete "${item.label}"? Customers will no longer see it.`)) {
              run(() => adminApi.deleteBoardComponent(item.id));
            }
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function BoardComponents() {
  const [groups, setGroups] = useState<AdminBoardGroup[]>([]);
  const [items, setItems] = useState<BoardComponent[]>([]);
  const [drafts, setDrafts] = useState<Record<BoardComponentCategory, string>>({ cheese: "", meat: "", savoury: "", cracker: "", jam: "" });
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setError(null);
    Promise.all([adminApi.boardGroups(), adminApi.boardComponents()])
      .then(([gs, is]) => {
        setGroups(gs);
        setItems(is);
      })
      .catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  // Swap sortOrder with the neighbour in the same category (two PATCHes; the API takes full payloads).
  async function swapOrder(item: BoardComponent, dir: -1 | 1) {
    const inCat = items.filter((i) => i.category === item.category);
    const idx = inCat.findIndex((i) => i.id === item.id);
    const other = inCat[idx + dir];
    if (!other) return;
    const base = (i: BoardComponent, sortOrder: number) => ({
      category: i.category, label: i.label, imageUrl: i.imageUrl, price: i.price, isDefault: i.isDefault, active: i.active, sortOrder,
    });
    await adminApi.updateBoardComponent(item.id, base(item, other.sortOrder));
    await adminApi.updateBoardComponent(other.id, base(other, item.sortOrder));
  }

  async function addItem(category: BoardComponentCategory) {
    const label = drafts[category].trim();
    if (!label) return;
    setError(null);
    try {
      const maxSort = Math.max(0, ...items.filter((i) => i.category === category).map((i) => i.sortOrder));
      await adminApi.createBoardComponent({ category, label, sortOrder: maxSort + 1 });
      setDrafts((d) => ({ ...d, [category]: "" }));
      refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h1>Build Your Own — Ingredients</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        Everything customers see on the board configurator. Set a price to charge for an item beyond the
        section's free allowance; tick "Pre-picked" for items that start selected. 👁 hides without deleting.
      </p>
      {error && <div className="notice danger">{error}</div>}

      {groups.map((g) => {
        const inGroup = items.filter((i) => i.category === g.key);
        return (
          <div key={g.id} style={{ marginTop: 22 }}>
            <h2>{g.key.charAt(0).toUpperCase() + g.key.slice(1)}</h2>
            <GroupRules group={g} onSaved={refresh} onError={setError} />
            <div className="bc-rows">
              {inGroup.map((i, idx) => (
                <OptionRow
                  key={`${i.id}-${i.label}-${i.price}-${i.sortOrder}`}
                  item={i} first={idx === 0} last={idx === inGroup.length - 1}
                  onSwap={swapOrder} onChanged={refresh} onError={setError}
                />
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <input
                className="input"
                placeholder={`Add a ${g.key}…`}
                value={drafts[g.key]}
                onChange={(e) => setDrafts((d) => ({ ...d, [g.key]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") addItem(g.key); }}
              />
              <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => addItem(g.key)}>+ Add</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
