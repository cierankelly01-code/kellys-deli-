import { useEffect, useState } from "react";
import { adminApi } from "../../lib/admin";
import { type BoardComponent, type BoardComponentCategory } from "../../lib/api";

const CATEGORIES: BoardComponentCategory[] = ["cheese", "meat", "savoury", "cracker", "jam"];
const CATEGORY_LABEL: Record<BoardComponentCategory, string> = {
  cheese: "Cheeses", meat: "Meats", savoury: "Standard extras (pre-picked, swappable)",
  cracker: "Crackers (customer picks one — first is the default)",
  jam: "Chutney / jam (customer picks one — first is the default)",
};

export default function BoardComponents() {
  const [items, setItems] = useState<BoardComponent[]>([]);
  const [drafts, setDrafts] = useState<Record<BoardComponentCategory, string>>({ cheese: "", meat: "", savoury: "", cracker: "", jam: "" });
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    adminApi.boardComponents().then(setItems).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function addItem(category: BoardComponentCategory) {
    const label = drafts[category].trim();
    if (!label) return;
    setError(null);
    try {
      await adminApi.createBoardComponent({ category, label });
      setDrafts((d) => ({ ...d, [category]: "" }));
      refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggleActive(item: BoardComponent) {
    setBusyId(item.id);
    setError(null);
    try {
      await adminApi.updateBoardComponent(item.id, { category: item.category, label: item.label, imageUrl: item.imageUrl, active: !item.active, sortOrder: item.sortOrder });
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>Build Your Own — Ingredients</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        These are the picks customers see on the charcuterie board configurator. Turn one off to hide it without deleting it.
      </p>
      {error && <div className="notice danger">{error}</div>}

      {CATEGORIES.map((cat) => (
        <div key={cat} style={{ marginTop: 18 }}>
          <h2>{CATEGORY_LABEL[cat]}</h2>
          <div className="menu-chips">
            {items.filter((i) => i.category === cat).map((i) => (
              <button
                key={i.id}
                className={`chip ${!i.active ? "inactive" : ""}`}
                disabled={busyId === i.id}
                onClick={() => toggleActive(i)}
                title={i.active ? "Click to hide" : "Click to show"}
              >
                {i.label}{!i.active && <small> (hidden)</small>}
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              className="input"
              placeholder={`Add a ${cat}…`}
              value={drafts[cat]}
              onChange={(e) => setDrafts((d) => ({ ...d, [cat]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(cat); }}
            />
            <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => addItem(cat)}>+ Add</button>
          </div>
        </div>
      ))}
    </div>
  );
}
