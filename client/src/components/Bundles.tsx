import { useEffect, useState } from "react";
import { api, type Bundle } from "../lib/api";
import { addBundleToCart } from "../lib/cart";
import { openCartDrawer, CART_CHANGED_EVENT } from "./CartDrawer";
import { gbp } from "../lib/format";
import { trackShoppingEvent } from "../lib/consent";

/* Ready-made combos: a board + the extras that go with it, filled into the basket in one tap.
 * Priced at the real total of the components (no fake discounts) — the win is convenience and
 * a complete spread. The section renders nothing until the owner has created a live bundle. */
export function Bundles() {
  const [bundles, setBundles] = useState<Bundle[] | null>(null);

  useEffect(() => {
    api.bundles().then(setBundles).catch(() => setBundles([]));
  }, []);

  if (!bundles || bundles.length === 0) return null;

  const add = (b: Bundle) => {
    trackShoppingEvent("bundle_added", { item_id: b.id, value: b.bundlePrice ?? b.total });
    addBundleToCart(b.items.map((it) => ({ kind: it.kind, refId: it.refId, quantity: it.quantity })));
    window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
    openCartDrawer();
  };

  return (
    <section className="bundles-section" data-reveal>
      <h2 className="section-h">Ready-made combos</h2>
      <p className="muted bundles-intro">Everything for the night, sorted in one tap.</p>
      <div className="bundle-grid">
        {bundles.map((b) => (
          <article className="bundle-card card" key={b.id}>
            {(b.imageUrl || b.items.find((i) => i.kind === "board")?.imageUrl) && (
              <img className="bundle-img" src={b.imageUrl || b.items.find((i) => i.kind === "board")!.imageUrl!} alt={b.name} width="640" height="480" loading="lazy" style={{ width: "100%", objectFit: "cover" }} />
            )}
            <div className="bundle-body">
              <h3 className="bundle-name">{b.name}</h3>
              {b.tagline && <p className="occasion-tag">{b.tagline}</p>}
              <ul className="bundle-items">
                {b.items.map((it, i) => (
                  <li key={i}>{it.quantity > 1 ? `${it.quantity}× ` : ""}{it.name}</li>
                ))}
              </ul>
              <div className="bundle-foot">
                <span className="bundle-price">{b.saving > 0 && <><del className="muted">{gbp(b.total)}</del> </>}{gbp(b.bundlePrice ?? b.total)}{b.saving > 0 && <small className="bundle-saving">Save {gbp(b.saving)}</small>}</span>
                <button className="btn" onClick={() => add(b)}>Add to basket</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
