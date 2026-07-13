import { useEffect, useState } from "react";
import { adminApi, type AdminPlatter, type PlatterUpsertInput } from "../../lib/admin";

// Build a full platter payload from an AdminPlatter (the API takes the whole object on PATCH).
function toInput(p: AdminPlatter): PlatterUpsertInput {
  return {
    category: p.category,
    name: p.name,
    description: p.description,
    pricePerHead: p.pricePerHead,
    fixedPrice: p.fixedPrice,
    cost: p.cost,
    serves: p.serves,
    minHeadcount: p.minHeadcount,
    items: p.items,
    imageUrl: p.imageUrl,
    active: p.active,
    sortOrder: p.sortOrder,
    tier: p.tier,
    feedsMin: p.feedsMin,
    feedsMax: p.feedsMax,
    recommendEligible: p.recommendEligible,
    recommendPriority: p.recommendPriority,
  };
}

export default function Recommender() {
  const [boards, setBoards] = useState<AdminPlatter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function refresh() {
    adminApi
      .platters()
      .then((all) => setBoards(all.filter((p) => p.category === "board")))
      .catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  function patch(id: string, patch: Partial<AdminPlatter>) {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  async function save(board: AdminPlatter) {
    setSavingId(board.id); setError(null); setMsg(null);
    try {
      await adminApi.updatePlatter(board.id, toInput(board));
      setMsg(`Saved — recommendations update immediately.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <h1>Event Recommender</h1>
      <p className="muted">
        Controls the &ldquo;Plan my event&rdquo; suggestions. Toggle which boards can be recommended and set their priority
        (higher = suggested first). Feeds ranges come from each board&apos;s own record in Menu &amp; Pricing. Changes take effect immediately.
      </p>
      {msg && <div className="notice good">{msg}</div>}
      {error && <div className="notice danger">{error}</div>}

      {boards.length === 0 && <p className="muted">No boards yet — add boards in Menu &amp; Pricing.</p>}

      {[...boards]
        .sort((a, b) => b.recommendPriority - a.recommendPriority || a.name.localeCompare(b.name))
        .map((board) => (
          <div key={board.id} className="card rec-row" style={{ marginBottom: 10 }}>
            <div className="rec-info">
              <strong>{board.name}</strong>
              <span className="muted"> · feeds {board.feedsMin ?? "?"}–{board.feedsMax ?? "?"}</span>
            </div>
            <label className="toggle inline">
              <input
                type="checkbox"
                checked={board.recommendEligible}
                onChange={(e) => patch(board.id, { recommendEligible: e.target.checked })}
              />
              <span>Eligible</span>
            </label>
            <label className="field rec-priority">
              <span>Priority</span>
              <input
                className="input"
                type="number"
                min={0}
                value={board.recommendPriority}
                onChange={(e) => patch(board.id, { recommendPriority: parseInt(e.target.value, 10) || 0 })}
              />
            </label>
            <button className="btn" disabled={savingId === board.id} onClick={() => save(board)}>
              {savingId === board.id ? "Saving…" : "Save"}
            </button>
          </div>
        ))}
    </div>
  );
}
