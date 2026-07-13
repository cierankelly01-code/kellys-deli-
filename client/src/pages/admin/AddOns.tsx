import { useEffect, useState } from "react";
import { adminApi, type AdminAddOn, type AddOnUpsertInput } from "../../lib/admin";
import type { AddOnUnitType } from "../../lib/api";

const UNIT_TYPES: Array<{ value: AddOnUnitType; label: string }> = [
  { value: "per_person", label: "Per person" },
  { value: "per_order", label: "Per order / item" },
  { value: "serves", label: "Serves N" },
];

function toInput(a: AdminAddOn): AddOnUpsertInput {
  return {
    name: a.name,
    description: a.description,
    price: a.price,
    unitType: a.unitType,
    unitLabel: a.unitLabel,
    servesPerUnit: a.servesPerUnit,
    suggestFromHeadcount: a.suggestFromHeadcount,
    imageUrl: a.imageUrl,
    active: a.active,
    sortOrder: a.sortOrder,
  };
}

function AddOnRow({ addOn, onChanged }: { addOn: AdminAddOn; onChanged: () => void }) {
  const [draft, setDraft] = useState<AddOnUpsertInput>(toInput(addOn));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toInput(addOn));
  const set = (patch: Partial<AddOnUpsertInput>) => setDraft((d) => ({ ...d, ...patch }));

  async function save() {
    setBusy(true); setErr(null);
    try { await adminApi.updateAddOn(addOn.id, draft); onChanged(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Delete "${addOn.name}"?`)) return;
    setBusy(true); setErr(null);
    try { await adminApi.deleteAddOn(addOn.id); onChanged(); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="card addon-admin-row" style={{ marginBottom: 12 }}>
      {err && <div className="notice danger">{err}</div>}
      <div className="field">
        <label>Name</label>
        <input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Price (£)</label>
          <input className="input" type="number" step="0.01" min={0} value={draft.price} onChange={(e) => set({ price: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="field">
          <label>Unit type</label>
          <select className="input" value={draft.unitType} onChange={(e) => set({ unitType: e.target.value as AddOnUnitType })}>
            {UNIT_TYPES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Unit label (display)</label>
          <input className="input" value={draft.unitLabel ?? ""} onChange={(e) => set({ unitLabel: e.target.value })} placeholder="e.g. per person" />
        </div>
        {draft.unitType === "serves" && (
          <div className="field">
            <label>Serves how many?</label>
            <input className="input" type="number" min={1} value={draft.servesPerUnit ?? 10} onChange={(e) => set({ servesPerUnit: parseInt(e.target.value, 10) || 1 })} />
          </div>
        )}
      </div>
      <label className="toggle inline">
        <input type="checkbox" checked={!!draft.suggestFromHeadcount} onChange={(e) => set({ suggestFromHeadcount: e.target.checked })} />
        <span>Suggest quantity from headcount</span>
      </label>
      <label className="toggle inline">
        <input type="checkbox" checked={draft.active !== false} onChange={(e) => set({ active: e.target.checked })} />
        <span>Active (shown to customers)</span>
      </label>
      <div className="nav-row">
        <button className="btn" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        <button className="btn-ghost" disabled={busy} onClick={remove}>Delete</button>
      </div>
    </div>
  );
}

export default function AddOns() {
  const [addOns, setAddOns] = useState<AdminAddOn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [creating, setCreating] = useState(false);

  function refresh() {
    adminApi.addOns().then(setAddOns).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function create() {
    if (!newName.trim()) return;
    setCreating(true); setError(null);
    try {
      await adminApi.createAddOn({ name: newName.trim(), price: parseFloat(newPrice) || 0, unitType: "per_order" });
      setNewName(""); setNewPrice("");
      refresh();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  }

  return (
    <div>
      <h1>Add-ons</h1>
      <p className="muted">Upsell extras shown in every order flow. Placeholder prices — set your real prices here.</p>
      {error && <div className="notice danger">{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>New add-on</h2>
        <div className="grid-2">
          <div className="field"><label>Name</label><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
          <div className="field"><label>Price (£)</label><input className="input" type="number" step="0.01" min={0} value={newPrice} onChange={(e) => setNewPrice(e.target.value)} /></div>
        </div>
        <button className="btn" disabled={creating || !newName.trim()} onClick={create}>{creating ? "Adding…" : "Add add-on"}</button>
      </div>

      {addOns.map((a) => <AddOnRow key={a.id} addOn={a} onChanged={refresh} />)}
    </div>
  );
}
