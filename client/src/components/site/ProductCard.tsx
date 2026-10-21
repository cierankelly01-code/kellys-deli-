import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addBoard } from "../../lib/cart";
import { CART_CHANGED_EVENT, openCartDrawer } from "../CartDrawer";
import { gbp } from "../../lib/format";
import { groupServes, type ProductGroup } from "../../lib/variants";
import { orderByLabel, orderingClosed } from "../../lib/preorder";
import { morphNavigate } from "../../lib/motion";
import { ProductArt } from "../ProductArt";

/**
 * The one product tile used across the site (home, collections, Christmas, search-style
 * grids). Contract the e2e suite relies on: the root is `.board-card`, the image carries
 * `.board-card-img` with an accessible name, grouped sizes show a "Choose a size" button,
 * single items show "Details", and catering prices read "From £X · feeds N".
 */
export function priceLine(g: ProductGroup): string {
  const p = g.lead;
  const price = g.hasChoice ? `From ${gbp(g.fromPrice)}` : gbp(p.fixedPrice ?? p.fromPrice ?? 0);
  if (p.kind === "product") return !g.hasChoice && p.unitLabel ? `${price} · ${p.unitLabel}` : price;
  const serves = groupServes(g.variants);
  return serves ? `${price} · feeds ${serves}` : price;
}

export function ProductCard({
  group,
  suffix = "",
  eyebrow,
  showDescription = false,
  className = "",
}: {
  group: ProductGroup;
  suffix?: string; // carried query string, e.g. "?src=qr"
  eyebrow?: string | null;
  showDescription?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);
  const p = group.lead;
  const href = `/platter/${p.id}${suffix}`;
  const closed = group.variants.every((v) => orderingClosed(v));
  const deadline = p.orderBy ? orderByLabel(p.orderBy) : null;

  const toDetail = (e: React.MouseEvent<HTMLElement>) =>
    morphNavigate(navigate, href, e.currentTarget.closest("article")?.querySelector(".board-card-img") as HTMLElement | null);

  const add = () => {
    addBoard(p.id);
    window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
    openCartDrawer();
  };

  return (
    <article className={`board-card pcard${closed ? " is-closed" : ""}${className ? ` ${className}` : ""}`}>
      <Link to={href} className="pcard-media" aria-label={`View ${p.name}`} tabIndex={-1}>
        {p.imageUrl ? (
          <img className="board-card-img" src={p.imageUrl} alt={p.imageIllustrative ? `${p.name} (illustrative image)` : p.name} width="640" height="480" loading="lazy" />
        ) : (
          <ProductArt name={p.name} section={p.section ?? (p.kind === "product" ? null : "board")} className="board-card-img" />
        )}
        {p.imageIllustrative && p.imageUrl && <span className="illustrative-tag">Illustrative image</span>}
      </Link>
      <div className="pcard-body">
        {eyebrow && <p className="pcard-eyebrow">{eyebrow}</p>}
        <h3 className="pcard-name board-card-name"><Link to={href}>{p.name}</Link></h3>
        <p className="pcard-price board-card-price">{priceLine(group)}</p>
        {showDescription && <p className="pcard-desc">{p.description.replace(/\s*\[CHECK PRICE.*?\]\s*$/i, "")}</p>}
        {deadline && <p className={`pcard-deadline${closed ? " closed" : ""}`}>{closed ? "Orders closed" : deadline}</p>}
        <div className="pcard-actions board-card-actions">
          {closed ? (
            <button type="button" className="btn" disabled>Orders closed</button>
          ) : group.hasChoice ? (
            <button type="button" className="btn btn-secondary" onClick={toDetail}>Choose a size</button>
          ) : (
            <>
              <button type="button" className={`btn btn-secondary${added ? " is-added" : ""}`} onClick={add}>
                {added ? "Added ✓" : "Add to basket"}
              </button>
              <button type="button" className="pcard-details" onClick={toDetail}>Details</button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
