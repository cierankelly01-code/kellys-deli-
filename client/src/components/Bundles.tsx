import { useEffect, useState } from "react";
import { api, type Bundle } from "../lib/api";
import { addBundleToCart } from "../lib/cart";
import { openCartDrawer, CART_CHANGED_EVENT } from "./CartDrawer";
import { gbp } from "../lib/format";

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
            {b.imageUrl && (
              <div className="bundle-img" style={{ backgroundImage: `url(${b.imageUrl})` }} role="img" aria-label={b.name} />
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
                <span className="bundle-price">{gbp(b.total)}</span>
                <button className="btn" onClick={() => add(b)}>Add to basket</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
