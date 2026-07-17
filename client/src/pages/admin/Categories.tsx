import { useEffect, useState } from "react";
import {
  adminApi,
  type AdminShopCategory,
  type CategoryUpsertInput,
  type AdminPlatter,
} from "../../lib/admin";

function blankCategory(): CategoryUpsertInput {
  return {
    slug: "",
    name: "",
    tagline: "",
    description: "",
    heroImageUrl: "",
    seoTitle: "",
    seoDescription: "",
    isCorporate: false,
    promotePlanner: false,
    active: true,
    sortOrder: 0,
  };
}

function toInput(c: AdminShopCategory): CategoryUpsertInput {
  return {
    slug: c.slug,
    name: c.name,
    tagline: c.tagline ?? "",
    description: c.description ?? "",
    heroImageUrl: c.heroImageUrl ?? "",
    seoTitle: c.seoTitle ?? "",
    seoDescription: c.seoDescription ?? "",
    isCorporate: c.isCorporate,
    promotePlanner: c.promotePlanner,
    active: c.active,
    sortOrder: c.sortOrder,
  };
}

interface EditState {
  id: string | null;
  draft: CategoryUpsertInput;
}

export default function Categories() {
  const [cats, setCats] = useState<AdminShopCategory[]>([]);
  const [platters, setPlatters] = useState<AdminPlatter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function refresh() {
    Promise.all([adminApi.categories(), adminApi.platters()])
      .then(([cs, ps]) => { setCats(cs); setPlatters(ps); setError(null); })
      .catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  const set = (patch: Partial<CategoryUpsertInput>) =>
    setEdit((s) => (s ? { ...s, draft: { ...s.draft, ...patch } } : s));

  return (
    <div>
      <h1>Occasion categories</h1>
      <p className="muted">
        These are the “browse by occasion” groups customers see in the shop (Hosting, At Home,
        Office &amp; Corporate…). Add or rename them, and choose which boards appear in each.
      </p>
      {error && <div className="notice danger">{error}</div>}

      {!edit && (
        <button className="btn" style={{ width: "auto", marginBottom: 16 }} onClick={() => setEdit({ id: null, draft: blankCategory() })}>
          + New category
        </button>
      )}

      {edit && (
        <CategoryForm
          edit={edit}
          set={set}
          onCancel={() => setEdit(null)}
          onSaved={(saved) => { setEdit({ id: saved.id, draft: toInput(saved) }); refresh(); }}
        />
      )}

      {edit?.id && (
        <BoardAssigner
          category={cats.find((c) => c.id === edit.id)}
          platters={platters}
          onSaved={refresh}
        />
      )}

      <div className="stack" style={{ marginTop: 18 }}>
        {cats.map((c) => (
          <div className="card loc-row" key={c.id}>
            <div className="spread">
              <div>
                <strong>{c.name}</strong>{" "}
                {c.isCorporate && <span className="pill">Corporate</span>}{" "}
                {c.promotePlanner && <span className="pill">Planner</span>}{" "}
                {!c.active && <span className="pill tag-off">Inactive</span>}
                <div className="muted">
                  /shop/{c.slug} · {c.boards.length} board{c.boards.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="nav-row" style={{ margin: 0 }}>
                <button className="btn-ghost" onClick={() => { setEdit({ id: c.id, draft: toInput(c) }); setConfirmId(null); }}>Edit</button>
                {confirmId === c.id ? (
                  <>
                    <button className="btn danger-btn" style={{ width: "auto" }} onClick={async () => {
                      try { await adminApi.deleteCategory(c.id); if (edit?.id === c.id) setEdit(null); refresh(); }
                      catch (e: any) { setError(e.message); }
                      finally { setConfirmId(null); }
                    }}>Really delete?</button>
                    <button className="btn-ghost" onClick={() => setConfirmId(null)}>No</button>
                  </>
                ) : (
                  <button className="btn-ghost" onClick={() => setConfirmId(c.id)}>Delete</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {cats.length === 0 && <p className="muted">No categories yet.</p>}
      </div>
    </div>
  );
}

function CategoryForm({
  edit, set, onCancel, onSaved,
}: {
  edit: EditState;
  set: (patch: Partial<CategoryUpsertInput>) => void;
  onCancel: () => void;
  onSaved: (saved: AdminShopCategory) => void;
}) {
  const { id, draft } = edit;
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null); setMsg(null);
    try {
      const input: CategoryUpsertInput = { ...draft, sortOrder: Number(draft.sortOrder) || 0 };
      const saved = id ? await adminApi.updateCategory(id, input) : await adminApi.createCategory(input);
      setMsg("Saved — live on the customer site now.");
      onSaved(saved);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="card editor">
      <h2 style={{ marginTop: 0 }}>{id ? "Edit category" : "New category"}</h2>
      {err && <div className="notice danger">{err}</div>}
      {msg && <div className="notice good">{msg}</div>}
      <div className="grid-2">
        <div className="field"><label>Name</label><input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></div>
        <div className="field">
          <label>Web address / slug</label>
          <input className="input" value={draft.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="office-corporate" />
          <p className="muted hint">lowercase words with hyphens, e.g. office-corporate</p>
        </div>
      </div>
      <div className="field"><label>Tagline</label><input className="input" value={draft.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} /></div>
      <div className="field"><label>Description</label><textarea className="input" value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></div>
      <div className="field"><label>Hero image URL</label><input className="input" value={draft.heroImageUrl ?? ""} onChange={(e) => set({ heroImageUrl: e.target.value })} /></div>
      <div className="field"><label>SEO title</label><input className="input" value={draft.seoTitle ?? ""} onChange={(e) => set({ seoTitle: e.target.value })} /></div>
      <div className="field"><label>SEO description</label><textarea className="input" value={draft.seoDescription ?? ""} onChange={(e) => set({ seoDescription: e.target.value })} /></div>
      <label className="toggle inline"><input type="checkbox" checked={!!draft.isCorporate} onChange={(e) => set({ isCorporate: e.target.checked })} /><span>Corporate category (shows enquiry form + invoicing copy)</span></label>
      <label className="toggle inline"><input type="checkbox" checked={!!draft.promotePlanner} onChange={(e) => set({ promotePlanner: e.target.checked })} /><span>Promote the event planner on this page</span></label>
      <label className="toggle inline"><input type="checkbox" checked={draft.active !== false} onChange={(e) => set({ active: e.target.checked })} /><span>Active</span></label>
      <div className="field" style={{ maxWidth: 160 }}><label>Sort order</label><input className="input" type="number" value={draft.sortOrder ?? 0} onChange={(e) => set({ sortOrder: parseInt(e.target.value, 10) || 0 })} /></div>
      <div className="nav-row">
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn" onClick={save} disabled={saving || !draft.name.trim() || !draft.slug.trim()}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

function BoardAssigner({
  category, platters, onSaved,
}: {
  category: AdminShopCategory | undefined;
  platters: AdminPlatter[];
  onSaved: () => void;
}) {
  const assignedKey = category ? category.boards.map((b) => b.id).join(",") : "";
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setChecked(new Set(category ? category.boards.map((b) => b.id) : []));
    setSaved(false);
  }, [category?.id, assignedKey]);

  if (!category) return null;

  function toggle(pid: string) {
    setSaved(false);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  }

  // Preserve the order boards appear in the platters list.
  const orderedIds = platters.filter((p) => checked.has(p.id)).map((p) => p.id);

  async function save() {
    setSaving(true); setErr(null);
    try { await adminApi.assignCategoryBoards(category!.id, orderedIds); setSaved(true); onSaved(); }
    catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="card editor">
      <h2 style={{ marginTop: 0 }}>Boards in “{category.name}”</h2>
      <p className="muted hint">Tick the boards that should appear in this category.</p>
      {err && <div className="notice danger">{err}</div>}
      <div className="stack" style={{ gap: 4 }}>
        {platters.map((p) => (
          <label className="toggle inline" key={p.id}>
            <input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} />
            <span>
              {p.name} · £{p.fixedPrice ?? p.pricePerHead ?? 0}
              {p.tier && <small className="muted"> · {p.tier === "signature" ? "signature" : "gallery"}</small>}
              {!p.active && <small className="muted"> (hidden)</small>}
            </span>
          </label>
        ))}
        {platters.length === 0 && <p className="muted">No boards to assign yet.</p>}
      </div>
      <div className="nav-row">
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save boards"}</button>
        {saved && <span className="pill good">Saved</span>}
      </div>
    </div>
  );
}
