import { useEffect, useState } from "react";
import {
  adminApi,
  type AdminPlatter,
  type AdminExperience,
  type PlatterUpsertInput,
  type ExperienceUpsertInput,
} from "../../lib/admin";
import { type LocationT, type PlatterItem, type Category, type BoardType, type BoardSize, type BoardTier } from "../../lib/api";
import { MarginMeter } from "../../components/MarginMeter";
import { ImageUpload } from "../../components/ImageUpload";

type PricingType = "perHead" | "fixed";
const CATEGORY_LABEL: Record<Category, string> = { board: "Boards", home: "At Home", events: "Events & Office", seasonal: "Seasonal", platters: "Platters (legacy)" };
const BOARD_TYPE_LABEL: Record<BoardType, string> = { charcuterie: "Charcuterie", savoury: "Savoury", cheese: "Cheese", salmon: "Smoked Salmon" };
const BOARD_SIZE_LABEL: Record<BoardSize, string> = { small: "Small", medium: "Medium", large: "Large" };
const TIER_LABEL: Record<BoardTier, string> = { signature: "Signature", gallery: "More Boards" };

interface Draft {
  id: string | null;
  category: Category;
  name: string;
  description: string;
  pricingType: PricingType;
  price: string;
  cost: string;
  serves: string;
  minHeadcount: string;
  items: PlatterItem[];
  imageUrl: string;
  active: boolean;
  boardType: BoardType | "";
  size: BoardSize | "";
  tier: BoardTier | "";
  feedsMin: string;
  feedsMax: string;
  recommendEligible: boolean;
  recommendPriority: string;
}

function toDraft(p: AdminPlatter): Draft {
  const pricingType: PricingType = p.fixedPrice != null ? "fixed" : "perHead";
  return {
    id: p.id, category: p.category, name: p.name, description: p.description, pricingType,
    price: String(pricingType === "fixed" ? p.fixedPrice : p.pricePerHead),
    cost: String(p.cost), serves: p.serves ?? "", minHeadcount: String(p.minHeadcount),
    items: p.items.map((i) => ({ ...i })), imageUrl: p.imageUrl ?? "", active: p.active,
    boardType: p.boardType ?? "", size: p.size ?? "",
    tier: p.tier ?? "", feedsMin: p.feedsMin != null ? String(p.feedsMin) : "",
    feedsMax: p.feedsMax != null ? String(p.feedsMax) : "",
    recommendEligible: p.recommendEligible, recommendPriority: String(p.recommendPriority),
  };
}
// The API takes the whole platter on every save, so quick edits send the full
// current row with just the changed fields swapped in (mirrors toDraft/save).
function toUpsert(p: AdminPlatter): PlatterUpsertInput {
  return {
    category: p.category, name: p.name, description: p.description,
    pricePerHead: p.pricePerHead, fixedPrice: p.fixedPrice, cost: p.cost,
    serves: p.serves, minHeadcount: p.minHeadcount, items: p.items.map((i) => ({ ...i })),
    imageUrl: p.imageUrl, active: p.active, sortOrder: p.sortOrder,
    boardType: p.boardType, size: p.size,
    tier: p.tier, feedsMin: p.feedsMin, feedsMax: p.feedsMax,
    recommendEligible: p.recommendEligible, recommendPriority: p.recommendPriority,
  };
}

function blankDraft(category: Category = "board"): Draft {
  return {
    id: null, category, name: "", description: "", pricingType: "fixed", price: "", cost: "", serves: "",
    minHeadcount: "1", items: [{ label: "", qtyPerUnit: 1 }], imageUrl: "", active: true,
    boardType: category === "platters" ? "charcuterie" : "", size: category === "platters" ? "medium" : "",
    tier: category === "board" ? "signature" : "", feedsMin: "", feedsMax: "",
    recommendEligible: category === "board", recommendPriority: "0",
  };
}

