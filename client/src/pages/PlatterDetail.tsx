import { useEffect, useRef, useState } from "react";
import { DeliVideos } from "../components/DeliVideos";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api, type Platter, type PlatterWithVariants, type CategoryCounts, type SubscriptionFrequency } from "../lib/api";
import { addBoard, loadCart, saveCart, emptyCart } from "../lib/cart";
import { openCartDrawer } from "../components/CartDrawer";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { DeadlineChip, TrustChips } from "../components/Trust";
import { SubscribeSave } from "../components/SubscribeSave";
import { trackViewContent } from "../lib/consent";
import { pickerHeading, groupVariants, type ProductGroup } from "../lib/variants";
import { orderByLabel, orderingClosed, shortDate } from "../lib/preorder";
import { CART_CHANGED_EVENT } from "../components/CartDrawer";
import { Breadcrumbs, type Crumb } from "../components/site/PageHero";
import { ProductCard } from "../components/site/ProductCard";
import { SectionHead } from "../components/site/SectionHead";
import { Ticket, sentence } from "../components/site/Ticket";

/** Which part of the shop a product belongs to — drives the breadcrumb and pairings. */
function departmentOf(p: Platter): { label: string; to: string; eyebrow: string } {
  if (p.category === "shop") return { label: "Christmas", to: "/christmas", eyebrow: p.section ?? "Christmas" };
  if (p.category === "home") return { label: "Boards for a night in", to: "/shop/at-home", eyebrow: "A board for tonight" };
  return { label: "Boards & platters", to: "/platters", eyebrow: "Boards & platters" };
}

const priceOf = (p: Platter) => p.fixedPrice ?? p.fromPrice ?? 0;

