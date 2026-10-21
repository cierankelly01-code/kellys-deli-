import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addBoard } from "../../lib/cart";
import { CART_CHANGED_EVENT, openCartDrawer } from "../CartDrawer";
import { gbp } from "../../lib/format";
import { groupServes, pickerHeading, type ProductGroup } from "../../lib/variants";
import { orderByLabel, orderingClosed } from "../../lib/preorder";
import { morphNavigate } from "../../lib/motion";
import { Ticket, sentence } from "./Ticket";

/**
 * The one product tile used across the site (home, collections, Christmas, search-style
 * grids). Contract the e2e suite relies on: the root is `.board-card`, the image carries
 * `.board-card-img` with an accessible name (aria-label), grouped sizes show a "Choose a
 * size" button, single items show "Details", and catering prices read "From £X … feeds N".
 *
 * The photo leads (4:5, square corners); the price sits on a counter ticket over its
 * bottom-left corner. No photo yet: a plain counter-colour block, never a drawing.
 */
export function priceLine(g: ProductGroup): string {
  const p = g.lead;
  const price = g.hasChoice ? `From ${gbp(g.fromPrice)}` : gbp(p.fixedPrice ?? p.fromPrice ?? 0);
  if (p.kind === "product") return !g.hasChoice && p.unitLabel ? `${price} · ${p.unitLabel}` : price;
  const serves = groupServes(g.variants);
  return serves ? `${price} · feeds ${serves}` : price;
}

/** What the ticket says under the price: "Half ham, approx 2.5kg", "3 sizes, feeds 4-15". */
export function ticketUnit(g: ProductGroup): string | null {
  const p = g.lead;
  const serves = groupServes(g.variants);
  const verb = p.kind === "product" ? "serves" : "feeds";
  if (g.hasChoice) {
    const kinds = `${g.variants.length} ${pickerHeading(g.variants) === "Choose your size" ? "sizes" : "options"}`;
    return serves ? `${kinds}, ${verb} ${serves}` : kinds;
  }
  if (p.kind === "product" && p.unitLabel) return sentence(p.unitLabel);
  return serves ? sentence(`${verb} ${serves}`) : null;
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
  const imgName = p.imageIllustrative ? `${p.name} (illustrative photo)` : p.name;

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
      <div className="pcard-photo">
        <Link to={href} className="pcard-media" aria-label={`View ${p.name}`} tabIndex={-1}>
          {p.imageUrl ? (
            <img className="board-card-img" src={p.imageUrl} alt={imgName} aria-label={imgName} width="640" height="800" loading="lazy" />
          ) : (
            <span className="board-card-img pcard-blank" role="img" aria-label={p.name} />
          )}
          {p.imageIllustrative && p.imageUrl && <span className="illustrative-tag">Illustrative photo</span>}
        </Link>
        <Ticket
          className="board-card-price"
          from={group.hasChoice}
          price={group.hasChoice ? gbp(group.fromPrice) : gbp(p.fixedPrice ?? p.fromPrice ?? 0)}
          unit={ticketUnit(group)}
        />
      </div>
      <div className="pcard-body">
        {eyebrow && <p className="pcard-eyebrow">{eyebrow}</p>}
        <h3 className="pcard-name board-card-name"><Link to={href}>{p.name}</Link></h3>
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
                {added ? "Added" : "Add to basket"}
              </button>
              <button type="button" className="pcard-details" onClick={toDetail}>Details</button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
