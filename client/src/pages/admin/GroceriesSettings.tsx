import { useEffect, useMemo, useState } from "react";
import { api, type LocationT, type GroceryProductT } from "../../lib/api";
import {
  adminApi,
  type GroceryClosureDTO,
  type GroceryProductUpsertInput,
  type GrocerySettingsDTO,
  type GroceryShopSettingDTO,
} from "../../lib/admin";
import { ImageUpload } from "../../components/ImageUpload";

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

// The departments the seed catalogue uses today — a free-text field underneath, so a new
// department (e.g. "salads") can still be typed in without a code change.
const KNOWN_DEPARTMENTS = [
  "sandwiches", "open-sandwiches", "salads", "salami", "meats", "quiches", "cheese", "pies", "tubs", "savoury", "pantry", "cakes",
];

// Drops any locationId the admin can't see/toggle here (e.g. a shop later made inactive) —
// otherwise it silently rides along on every save, and a product can end up assigned ONLY
// to a shop nobody can select or deselect in this UI (a real incident: 45 products got
// reassigned to a defunct location this way when their real shops were toggled off).
function toInput(p: GroceryProductT, selectableIds: Set<string>): GroceryProductUpsertInput {
  return {
    department: p.department, name: p.name, description: p.description, price: p.price,
    unitLabel: p.unitLabel, imageUrl: p.imageUrl, active: p.active, sortOrder: p.sortOrder,
    locationIds: p.locationIds.filter((id) => selectableIds.has(id)),
  };
}

