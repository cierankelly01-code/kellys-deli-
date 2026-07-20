import { useEffect, useMemo, useState } from "react";
import { adminApi, type AdminPlatter, type AdminAddOn } from "../../lib/admin";
import { type Bundle, type BundleInput } from "../../lib/api";
import { ImageUpload } from "../../components/ImageUpload";
import { gbp } from "../../lib/format";

type Item = { kind: "board" | "addon"; refId: string; quantity: number };
type Draft = { id?: string; name: string; tagline: string; description: string; imageUrl: string; active: boolean; items: Item[] };

const emptyDraft = (): Draft => ({ name: "", tagline: "", description: "", imageUrl: "", active: true, items: [] });

export default function Bundles() {
  const [bundles, setBundles] = useState<Bundle[] | null>(null);
  const [boards, setBoards] = useState<AdminPlatter[]>([]);
  const [addOns, setAddOns] = useState<AdminAddOn[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function refresh() {
    adminApi.bundles().then(setBundles).catch((e) => setError(e.message));
  }
  useEffect(() => {
    refresh();
    adminApi.platters().then((p) => setBoards(p.filter((b) => b.fixedPrice != null))).catch(() => {});
    adminApi.addOns().then(setAddOns).catch(() => {});
  }, []);

  const nameOf = (it: Item) =>
    (it.kind === "board" ? boards.find((b) => b.id === it.refId)?.name : addOns.find((a) => a.id === it.refId)?.name) ?? it.refId;
  const priceOf = (it: Item) =>
    it.kind === "board" ? Number(boards.find((b) => b.id === it.refId)?.fixedPrice ?? 0) : Number(addOns.find((a) => a.id === it.refId)?.price ?? 0);

  function startNew() { setDraft(emptyDraft()); setMsg(null); setError(null); }
  function edit(b: Bundle) {
    setDraft({
      id: b.id, name: b.name, tagline: b.tagline ?? "", description: b.description ?? "", imageUrl: b.imageUrl ?? "",
      active: b.active, items: b.items.map((it) => ({ kind: it.kind, refId: it.refId, quantity: it.quantity })),
    });
    setMsg(null); setError(null);
  }
  function addItem(kind: "board" | "addon", refId: string) {
    if (!draft || !refId) return;
    if (draft.items.some((it) => it.kind === kind && it.refId === refId)) return;
    setDraft({ ...draft, items: [...draft.items, { kind, refId, quantity: 1 }] });
  }
  function setQty(idx: number, q: number) {
    if (!draft) return;
    setDraft({ ...draft, items: draft.items.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, q) } : it)) });
  }
  function removeItem(idx: number) {
    if (!draft) return;
    setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) });
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) return setError("Give the bundle a name.");
    if (draft.items.length === 0) return setError("Add at least one board or extra.");
    setSaving(true); setError(null);
    const input: BundleInput = {
      name: draft.name.trim(), tagline: draft.tagline.trim() || null, description: draft.description.trim() || null,
      imageUrl: draft.imageUrl.trim() || null, active: draft.active, items: draft.items,
    };
    try {
      if (draft.id) await adminApi.updateBundle(draft.id, input);
      else await adminApi.createBundle(input);
      setMsg("Saved — live on the shop."); setDraft(null); refresh();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this bundle? This can't be undone.")) return;
    try { await adminApi.deleteBundle(id); refresh(); } catch (e: any) { setError(e.message); }
  }

  const total = useMemo(
    () => (draft ? draft.items.reduce((sum, it) => sum + priceOf(it) * it.quantity, 0) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, boards, addOns],
  );

  return (
    <div>
      <h1>Bundles</h1>
      <p className="muted">Ready-made combos customers add to the basket in one tap. Priced at the total of what&apos;s inside (no fake discounts).</p>
      {msg && <div className="notice good">{msg}</div>}
      {error && <div className="notice danger">{error}</div>}

      {!draft && <button className="btn" onClick={startNew} style={{ width: "auto" }}>+ New bundle</button>}

      {draft && (
        <div className="card" style={{ padding: 18, margin: "14px 0" }}>
          <h2>{draft.id ? "Edit bundle" : "New bundle"}</h2>
          <div className="field"><label>Name</label>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Movie Night In" /></div>
          <div className="field"><label>Tagline</label>
            <input className="input" value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} placeholder="One-line pitch on the card" /></div>
          <div className="field"><label>Description (optional)</label>
            <textarea className="input" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          <ImageUpload value={draft.imageUrl} onChange={(url) => setDraft({ ...draft, imageUrl: url })} label="Bundle photo" />

          <h3>What&apos;s in it</h3>
          {draft.items.length === 0 && <p className="muted">No items yet — add boards and extras below.</p>}
          <div className="stack">
            {draft.items.map((it, i) => (
              <div className="card loc-row" key={`${it.kind}-${it.refId}`}>
                <div className="spread">
                  <span>{it.kind === "board" ? "🧀 " : "➕ "}{nameOf(it)} <span className="muted">· {gbp(priceOf(it))}</span></span>
                  <div className="right" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input className="input" type="number" min={1} style={{ width: 72 }} value={it.quantity} onChange={(e) => setQty(i, parseInt(e.target.value) || 1)} />
                    <button className="btn-ghost" onClick={() => removeItem(i)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="field"><label>Add a board</label>
            <select className="input" value="" onChange={(e) => { addItem("board", e.target.value); e.currentTarget.value = ""; }}>
              <option value="">Choose a board…</option>
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name} · {gbp(Number(b.fixedPrice ?? 0))}</option>)}
            </select></div>
          <div className="field"><label>Add an extra</label>
            <select className="input" value="" onChange={(e) => { addItem("addon", e.target.value); e.currentTarget.value = ""; }}>
              <option value="">Choose an add-on…</option>
              {addOns.map((a) => <option key={a.id} value={a.id}>{a.name} · {gbp(Number(a.price))}</option>)}
            </select></div>

          <p style={{ marginTop: 10 }}><strong>Bundle price: {gbp(total)}</strong> <span className="muted">(sum of the items)</span></p>
          <label className="toggle inline"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /><span>Show on the shop</span></label>
          <div className="nav-row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save bundle"}</button>
            <button className="btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="stack" style={{ marginTop: 18 }}>
        {bundles?.map((b) => (
          <div className="card loc-row" key={b.id}>
            <div className="spread">
              <div>
                <strong>{b.name}</strong> {!b.active && <span className="muted">(hidden)</span>}
                <div className="muted">{b.items.map((it) => `${it.quantity > 1 ? it.quantity + "× " : ""}${it.name}`).join(", ") || "no items"}</div>
                <div className="muted">{gbp(b.total)}</div>
              </div>
              <div className="right" style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => edit(b)}>Edit</button>
                <button className="btn-ghost" onClick={() => remove(b.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {bundles && bundles.length === 0 && <p className="muted">No bundles yet — create your first above.</p>}
      </div>
    </div>
  );
}