export default function MenuEditor() {
  const [platters, setPlatters] = useState<AdminPlatter[]>([]);
  const [experiences, setExperiences] = useState<AdminExperience[]>([]);
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function refresh() {
    Promise.all([adminApi.platters(), adminApi.experiences(), adminApi.locations(), adminApi.settings()])
      .then(([ps, es, ls, st]) => { setPlatters(ps); setExperiences(es); setLocations(ls); setSettings(st); })
      .catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const priceNum = draft ? parseFloat(draft.price) || 0 : 0;
  const costNum = draft ? parseFloat(draft.cost) || 0 : 0;

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) return setError("Give the platter a name");
    if (priceNum <= 0) return setError("Set a price greater than zero");
    const cleanItems = draft.items.filter((i) => i.label.trim() !== "");
    if (cleanItems.length === 0) return setError("Add at least one item");
    const input: PlatterUpsertInput = {
      category: draft.category,
      name: draft.name.trim(),
      description: draft.description.trim(),
      pricePerHead: draft.pricingType === "perHead" ? priceNum : null,
      fixedPrice: draft.pricingType === "fixed" ? priceNum : null,
      cost: costNum,
      serves: draft.serves.trim() || null,
      minHeadcount: Math.max(1, parseInt(draft.minHeadcount, 10) || 1),
      items: cleanItems.map((i) => ({ label: i.label.trim(), qtyPerUnit: Number(i.qtyPerUnit) || 0 })),
      imageUrl: draft.imageUrl.trim() || null,
      active: draft.active,
      boardType: draft.category === "platters" ? (draft.boardType || null) : null,
      size: draft.category === "platters" ? (draft.size || null) : null,
      tier: draft.category === "board" ? (draft.tier || null) : null,
      feedsMin: draft.feedsMin.trim() ? parseInt(draft.feedsMin, 10) : null,
      feedsMax: draft.feedsMax.trim() ? parseInt(draft.feedsMax, 10) : null,
      recommendEligible: draft.recommendEligible,
      recommendPriority: Math.max(0, parseInt(draft.recommendPriority, 10) || 0),
    };
    setSaving(true); setError(null); setMsg(null);
    try {
      if (draft.id) await adminApi.updatePlatter(draft.id, input);
      else await adminApi.createPlatter(input);
      setMsg("Saved — live on the customer site now.");
      setDraft(null); refresh();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }

  function updateItem(idx: number, patch: Partial<PlatterItem>) {
    set("items", draft!.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function moveItem(idx: number, dir: -1 | 1) {
    const items = [...draft!.items];
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    [items[idx], items[j]] = [items[j], items[idx]];
    set("items", items);
  }

  const grouped: Record<Category, AdminPlatter[]> = { board: [], home: [], events: [], seasonal: [], platters: [] };
  for (const p of platters) grouped[p.category]?.push(p);

  return (
    <div>
      <h1>Menu &amp; Pricing</h1>
      {msg && <div className="notice good">{msg}</div>}
      {error && <div className="notice danger">{error}</div>}

      <FirstOrderHook settings={settings} onSaved={refresh} />

      {(["platters", "home", "events", "seasonal"] as Category[]).map((cat) => (
        <div key={cat}>
          <h2>{CATEGORY_LABEL[cat]}{cat === "seasonal" ? " (switch on by season)" : ""}</h2>
          <div className="bc-rows">
            {grouped[cat].map((p) => (
              <PlatterQuickRow
                key={`${p.id}-${p.fixedPrice}-${p.pricePerHead}-${p.active}`}
                platter={p}
                editing={draft?.id === p.id}
                onEdit={() => { setDraft(toDraft(p)); setMsg(null); setError(null); }}
                onChanged={refresh}
                onError={setError}
              />
            ))}
          </div>
          <button className="chip add" style={{ marginTop: 8 }} onClick={() => { setDraft(blankDraft(cat)); setMsg(null); setError(null); }}>+ New</button>
        </div>
      ))}

      {/* Platter editor */}
      {draft && (
        <div className="card editor">
          <div className="field">
            <label>Category</label>
            <div className="seg wide">
              {(["board", "home", "events", "seasonal", "platters"] as Category[]).map((c) => (
                <button key={c} className={draft.category === c ? "active" : ""} onClick={() => set("category", c)}>{CATEGORY_LABEL[c]}</button>
              ))}
            </div>
          </div>
          {draft.category === "board" && (
            <>
              <div className="field">
                <label>Tier</label>
                <div className="seg wide">
                  {(Object.keys(TIER_LABEL) as BoardTier[]).map((t) => (
                    <button key={t} className={draft.tier === t ? "active" : ""} onClick={() => set("tier", t)}>{TIER_LABEL[t]}</button>
                  ))}
                </div>
              </div>
              <div className="price-row">
                <div className="field"><label>Feeds — minimum</label><input className="input" inputMode="numeric" value={draft.feedsMin} onChange={(e) => set("feedsMin", e.target.value)} placeholder="e.g. 8" /></div>
                <div className="field"><label>Feeds — maximum</label><input className="input" inputMode="numeric" value={draft.feedsMax} onChange={(e) => set("feedsMax", e.target.value)} placeholder="e.g. 10" /></div>
              </div>
              <div className="price-row">
                <label className="toggle inline"><input type="checkbox" checked={draft.recommendEligible} onChange={(e) => set("recommendEligible", e.target.checked)} /><span>Eligible for event recommendations</span></label>
                <div className="field"><label>Recommender priority (higher first)</label><input className="input" inputMode="numeric" value={draft.recommendPriority} onChange={(e) => set("recommendPriority", e.target.value)} placeholder="0" /></div>
              </div>
            </>
          )}
          {draft.category === "platters" && (
            <div className="price-row">
              <div className="field">
                <label>Board type</label>
                <div className="seg wide">
                  {(Object.keys(BOARD_TYPE_LABEL) as BoardType[]).map((bt) => (
                    <button key={bt} className={draft.boardType === bt ? "active" : ""} onClick={() => set("boardType", bt)}>{BOARD_TYPE_LABEL[bt]}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Size</label>
                <div className="seg wide">
                  {(Object.keys(BOARD_SIZE_LABEL) as BoardSize[]).map((sz) => (
                    <button key={sz} className={draft.size === sz ? "active" : ""} onClick={() => set("size", sz)}>{BOARD_SIZE_LABEL[sz]}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="field"><label>Name</label><input className="input" value={draft.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="field"><label>Description</label><textarea className="input" value={draft.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="field">
            <label>Pricing</label>
            <div className="seg wide">
              <button className={draft.pricingType === "fixed" ? "active" : ""} onClick={() => set("pricingType", "fixed")}>Fixed price</button>
              <button className={draft.pricingType === "perHead" ? "active" : ""} onClick={() => set("pricingType", "perHead")}>Per head</button>
            </div>
          </div>
          <div className="price-row">
            <div className="field"><label>{draft.pricingType === "fixed" ? "Price (£)" : "Price per head (£)"}</label><input className="input big" inputMode="decimal" value={draft.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" /></div>
            <div className="field"><label>Cost to make (£){draft.pricingType === "perHead" ? " / head" : ""}</label><input className="input big" inputMode="decimal" value={draft.cost} onChange={(e) => set("cost", e.target.value)} placeholder="0.00" /></div>
          </div>
          <MarginMeter price={priceNum} cost={costNum} unit={draft.pricingType === "perHead" ? "per head" : undefined} />
          <div className="price-row">
            {draft.pricingType === "perHead" && <div className="field"><label>Minimum headcount</label><input className="input" inputMode="numeric" value={draft.minHeadcount} onChange={(e) => set("minHeadcount", e.target.value)} /></div>}
            <div className="field"><label>Serves (display)</label><input className="input" value={draft.serves} onChange={(e) => set("serves", e.target.value)} placeholder="e.g. 15-20" /></div>
          </div>
          <div className="field">
            <label>Items (for the kitchen prep sheet)</label>
            <p className="muted hint">Quantity is {draft.pricingType === "perHead" ? "per head — multiplied by headcount" : "per platter — multiplied by number of orders"}.</p>
            {draft.items.map((it, idx) => (
              <div className="item-row" key={idx}>
                <input className="input" placeholder="Item" value={it.label} onChange={(e) => updateItem(idx, { label: e.target.value })} />
                <input className="input qty" inputMode="decimal" value={String(it.qtyPerUnit)} onChange={(e) => updateItem(idx, { qtyPerUnit: parseFloat(e.target.value) || 0 })} />
                <button className="icon-btn" onClick={() => moveItem(idx, -1)} aria-label="up">↑</button>
                <button className="icon-btn" onClick={() => moveItem(idx, 1)} aria-label="down">↓</button>
                <button className="icon-btn danger" onClick={() => set("items", draft.items.filter((_, i) => i !== idx))} aria-label="remove">✕</button>
              </div>
            ))}
            <button className="btn-ghost" onClick={() => set("items", [...draft.items, { label: "", qtyPerUnit: 1 }])}>+ Add item</button>
          </div>
          <ImageUpload value={draft.imageUrl} onChange={(url) => set("imageUrl", url)} />
          <label className="toggle"><input type="checkbox" checked={draft.active} onChange={(e) => set("active", e.target.checked)} /><span>Active (shown to customers). Turn off to hide without deleting — past orders are kept.</span></label>
          <div className="nav-row">
            <button className="btn btn-secondary" onClick={() => setDraft(null)} disabled={saving}>Cancel</button>
            <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      )}

      {/* Experiences */}
      <h2>Tastings &amp; Experiences</h2>
      <TastingsToggle settings={settings} onSaved={refresh} />
      <div className="stack">
        {experiences.map((e) => <ExperienceRow key={e.id} exp={e} onSaved={refresh} />)}
        <ExperienceRow onSaved={refresh} />
      </div>

      {/* Locations / capacity */}
      <h2>Locations &amp; daily capacity</h2>
      <p className="muted" style={{ marginTop: -6 }}>Max orders per day at each shop.</p>
      <div className="stack">{locations.map((l) => <LocationRow key={l.id} location={l} onSaved={refresh} />)}</div>
    </div>
  );
}

// Compact inline row: rename-free quick price/active edits + delete, "Edit" opens the full form.
function PlatterQuickRow({
  platter: p, editing, onEdit, onChanged, onError,
}: {
  platter: AdminPlatter; editing: boolean; onEdit: () => void; onChanged: () => void; onError: (m: string) => void;
}) {
  const [price, setPrice] = useState(String(p.isFixed ? p.fixedPrice : p.pricePerHead));
  const [busy, setBusy] = useState(false);
  const priceNum = parseFloat(price) || 0;
  const dirty = priceNum > 0 && priceNum !== (p.isFixed ? p.fixedPrice : p.pricePerHead);

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

  const savePrice = () =>
    run(() =>
      adminApi.updatePlatter(p.id, {
        ...toUpsert(p),
        pricePerHead: p.isFixed ? null : priceNum,
        fixedPrice: p.isFixed ? priceNum : null,
      }),
    );

  return (
    <div className={`bc-row ${!p.active ? "bc-row-hidden" : ""} ${editing ? "bc-row-editing" : ""}`}>
      <span className="bc-row-label bc-row-name">
        {p.name}
        {p.size ? <small className="muted"> · {p.size}</small> : null}
        {!p.active && <small className="muted"> (hidden)</small>}
      </span>
      <div className="bc-row-price">
        <span className="muted">£</span>
        <input
          className="input" inputMode="decimal"
          value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
        />
        {!p.isFixed && <span className="muted">/head</span>}
      </div>
      <div className="bc-row-actions">
        {dirty && <button className="btn bc-save" disabled={busy} onClick={savePrice}>Save</button>}
        <button
          className="icon-btn" disabled={busy} title={p.active ? "Hide from customers" : "Show to customers"}
          onClick={() => run(() => adminApi.updatePlatter(p.id, { ...toUpsert(p), active: !p.active }))}
        >
          {p.active ? "👁" : "🚫"}
        </button>
        <button className="icon-btn" disabled={busy} title="Full editor (description, photo, prep items…)" onClick={onEdit}>✎</button>
        <button
          className="icon-btn danger" disabled={busy} title="Delete"
          onClick={() => {
            if (window.confirm(`Delete "${p.name}"? This can't be undone.`)) {
              run(() => adminApi.deletePlatter(p.id));
            }
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function FirstOrderHook({ settings, onSaved }: { settings: Record<string, string>; onSaved: () => void }) {
  const [on, setOn] = useState(settings.firstOrderHook === "on");
  const [text, setText] = useState(settings.firstOrderHookText ?? "FREE: box of sausage rolls");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setOn(settings.firstOrderHook === "on"); setText(settings.firstOrderHookText ?? "FREE: box of sausage rolls"); }, [settings]);

  async function save(nextOn: boolean, nextText: string) {
    setSaving(true);
    try {
      await adminApi.setSetting("firstOrderHook", nextOn ? "on" : "off");
      await adminApi.setSetting("firstOrderHookText", nextText);
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="card loc-row" style={{ marginBottom: 18 }}>
      <label className="toggle inline">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); save(e.target.checked, text); }} />
        <span><strong>First-order hook</strong> — throw in a freebie on a customer&apos;s first order</span>
      </label>
      <div className="row" style={{ marginTop: 10 }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="FREE: box of sausage rolls" />
        <button className="btn" style={{ width: "auto" }} onClick={() => save(on, text)} disabled={saving}>{saving ? "…" : "Save"}</button>
      </div>
    </div>
  );
}

function TastingsToggle({ settings, onSaved }: { settings: Record<string, string>; onSaved: () => void }) {
  const comingSoon = settings.tastingsComingSoon !== "off"; // default coming soon
  const [saving, setSaving] = useState(false);
  async function setOpen(open: boolean) {
    setSaving(true);
    try {
      await adminApi.setSetting("tastingsComingSoon", open ? "off" : "on");
      onSaved();
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="card loc-row" style={{ marginBottom: 14 }}>
      <label className="toggle inline">
        <input type="checkbox" checked={!comingSoon} disabled={saving} onChange={(e) => setOpen(e.target.checked)} />
        <span>
          <strong>Open tastings for booking</strong> — {comingSoon
            ? "currently showing “Coming soon” to customers (not bookable)"
            : "customers can book now"}
        </span>
      </label>
    </div>
  );
}

interface ExpDraft { name: string; description: string; price: string; cost: string; capacity: string; imageUrl: string; active: boolean; }

function ExperienceRow({ exp, onSaved }: { exp?: AdminExperience; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<ExpDraft>(() => ({
    name: exp?.name ?? "", description: exp?.description ?? "", price: String(exp?.pricePerHead ?? ""),
    cost: String(exp?.cost ?? ""), capacity: String(exp?.capacity ?? 12), imageUrl: exp?.imageUrl ?? "", active: exp?.active ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const price = parseFloat(d.price) || 0;
  const cost = parseFloat(d.cost) || 0;

  async function save() {
    if (!d.name.trim() || price <= 0) { setErr("Name and a price > 0 are required"); return; }
    const input: ExperienceUpsertInput = {
      name: d.name.trim(), description: d.description.trim(), pricePerHead: price, cost,
      capacity: Math.max(1, parseInt(d.capacity, 10) || 1), imageUrl: d.imageUrl.trim() || null, active: d.active,
    };
    setSaving(true); setErr(null);
    try {
      if (exp) await adminApi.updateExperience(exp.id, input);
      else await adminApi.createExperience(input);
      setOpen(false); onSaved();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  if (!open) {
    return (
      <button className="select-card" onClick={() => setOpen(true)}>
        <span className="spread"><strong>{exp ? exp.name : "+ New experience"}</strong>{exp && <span>£{exp.pricePerHead}/head</span>}</span>
        {exp && <span className="muted">Capacity {exp.capacity}{!exp.active ? " · hidden" : ""}</span>}
      </button>
    );
  }
  return (
    <div className="card editor">
      {err && <div className="notice danger">{err}</div>}
      <div className="field"><label>Name</label><input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
      <div className="field"><label>Description</label><textarea className="input" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></div>
      <div className="price-row">
        <div className="field"><label>Price per head (£)</label><input className="input big" inputMode="decimal" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} /></div>
        <div className="field"><label>Cost per head (£)</label><input className="input big" inputMode="decimal" value={d.cost} onChange={(e) => setD({ ...d, cost: e.target.value })} /></div>
      </div>
      <MarginMeter price={price} cost={cost} unit="per head" />
      <div className="field"><label>Capacity (guests / session)</label><input className="input" inputMode="numeric" value={d.capacity} onChange={(e) => setD({ ...d, capacity: e.target.value })} /></div>
      <ImageUpload value={d.imageUrl} onChange={(url) => setD({ ...d, imageUrl: url })} />
      <label className="toggle"><input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /><span>Active (bookable by customers)</span></label>
      <div className="nav-row">
        <button className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

function LocationRow({ location, onSaved }: { location: LocationT; onSaved: () => void }) {
  const [capacity, setCapacity] = useState(String(location.weeklyCapacity));
  const [active, setActive] = useState(location.active);
  const [saving, setSaving] = useState(false);
  const dirty = capacity !== String(location.weeklyCapacity) || active !== location.active;
  async function save() {
    setSaving(true);
    try { await adminApi.updateLocation(location.id, { weeklyCapacity: parseInt(capacity, 10) || 0, active }); onSaved(); } finally { setSaving(false); }
  }
  return (
    <div className="card loc-row">
      <div className="spread">
        <strong>{location.name}</strong>
        <label className="toggle inline"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> <span>Active</span></label>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <label className="muted">Orders / day</label>
        <input className="input cap" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        <button className="btn" style={{ width: "auto" }} onClick={save} disabled={!dirty || saving}>{saving ? "…" : "Save"}</button>
      </div>
    </div>
  );
}
