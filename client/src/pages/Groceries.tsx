import { useEffect, useMemo, useState } from "react";
import { api, type GroceryProductT, type LocationT } from "../lib/api";
import { gbp } from "../lib/format";
import { Header } from "../components/Header";
import { usePageTitle } from "../lib/title";

// Display labels for GroceryProduct.department — free text in the DB (admin-managed,
// same convention as Platter.category), mapped here for presentation only.
const DEPARTMENT_LABELS: Record<string, string> = {
  sandwiches: "Sandwiches",
  salads: "Salads",
  salami: "Salami",
  meats: "Deli Meats",
  quiches: "Quiches",
  cheese: "Cheese",
  pies: "Pies",
  tubs: "Tubs & Dips",
  savoury: "Savoury Bakes",
  pantry: "Pantry",
  cakes: "Cakes & Sweet",
};

function departmentLabel(key: string): string {
  return DEPARTMENT_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export default function Groceries() {
  usePageTitle("Groceries");

  const [locations, setLocations] = useState<LocationT[]>([]);
  const [locationId, setLocationId] = useState("");
  const [products, setProducts] = useState<GroceryProductT[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.locations()
      .then((ls) => {
        setLocations(ls);
        if (ls[0]) setLocationId((prev) => prev || ls[0].id);
      })
      .catch(() => setLoadError("Couldn't load our shops. Please try again."));
  }, []);

  useEffect(() => {
    if (!locationId) return;
    setProducts(null);
    api.groceries.products(locationId).then(setProducts).catch(() => setProducts([]));
  }, [locationId]);

  const grouped = useMemo(() => {
    const map = new Map<string, GroceryProductT[]>();
    for (const p of products ?? []) {
      const list = map.get(p.department) ?? [];
      list.push(p);
      map.set(p.department, list);
    }
    return Array.from(map.entries());
  }, [products]);

  const selectedLocation = locations.find((l) => l.id === locationId) ?? null;

  return (
    <div className="app app-wide">
      <Header />

      <header
        className="cat-hero"
        style={{ backgroundImage: "url(https://images.unsplash.com/photo-1754391853150-561b59ad8e99?auto=format&fit=crop&w=1600&q=70)" }}
      >
        <div className="cat-hero-scrim">
          <h1 className="cat-hero-h">Groceries</h1>
          <p className="cat-hero-tag">Sandwiches, salads, pies, cheese and more — click &amp; collect</p>
        </div>
      </header>
      <p className="cat-desc">
        Everything from the deli counter, ready for click &amp; collect — minimum 24 hours' notice.
      </p>

      {loadError && <div className="notice danger">{loadError}</div>}

      {locations.length > 1 && (
        <label className="field">
          <span>Collection shop</span>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      )}

      {products === null && <p className="muted center">Loading our shop…</p>}

      {products !== null && grouped.length === 0 && (
        <p className="muted center" role="status">
          Our full shop range is on its way — check back soon{selectedLocation?.phone ? `, or call us on ${selectedLocation.phone}` : ""}.
        </p>
      )}

      {grouped.map(([department, items]) => (
        <section key={department} className="board-section" style={{ marginTop: 24 }}>
          <h2 className="section-h">{departmentLabel(department)}</h2>
          <div className="board-grid">
            {items.map((p) => (
              <article key={p.id} className="board-card card">
                <div className="deli-product-image">
                  {p.imageUrl
                    ? <img className="board-card-img" src={p.imageUrl} alt={p.name} width="640" height="480" loading="lazy" />
                    : <span className="deli-image-placeholder">Kelly’s Deli<br /><small>{p.name}</small></span>}
                </div>
                <div className="board-card-body">
                  <h3 className="board-card-name">{p.name}</h3>
                  {p.description && <p className="muted" style={{ marginTop: 4 }}>{p.description}</p>}
                  <p className="board-card-price">{gbp(p.price)}{p.unitLabel ? ` · ${p.unitLabel}` : ""}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {grouped.length > 0 && (
        <p className="muted footnote" style={{ marginTop: 24 }}>
          Ordering online is coming very soon. For now,{" "}
          {selectedLocation?.phone ? <>call {selectedLocation.name} on <a href={`tel:${selectedLocation.phone.replace(/\s+/g, "")}`}>{selectedLocation.phone}</a></> : "give us a call"}{" "}
          and we'll have it ready — minimum 24 hours' notice.
        </p>
      )}
    </div>
  );
}