function ProductRow({ product, locations, onChanged, onDone }: { product: GroceryProductT; locations: LocationT[]; onChanged: () => void; onDone: () => void }) {
  const selectableIds = useMemo(() => new Set(locations.map((l) => l.id)), [locations]);
  const [draft, setDraft] = useState<GroceryProductUpsertInput>(toInput(product, selectableIds));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toInput(product, selectableIds));
  const set = (patch: Partial<GroceryProductUpsertInput>) => setDraft((d) => ({ ...d, ...patch }));

  function toggleLocation(id: string) {
    set({ locationIds: draft.locationIds.includes(id) ? draft.locationIds.filter((x) => x !== id) : [...draft.locationIds, id] });
  }

  async function save() {
    setBusy(true); setErr(null);
    try { await adminApi.groceries.updateProduct(product.id, draft); onChanged(); onDone(); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Delete "${product.name}"?`)) return;
    setBusy(true); setErr(null);
    try { await adminApi.groceries.deleteProduct(product.id); onChanged(); onDone(); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="card addon-admin-row editor" style={{ marginBottom: 12 }}>
      {err && <div className="notice danger">{err}</div>}
      <ImageUpload value={draft.imageUrl ?? ""} onChange={(url) => set({ imageUrl: url })} label="Photo" />
      <div className="grid-2">
        <div className="field">
          <label>Name</label>
          <input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="field">
          <label>Department</label>
          <input className="input" list="grocery-departments" value={draft.department} onChange={(e) => set({ department: e.target.value })} />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Price (£)</label>
          <input className="input" type="number" step="0.01" min={0} value={draft.price} onChange={(e) => set({ price: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="field">
          <label>Unit (optional — e.g. &quot;per sheet&quot;, &quot;pack of 4&quot;)</label>
          <input className="input" value={draft.unitLabel ?? ""} onChange={(e) => set({ unitLabel: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>Description (optional)</label>
        <input className="input" value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
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
        <button className="btn btn-secondary" disabled={busy} onClick={onDone}>Close</button>
        <button className="btn" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        <button className="btn-ghost" disabled={busy} onClick={remove}>Delete</button>
      </div>
    </div>
  );
}

// Compact collapsed row (thumbnail, name, quick price edit, active toggle) — mirrors
// MenuEditor's PlatterQuickRow. The full ProductRow (photo upload, department, locations…)
// only renders for the one item currently being edited, so a department of a dozen-plus
// products doesn't render a dozen full photo-upload forms at once.
function GroceryQuickRow({
  product, locations, editing, onEdit, onChanged, onError,
}: {
  product: GroceryProductT; locations: LocationT[]; editing: boolean; onEdit: () => void; onChanged: () => void; onError: (m: string) => void;
}) {
  const selectableIds = useMemo(() => new Set(locations.map((l) => l.id)), [locations]);
  const [price, setPrice] = useState(String(product.price));
  const [busy, setBusy] = useState(false);
  const priceNum = parseFloat(price) || 0;
  const dirty = priceNum > 0 && priceNum !== product.price;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); onChanged(); }
    catch (e: any) { onError(e.message); }
    finally { setBusy(false); }
  }

  const savePrice = () => run(() => adminApi.groceries.updateProduct(product.id, { ...toInput(product, selectableIds), price: priceNum }));

  return (
    <div className={`bc-row ${!product.active ? "bc-row-hidden" : ""} ${editing ? "bc-row-editing" : ""}`}>
      {product.imageUrl ? (
        <img className="bc-row-thumb" src={product.imageUrl} alt="" loading="lazy" />
      ) : (
        <span className="bc-row-thumb bc-row-thumb-empty" aria-hidden="true" title="No photo yet">🖼</span>
      )}
      <span className="bc-row-label bc-row-name">
        {product.name}
        {!product.active && <small className="muted"> (hidden)</small>}
      </span>
      <div className="bc-row-price">
        <span className="muted">£</span>
        <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} />
      </div>
      <div className="bc-row-actions">
        {dirty && <button className="btn bc-save" disabled={busy} onClick={savePrice}>Save</button>}
        <button
          className="icon-btn" disabled={busy} title={product.active ? "Hide from customers" : "Show to customers"}
          onClick={() => run(() => adminApi.groceries.updateProduct(product.id, { ...toInput(product, selectableIds), active: !product.active }))}
        >
          {product.active ? "👁" : "🚫"}
        </button>
        <button className="icon-btn" disabled={busy} title="Full editor (photo, department, shops…)" onClick={onEdit}>✎</button>
      </div>
    </div>
  );
}

function ProductsSection({ locations }: { locations: LocationT[] }) {
  const [products, setProducts] = useState<GroceryProductT[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function refresh() {
    adminApi.groceries.products().then(setProducts).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  const departments = useMemo(() => Array.from(new Set(products.map((p) => p.department))).sort(), [products]);
  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () => products.filter((p) => (filter === "all" || p.department === filter) && (!q || p.name.toLowerCase().includes(q))),
    [products, filter, q],
  );

  async function create() {
    if (!newName.trim() || !newDepartment.trim()) return;
    setCreating(true); setError(null);
    try {
      const created = await adminApi.groceries.createProduct({
        name: newName.trim(), department: newDepartment.trim(), price: parseFloat(newPrice) || 0,
        locationIds: locations.map((l) => l.id),
      });
      setNewName(""); setNewDepartment(""); setNewPrice("");
      refresh();
      // Jump straight into the full editor so adding a photo is the natural next step,
      // not a second trip back into a long list to find the thing just created.
      setEditingId(created.id);
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <datalist id="grocery-departments">
        {KNOWN_DEPARTMENTS.map((d) => <option key={d} value={d} />)}
      </datalist>
      <h2>Grocery items</h2>
      <p className="muted">Sandwiches, meats, cheese, pies, savouries — whatever's on the counter. Available everywhere by default; untick a shop above to hide it there.</p>
      {error && <div className="notice danger">{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>New grocery item</h3>
        <div className="grid-2">
          <div className="field"><label>Name</label><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Ham Salad Sandwich" /></div>
          <div className="field"><label>Department</label><input className="input" list="grocery-departments" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} placeholder="e.g. sandwiches" /></div>
        </div>
        <div className="field"><label>Price (£)</label><input className="input" type="number" step="0.01" min={0} value={newPrice} onChange={(e) => setNewPrice(e.target.value)} /></div>
        <button className="btn" disabled={creating || !newName.trim() || !newDepartment.trim()} onClick={create}>{creating ? "Adding…" : "Add item"}</button>
      </div>

      <div className="field" style={{ maxWidth: 360 }}>
        <label>Find an item</label>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" />
      </div>

      {departments.length > 0 && (
        <div className="status-buttons" style={{ marginBottom: 14 }}>
          <button type="button" className={`status-btn${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>All ({products.length})</button>
          {departments.map((d) => (
            <button key={d} type="button" className={`status-btn${filter === d ? " active" : ""}`} onClick={() => setFilter(d)}>
              {d} ({products.filter((p) => p.department === d).length})
            </button>
          ))}
        </div>
      )}
      {q && visible.length === 0 && <p className="muted">No items match &ldquo;{search}&rdquo;.</p>}

      <div className="bc-rows">
        {visible.map((p) =>
          editingId === p.id ? (
            <ProductRow key={p.id} product={p} locations={locations} onChanged={refresh} onDone={() => setEditingId(null)} />
          ) : (
            <GroceryQuickRow
              key={p.id}
              product={p}
              locations={locations}
              editing={false}
              onEdit={() => setEditingId(p.id)}
              onChanged={refresh}
              onError={setError}
            />
          ),
        )}
      </div>
    </section>
  );
}