export default function PlatterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<PlatterWithVariants | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [subFreq, setSubFreq] = useState<SubscriptionFrequency | null>(null);
  // Which size/option is chosen. Each one is its own board, so this decides what gets added.
  const [chosenId, setChosenId] = useState<string | null>(null);
  // "Goes well with": other Christmas lines for pre-order products, other boards for boards.
  const [pairs, setPairs] = useState<ProductGroup[]>([]);
  // Phone-only buy bar, shown once the main button has scrolled up out of view.
  const [showBar, setShowBar] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);

  const variants = product?.variants ?? [];
  const platter: Platter | null =
    variants.find((v) => v.id === chosenId) ?? product ?? null;
  usePageTitle(platter?.name);

  useEffect(() => {
    if (!id) return;
    api.platter(id).then((p) => { setProduct(p); setChosenId(p.id); }).catch((e) => setError(e.message));
    api.categories().then(setCounts).catch(() => setCounts(null));
    // Pre-select any subscription choice already in the cart.
    setSubFreq(loadCart()?.subscription?.frequency ?? null);
  }, [id]);

  useEffect(() => {
    if (!product) { setPairs([]); return; }
    let live = true;
    const mine = new Set([product.id, ...(product.variants ?? []).map((v) => v.id)]);
    if (product.category === "shop") {
      api.shopCategory("christmas").then((cat) => {
        if (!live) return;
        const others = groupVariants((cat?.boards ?? []).filter((b) => !mine.has(b.id) && !orderingClosed(b)));
        // Prefer other sections (ham → cheese, pies, hampers) over more of the same.
        // Prefer other sections (ham → cheese, pies, hampers) over more of the same, and take
        // one from each section in turn so the four picks make a fuller table.
        const bySection = new Map<string, ProductGroup[]>();
        for (const g of others) {
          const key = g.lead.section ?? "";
          if (key === (product.section ?? "")) continue;
          bySection.set(key, [...(bySection.get(key) ?? []), g]);
        }
        const picks: ProductGroup[] = [];
        const queues = Array.from(bySection.values());
        for (let round = 0; picks.length < 4 && queues.some((q) => q.length > round); round++) {
          for (const q of queues) if (q[round] && picks.length < 4) picks.push(q[round]);
        }
        if (picks.length < 4) picks.push(...others.filter((g) => !picks.includes(g)).slice(0, 4 - picks.length));
        setPairs(picks);
      }).catch(() => live && setPairs([]));
    } else {
      // Boards: the owner's other boards — same shelf first (at-home with at-home), best-loved first.
      api.platters().then((all) => {
        if (!live || !Array.isArray(all)) return;
        const boards = all.filter((b) => b && b.kind !== "product" && b.active !== false && (b.category === "board" || b.category === "home") && !mine.has(b.id) && !orderingClosed(b));
        const groups = groupVariants(boards).filter((g) => !g.variants.some((v) => mine.has(v.id)));
        const sorted = [...groups].sort((a, b) =>
          Number(b.lead.category === product.category) - Number(a.lead.category === product.category)
          || (b.lead.recommendPriority ?? 0) - (a.lead.recommendPriority ?? 0));
        setPairs(sorted.slice(0, 4));
      }).catch(() => live && setPairs([]));
    }
    return () => { live = false; };
  }, [product]);

  // Switching size swaps the URL too, so a refresh or a shared link keeps the choice.
  // `replace` keeps the back button pointing at the shop rather than at each size tried.
  const choose = (v: Platter) => {
    setChosenId(v.id);
    navigate(`/platter/${v.id}`, { replace: true });
  };

  // Per-board Product structured data — Google rich results + something concrete for
  // AI answer engines to cite. Injected when the board loads, removed on unmount.
  useEffect(() => {
    if (!platter) return;
    const price = platter.fixedPrice ?? platter.fromPrice ?? 0;
    // Retargeting signal — no-ops without consent. Fires once per board view.
    trackViewContent({ id: platter.id, name: platter.name, value: price || undefined });
    const data: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: platter.name,
      description: platter.description.replace(/\s*\[CHECK PRICE.*?\]\s*$/i, ""),
      brand: { "@type": "Brand", name: "Kelly's Deli" },
      offers: {
        "@type": "Offer",
        priceCurrency: "GBP",
        price: String(price),
        availability: platter.kind === "product" ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
        url: window.location.href,
        seller: { "@type": "Organization", name: "Kelly's Deli" },
      },
    };
    if (platter.imageUrl) data.image = platter.imageUrl;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.text = JSON.stringify(data);
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, [platter]);

  // Watch the main button: once it has scrolled up and away, offer the phone buy bar.
  const loaded = !!platter;
  useEffect(() => {
    if (!loaded) return;
    const check = () => {
      const el = addRef.current;
      setShowBar(!!el && el.getBoundingClientRect().bottom < 0);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [loaded]);

  const order = () => {
    if (!platter) return;
    // Persist the Subscribe & Save choice onto the cart so it carries into checkout.
    // Pre-order products (hams, Christmas lines) can't be subscribed to, so they leave
    // whatever the basket already says alone.
    if (platter.kind !== "product") {
      const cart = loadCart() ?? emptyCart();
      if (subFreq) cart.subscription = { frequency: subFreq };
      else delete cart.subscription;
      saveCart(cart);
    }
    addBoard(platter.id);
    window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
    openCartDrawer();
  };

  const isProduct = platter?.kind === "product";
  const closed = !!platter && orderingClosed(platter);
  const subOn = counts?.subscribeSave !== false && !isProduct;
  // A subscription carried over from the basket never applies to a pre-order product.
  const effSub = isProduct ? null : subFreq;
  const paymentsLive = counts?.paymentsLive === true;
  const subPct = counts?.subscribeSaveDiscountPct ?? 10;
  const price = platter?.fixedPrice ?? platter?.fromPrice ?? 0;
  const subPrice = Math.round(price * (1 - subPct / 100) * 100) / 100;

  if (error) {
    return (
      <div className="pdp">
        <div className="wrap pdp-state">
          <h1 className="pdp-state-h">We couldn&apos;t find that one.</h1>
          <p className="pdp-state-p">{error}</p>
          <Link className="btn btn-secondary" to="/platters">Back to boards</Link>
        </div>
      </div>
    );
  }
  if (!platter) {
    return <div className="pdp"><div className="wrap pdp-state"><p className="muted" role="status">Loading…</p></div></div>;
  }

  const dept = departmentOf(platter);
  const cleanDesc = platter.description.replace(/\s*\[CHECK PRICE.*?\]\s*$/i, "");
  // Sizes often share one photo — fall back to any sibling's rather than showing a hole.
  const heroImage = platter.imageUrl ?? variants.find((v) => v.imageUrl)?.imageUrl ?? null;
  const illustrative = heroImage ? (platter.imageUrl ? platter.imageIllustrative : variants.find((v) => v.imageUrl)?.imageIllustrative) : false;
  const hasSizes = variants.length > 1;
  const fromPrice = hasSizes ? Math.min(...variants.map(priceOf)) : price;
  const unitLine = isProduct
    ? [platter.unitLabel ? sentence(platter.unitLabel) : null, platter.serves ? `serves ${platter.serves}` : null].filter(Boolean).join(", ")
    : platter.serves ? `Feeds ${platter.serves}` : "";
  const deadline = platter.orderBy ? orderByLabel(platter.orderBy) : null;
  const nice = (d: string) => shortDate(new Date(`${d}T12:00:00Z`));
  const collectSpan = !isProduct ? null
    : platter.collectFrom && platter.collectTo ? `Collect ${nice(platter.collectFrom)} – ${nice(platter.collectTo)}`
    : platter.collectFrom ? `Collect from ${nice(platter.collectFrom)}`
    : platter.collectTo ? `Collect by ${nice(platter.collectTo)}` : null;
  const leadHours = platter.leadTimeHours ?? 48;
  const crumbs: Crumb[] = [{ to: "/", label: "Home" }, { to: dept.to, label: dept.label }, { label: platter.name }];
  const buyLabel = closed ? "Orders closed" : effSub
    ? `Start a subscription — ${gbp(subPrice)} / board`
    : `Add & continue — ${gbp(platter.fixedPrice ?? platter.fromPrice)}`;

  return (
    <div className={`pdp${isProduct ? " is-preorder" : " is-board"}${showBar ? " has-bar" : ""}`}>
      <div className="wrap">
        <div className="pdp-crumbrow">
          <Breadcrumbs items={crumbs} />
          {platter.category === "shop"
            ? <Link to="/christmas" className="pdp-back">Back to the Christmas menu</Link>
            : <Link to="/platters" className="pdp-back">Back to all boards</Link>}
        </div>

        <div className="pdp-main">
          <div className="pdp-media">
            <figure className="pdp-frame">
              {heroImage ? (
                <img className="pdp-photo vt-hero" src={heroImage} alt={illustrative ? `${platter.name} (illustrative photo)` : platter.name} width="1000" height="1250" />
              ) : (
                <span className="pdp-blank vt-hero" role="img" aria-label={platter.name} />
              )}
              {heroImage && illustrative && <figcaption className="illustrative-tag">Illustrative photo</figcaption>}
            </figure>
          </div>

          <div className="pdp-buy">
            <h1 className="pdp-title">{platter.name}</h1>

            <div className="pdp-pricebar">
              <Ticket
                large
                price={gbp(price)}
                unit={isProduct ? (platter.unitLabel ? sentence(platter.unitLabel) : null) : platter.serves ? `Feeds ${platter.serves}` : null}
                note={isProduct && platter.serves ? `Serves ${platter.serves}` : null}
              />
              {hasSizes && <p className="pdp-price-from">{variants.length} {pickerHeading(variants) === "Choose your size" ? "sizes" : "options"}, from {gbp(fromPrice)}</p>}
            </div>

            {deadline && (
              <p className={`pdp-orderby${closed ? " is-closed" : ""}`}>
                {closed ? "Orders for this have closed" : <strong>{deadline}</strong>}
              </p>
            )}

            <p className="pdp-desc">{cleanDesc}</p>

            {hasSizes && (
              <fieldset className="pdp-sizes size-picker">
                <legend className="pdp-sizes-legend">{pickerHeading(variants)}</legend>
                <div className="pdp-size-list">
                  {variants.map((v) => (
                    <label key={v.id} className={`pdp-size${v.id === platter.id ? " is-selected" : ""}`}>
                      <input
                        type="radio"
                        name="board-size"
                        value={v.id}
                        checked={v.id === platter.id}
                        onChange={() => choose(v)}
                      />
                      <span className="pdp-size-dot" aria-hidden="true" />
                      <span className="pdp-size-text">
                        <span className="pdp-size-label">{v.variantLabel ?? v.name}</span>
                        {/* Owners naturally write "Large — feeds 12-15", so only add the feeds line
                            when the label hasn't already said it. */}
                        {!isProduct && v.serves && !(v.variantLabel ?? "").includes(v.serves) && (
                          <span className="pdp-size-sub">Feeds {v.serves}</span>
                        )}
                        {isProduct && v.serves && <span className="pdp-size-sub">Serves {v.serves}</span>}
                      </span>
                      <span className="pdp-size-price">{gbp(v.fixedPrice ?? v.fromPrice)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {subOn && (
              <SubscribeSave value={subFreq} onChange={setSubFreq} discountPct={subPct} />
            )}

            <button ref={addRef} className="btn pdp-add" onClick={order} disabled={closed}>
              {buyLabel}
            </button>
            <p className="pdp-reassure">
              {effSub
                ? paymentsLive
                  ? "25% deposit for your first board today — we'll set your schedule up with you and confirm each board."
                  : "No card taken now — we'll set your schedule up with you and confirm each board."
                : platter.payInFull
                  ? "Paid at checkout and set aside with your name on it. You pick the collection day."
                  : "Pay 25% today and the rest when you collect. Fully refundable up to 48 hours before."}
            </p>

            {isProduct && !closed && (
              <ul className="pdp-assure pdp-assure-list" aria-label="Pre-order details">
                {collectSpan && <li>{collectSpan}</li>}
                <li>{platter.payInFull ? "Paid in full when you order" : "25% deposit, balance on collection"}</li>
                <li>Set aside with your name on it</li>
              </ul>
            )}

            {!isProduct && (
              <div className="pdp-assure">
                <DeadlineChip />
                {/* The deposit/refund chips describe catering boards, not paid-in-full pre-orders. */}
                <TrustChips />
                <p className="pdp-prebook">
                  <strong>Planning ahead?</strong> Pick a future date at checkout to book this for a birthday or celebration —
                  25% locks it in, and you can add a gift note.
                </p>
              </div>
            )}
          </div>
        </div>

        <section className="pdp-details" aria-labelledby="pdp-details-h">
          <div className="pdp-details-head">
            <h2 id="pdp-details-h" className="pdp-details-title">Good to know</h2>
          </div>
          <div className="pdp-acc">
            <details className="pdp-acc-item" open>
              <summary>What&apos;s inside</summary>
              <div className="pdp-acc-body">
                {platter.items.length > 0 ? (
                  <ul className="pdp-items">
                    {platter.items.map((it) => <li key={it.label}>{it.label}</li>)}
                  </ul>
                ) : (
                  <p>{cleanDesc}</p>
                )}
                {unitLine && <p className="pdp-acc-note"><span className="pdp-k">{isProduct ? "Each" : "Size"}</span>{unitLine}</p>}
                {platter.items.length === 0 && !isProduct && <p className="muted">Want to know exactly what goes on this board? Ask us — we&apos;re happy to talk you through it.</p>}
              </div>
            </details>

            <details className="pdp-acc-item">
              <summary>Collection &amp; payment</summary>
              <div className="pdp-acc-body">
                {isProduct ? (
                  <section className="preorder-how" aria-label="How pre-ordering works">
                    <ol className="pdp-steps">
                      <li>Add it to your basket and pick any collection day{platter.collectTo ? " up to " + new Date(`${platter.collectTo}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : ""}.</li>
                      <li>{platter.payInFull ? "Pay securely online — it's then set aside with your name on it." : "Pay the 25% deposit to lock it in."}</li>
                      <li>Pop in on the day, give your name, and it&apos;s ready.</li>
                    </ol>
                    <dl className="pdp-facts">
                      {deadline && <div><dt>Order by</dt><dd>{closed ? "Orders have closed" : deadline.replace(/^Order by /, "")}</dd></div>}
                      {collectSpan && <div><dt>Collection</dt><dd>{collectSpan.replace(/^Collect /, "")}</dd></div>}
                      <div><dt>Payment</dt><dd>{platter.payInFull ? "Paid in full when you order" : "25% deposit today, balance on collection"}</dd></div>
                    </dl>
                  </section>
                ) : (
                  <>
                    <ol className="pdp-steps">
                      <li>Add it to your basket, then choose your collection day — any day from {leadHours} hours&apos; time, or months ahead for a birthday or celebration.</li>
                      <li>{platter.payInFull ? "Pay in full at checkout — it's then set aside with your name on it." : "Pay a 25% deposit to confirm. The balance is paid when you collect."}</li>
                      <li>Collect it from the deli on the day, ready for the table.</li>
                    </ol>
                    <dl className="pdp-facts">
                      <div><dt>Notice</dt><dd>{leadHours} hours</dd></div>
                      <div><dt>Payment</dt><dd>{platter.payInFull ? "Paid in full when you order" : "25% deposit, balance on collection"}</dd></div>
                      {!platter.payInFull && <div><dt>Changes</dt><dd>Deposit fully refundable up to 48 hours before collection</dd></div>}
                      <div><dt>Extras</dt><dd>Plates, cutlery and napkins are offered at the next step, sized to your numbers</dd></div>
                    </dl>
                  </>
                )}
              </div>
            </details>

            <details className="pdp-acc-item">
              <summary>Allergens &amp; dietary</summary>
              <div className="pdp-acc-body">
                {isProduct ? (
                  <p>Allergies or a question about this? Add a note when you order or ring the shop — we&apos;ll sort it.</p>
                ) : (
                  <p>Allergies or dietary needs? Every board can be adapted — tell us in the notes when you order and
                    we&apos;ll confirm with you directly.</p>
                )}
                <p className="muted">We don&apos;t list full allergen information online, so please ask us before you order if anyone at the table has an allergy — we&apos;ll tell you exactly what&apos;s in it.</p>
              </div>
            </details>
          </div>
        </section>

        <DeliVideos productId={platter.id} />
      </div>

      {pairs.length > 0 && (
        <section className="section is-paper pdp-pairs" aria-labelledby="pdp-pairs-h">
          <div className="wrap">
            <SectionHead
              id="pdp-pairs-h"
              title="Goes well with"
              action={isProduct ? { to: "/christmas", label: "The full Christmas menu" } : { to: "/platters", label: "See every board" }}
              align="left"
            />
            <div className="pgrid is-4">
              {pairs.map((g) => <ProductCard key={g.lead.id} group={g} />)}
            </div>
          </div>
        </section>
      )}

      {showBar && (
        <div className="pdp-bar" role="region" aria-label="Add to basket">
          <div className="pdp-bar-info">
            <span className="pdp-bar-name">{platter.name}</span>
            <span className="pdp-bar-sub">{platter.variantLabel ?? unitLine}</span>
          </div>
          <button type="button" className="btn pdp-bar-btn" onClick={order} disabled={closed}>
            {closed ? "Closed" : effSub ? `Subscribe for ${gbp(subPrice)}` : `Add for ${gbp(price)}`}
          </button>
        </div>
      )}
    </div>
  );
}
