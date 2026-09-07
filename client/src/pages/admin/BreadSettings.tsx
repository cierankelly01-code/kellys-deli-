import { useEffect, useMemo, useState } from "react";
import { api, type LocationT } from "../../lib/api";
import {
  adminApi,
  type BreadClosureDTO,
  type BreadProductUpsertInput,
  type BreadSettingsDTO,
  type BreadShopSettingDTO,
} from "../../lib/admin";
import type { BreadProduct } from "../../lib/api";

// closedWeekdays uses JS getUTCDay() convention (0=Sun..6=Sat); shown Monday-first.
const WEEKDAY_OPTIONS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

function toInput(p: BreadProduct): BreadProductUpsertInput {
  return { name: p.name, description: p.description, price: p.price, active: p.active, sortOrder: p.sortOrder, locationIds: p.locationIds };
}

function ProductRow({ product, locations, onChanged }: { product: BreadProduct; locations: LocationT[]; onChanged: () => void }) {
  const [draft, setDraft] = useState<BreadProductUpsertInput>(toInput(product));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toInput(product));
  const set = (patch: Partial<BreadProductUpsertInput>) => setDraft((d) => ({ ...d, ...patch }));

  function toggleLocation(id: string) {
    set({ locationIds: draft.locationIds.includes(id) ? draft.locationIds.filter((x) => x !== id) : [...draft.locationIds, id] });
  }

  async function save() {
    setBusy(true); setErr(null);
    try { await adminApi.bread.updateProduct(product.id, draft); onChanged(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Delete "${product.name}"?`)) return;
    setBusy(true); setErr(null);
    try { await adminApi.bread.deleteProduct(product.id); onChanged(); }
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
          <label>Description (optional)</label>
          <input className="input" value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>Available at</label>
        <div className="status-buttons">
          {locations.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`status-btn${draft.locationIds.includes(l.id) ? " active" : ""}`}
              onClick={() => toggleLocation(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>
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

function ProductsSection({ locations }: { locations: LocationT[] }) {
  const [products, setProducts] = useState<BreadProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [creating, setCreating] = useState(false);

  function refresh() {
    adminApi.bread.products().then(setProducts).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function create() {
    if (!newName.trim()) return;
    setCreating(true); setError(null);
    try {
      await adminApi.bread.createProduct({ name: newName.trim(), price: parseFloat(newPrice) || 0, locationIds: locations.map((l) => l.id) });
      setNewName(""); setNewPrice("");
      refresh();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h2>Bread items</h2>
      <p className="muted">Cobs, loaves, bloomers, rolls — whatever you sell. Available everywhere by default; untick a shop above to hide it there.</p>
      {error && <div className="notice danger">{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>New bread item</h3>
        <div className="grid-2">
          <div className="field"><label>Name</label><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. White Cob" /></div>
          <div className="field"><label>Price (£)</label><input className="input" type="number" step="0.01" min={0} value={newPrice} onChange={(e) => setNewPrice(e.target.value)} /></div>
        </div>
        <button className="btn" disabled={creating || !newName.trim()} onClick={create}>{creating ? "Adding…" : "Add item"}</button>
      </div>

      {products.map((p) => <ProductRow key={p.id} product={p} locations={locations} onChanged={refresh} />)}
    </section>
  );
}

function GlobalSettingsSection() {
  const [settings, setSettings] = useState<BreadSettingsDTO | null>(null);
  const [draft, setDraft] = useState<BreadSettingsDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adminApi.bread.settings().then((s) => { setSettings(s); setDraft(s); }).catch((e) => setErr(e.message));
  }, []);

  const dirty = draft && settings && JSON.stringify(draft) !== JSON.stringify(settings);
  const set = (patch: Partial<BreadSettingsDTO>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  async function save() {
    if (!draft) return;
    setBusy(true); setErr(null);
    try {
      const updated = await adminApi.bread.updateSettings(draft);
      setSettings(updated); setDraft(updated);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (!draft) return <section style={{ marginBottom: 32 }}><h2>Ordering rules</h2>{err && <div className="notice danger">{err}</div>}<p className="muted">Loading…</p></section>;

  return (
    <section style={{ marginBottom: 32 }}>
      <h2>Ordering rules</h2>
      <p className="muted">Applies to every shop unless a shop overrides its own capacity or closed days below.</p>
      {err && <div className="notice danger">{err}</div>}

      <div className="card">
        <div className="field">
          <label>How orders close</label>
          <div className="status-buttons">
            <button type="button" className={`status-btn${draft.cutoffMode === "rolling" ? " active" : ""}`} onClick={() => set({ cutoffMode: "rolling" })}>Rolling notice</button>
            <button type="button" className={`status-btn${draft.cutoffMode === "cutoff" ? " active" : ""}`} onClick={() => set({ cutoffMode: "cutoff" })}>Fixed cutoff</button>
          </div>
        </div>

        {draft.cutoffMode === "rolling" ? (
          <div className="field">
            <label>Lead time (hours before collection)</label>
            <input className="input" type="number" min={0} value={draft.leadTimeHours} onChange={(e) => set({ leadTimeHours: parseInt(e.target.value, 10) || 0 })} />
          </div>
        ) : (
          <div className="grid-2">
            <div className="field">
              <label>Days before collection</label>
              <input className="input" type="number" min={0} value={draft.cutoffDaysBefore ?? 2} onChange={(e) => set({ cutoffDaysBefore: parseInt(e.target.value, 10) || 0 })} />
            </div>
            <div className="field">
              <label>Cutoff time (24h, UK time)</label>
              <input className="input" type="time" value={draft.cutoffTime ?? "14:00"} onChange={(e) => set({ cutoffTime: e.target.value })} />
            </div>
            <p className="muted" style={{ gridColumn: "1 / -1" }}>
              e.g. 2 days before at 14:00 means orders for a Wednesday collection close Monday at 2pm.
            </p>
          </div>
        )}

        <div className="grid-2">
          <div className="field">
            <label>Minimum order (items)</label>
            <input className="input" type="number" min={1} value={draft.minOrderQty} onChange={(e) => set({ minOrderQty: parseInt(e.target.value, 10) || 1 })} />
          </div>
          <div className="field">
            <label>Maximum per item</label>
            <input className="input" type="number" min={1} value={draft.maxItemQty} onChange={(e) => set({ maxItemQty: parseInt(e.target.value, 10) || 1 })} />
          </div>
        </div>

        <button className="btn" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save ordering rules"}</button>
      </div>
    </section>
  );
}

function ClosuresList({ locationId }: { locationId: string }) {
  const [closures, setClosures] = useState<BreadClosureDTO[]>([]);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    adminApi.bread.closures(locationId).then(setClosures).catch((e) => setErr(e.message));
  }
  useEffect(refresh, [locationId]);

  async function add() {
    if (!date) return;
    setBusy(true); setErr(null);
    try {
      await adminApi.bread.createClosure({ locationId, date, reason: reason.trim() || undefined });
      setDate(""); setReason("");
      refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    try { await adminApi.bread.deleteClosure(id); setClosures((prev) => prev.filter((c) => c.id !== id)); }
    catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="field">
      <label>One-off closures (bank holidays, unplanned closures)</label>
      {err && <div className="notice danger">{err}</div>}
      {closures.length === 0 && <p className="muted">None set.</p>}
      <div className="status-buttons">
        {closures.map((c) => (
          <span key={c.id} className="pill">
            {c.date}{c.reason ? ` — ${c.reason}` : ""}{" "}
            <button
              type="button"
              onClick={() => remove(c.id)}
              aria-label={`Remove closure ${c.date}`}
              style={{ marginLeft: 4, border: "none", background: "none", cursor: "pointer", color: "inherit", font: "inherit", padding: 0 }}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="grid-2" style={{ marginTop: 8 }}>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <button className="btn-ghost" disabled={!date || busy} onClick={add}>{busy ? "Adding…" : "Add closure"}</button>
    </div>
  );
}

function ShopSettingRow({ shop, onChanged }: { shop: BreadShopSettingDTO; onChanged: (s: BreadShopSettingDTO) => void }) {
  const [draft, setDraft] = useState(shop);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(shop);

  function toggleWeekday(v: number) {
    setDraft((d) => ({ ...d, closedWeekdays: d.closedWeekdays.includes(v) ? d.closedWeekdays.filter((x) => x !== v) : [...d.closedWeekdays, v] }));
  }

  async function save() {
    setBusy(true); setErr(null);
    try {
      const updated = await adminApi.bread.updateShopSettings(shop.locationId, {
        dailyCapacity: draft.dailyCapacity,
        closedWeekdays: draft.closedWeekdays,
        notifyEmail: draft.notifyEmail,
      });
      onChanged(updated);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{shop.locationName}</h3>
      {err && <div className="notice danger">{err}</div>}

      <div className="field">
        <label>Closed on</label>
        <div className="status-buttons">
          {WEEKDAY_OPTIONS.map((w) => (
            <button key={w.value} type="button" className={`status-btn${draft.closedWeekdays.includes(w.value) ? " active" : ""}`} onClick={() => toggleWeekday(w.value)}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Daily capacity (total items — blank = unlimited)</label>
          <input
            className="input"
            type="number"
            min={0}
            value={draft.dailyCapacity ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, dailyCapacity: e.target.value === "" ? null : parseInt(e.target.value, 10) || 0 }))}
          />
        </div>
        <div className="field">
          <label>New-order alert email</label>
          <input
            className="input"
            type="email"
            value={draft.notifyEmail ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, notifyEmail: e.target.value }))}
            placeholder="shop@kellysdeli.co.uk"
          />
        </div>
      </div>

      <ClosuresList locationId={shop.locationId} />

      <button className="btn" disabled={!dirty || busy} onClick={save} style={{ marginTop: 12 }}>{busy ? "Saving…" : "Save shop settings"}</button>
    </div>
  );
}

function ShopSettingsSection() {
  const [shops, setShops] = useState<BreadShopSettingDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.bread.shopSettings().then(setShops).catch((e) => setError(e.message));
  }, []);

  return (
    <section>
      <h2>Per-shop settings</h2>
      {error && <div className="notice danger">{error}</div>}
      {shops.map((s) => (
        <ShopSettingRow
          key={s.locationId}
          shop={s}
          onChanged={(updated) => setShops((prev) => prev.map((x) => (x.locationId === updated.locationId ? updated : x)))}
        />
      ))}
    </section>
  );
}

export default function BreadSettings() {
  const [locations, setLocations] = useState<LocationT[]>([]);
  useEffect(() => { api.locations().then(setLocations).catch(() => {}); }, []);
  const activeLocations = useMemo(() => locations.filter((l) => l.active), [locations]);

  return (
    <div>
      <h1>Bread settings</h1>
      <p className="muted">Everything here is live immediately — no deploy needed.</p>
      <ProductsSection locations={activeLocations} />
      <GlobalSettingsSection />
      <ShopSettingsSection />
    </div>
  );
}