function GlobalSettingsSection() {
  const [settings, setSettings] = useState<GrocerySettingsDTO | null>(null);
  const [draft, setDraft] = useState<GrocerySettingsDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adminApi.groceries.settings().then((s) => { setSettings(s); setDraft(s); }).catch((e) => setErr(e.message));
  }, []);

  const dirty = draft && settings && JSON.stringify(draft) !== JSON.stringify(settings);
  const set = (patch: Partial<GrocerySettingsDTO>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  async function save() {
    if (!draft) return;
    setBusy(true); setErr(null);
    try {
      const updated = await adminApi.groceries.updateSettings(draft);
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
          <label>Lead time (hours before collection)</label>
          <input className="input" type="number" min={0} value={draft.leadTimeHours} onChange={(e) => set({ leadTimeHours: parseInt(e.target.value, 10) || 0 })} />
        </div>
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
  const [closures, setClosures] = useState<GroceryClosureDTO[]>([]);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    adminApi.groceries.closures(locationId).then(setClosures).catch((e) => setErr(e.message));
  }
  useEffect(refresh, [locationId]);

  async function add() {
    if (!date) return;
    setBusy(true); setErr(null);
    try {
      await adminApi.groceries.createClosure({ locationId, date, reason: reason.trim() || undefined });
      setDate(""); setReason("");
      refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    try { await adminApi.groceries.deleteClosure(id); setClosures((prev) => prev.filter((c) => c.id !== id)); }
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

function ShopSettingRow({ shop, onChanged }: { shop: GroceryShopSettingDTO; onChanged: (s: GroceryShopSettingDTO) => void }) {
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
      const updated = await adminApi.groceries.updateShopSettings(shop.locationId, {
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
  const [shops, setShops] = useState<GroceryShopSettingDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.groceries.shopSettings().then(setShops).catch((e) => setError(e.message));
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

export default function GroceriesSettings() {
  const [locations, setLocations] = useState<LocationT[]>([]);
  useEffect(() => { api.locations().then(setLocations).catch(() => {}); }, []);
  const activeLocations = useMemo(() => locations.filter((l) => l.active), [locations]);

  return (
    <div>
      <h1>Groceries settings</h1>
      <p className="muted">Everything here is live immediately — no deploy needed. Prices start at £0 and items start hidden (Active off) until you set them up.</p>
      <ProductsSection locations={activeLocations} />
      <GlobalSettingsSection />
      <ShopSettingsSection />
    </div>
  );
}
