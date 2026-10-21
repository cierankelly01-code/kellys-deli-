import { useEffect, useState } from "react";
import { api, type Bundle } from "../lib/api";
import { addBundleToCart } from "../lib/cart";
import { openCartDrawer, CART_CHANGED_EVENT } from "./CartDrawer";
import { gbp } from "../lib/format";
import { trackShoppingEvent } from "../lib/consent";
import { SectionHead } from "./site/SectionHead";
import { Ticket } from "./site/Ticket";

/* Ready-made combos: a board + the extras that go with it, filled into the basket in one tap.
 * Priced at the real total of the components (no fake discounts) — the win is convenience and
 * a complete spread. The section renders nothing until the owner has created a live bundle.
 * The photo is the owner's (or the lead board's); with neither, a plain counter-colour block. */
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
    <section className="bundles-section" aria-labelledby="bundles-h">
      <SectionHead id="bundles-h" title="Ready-made combos" intro="A board and the extras that go with it, added to your basket in one go." />
      <div className={`bundle-grid${bundles.length === 1 ? " is-single" : ""}`}>
        {bundles.map((b) => {
          const lead = b.items.find((i) => i.kind === "board");
          const img = b.imageUrl || lead?.imageUrl;
          return (
            <article className="bundle-card" key={b.id}>
              <div className="bundle-media">
                {img ? (
                  <img className="bundle-img" src={img} alt={b.name} width="640" height="480" loading="lazy" />
                ) : (
                  <span className="bundle-img bundle-blank" role="img" aria-label={b.name} />
                )}
                <Ticket price={gbp(b.bundlePrice ?? b.total)} unit={b.saving > 0 ? `Save ${gbp(b.saving)}` : null} />
              </div>
              <div className="bundle-body">
                <h3 className="bundle-name">{b.name}</h3>
                {b.tagline && <p className="bundle-tag">{b.tagline}</p>}
                <ul className="bundle-items">
                  {b.items.map((it, i) => (
                    <li key={i}>{it.quantity > 1 ? `${it.quantity}× ` : ""}{it.name}</li>
                  ))}
                </ul>
                <div className="bundle-foot">
                  {b.saving > 0 && <p className="bundle-price">Bought separately <del>{gbp(b.total)}</del></p>}
                  <button type="button" className="btn" onClick={() => add(b)}>Add to basket</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
