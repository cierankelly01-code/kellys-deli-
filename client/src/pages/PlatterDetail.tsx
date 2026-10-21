import { useEffect, useState } from "react";
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
import { pickerHeading } from "../lib/variants";
import { orderByLabel, orderingClosed } from "../lib/preorder";
import { ProductArt } from "../components/ProductArt";
import { CART_CHANGED_EVENT } from "../components/CartDrawer";
import { groupVariants } from "../lib/variants";

export default function PlatterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<PlatterWithVariants | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [subFreq, setSubFreq] = useState<SubscriptionFrequency | null>(null);
  // Which size/option is chosen. Each one is its own board, so this decides what gets added.
  const [chosenId, setChosenId] = useState<string | null>(null);
  // "Goes well with": other Christmas lines, only fetched for shop products.
  const [pairs, setPairs] = useState<Platter[]>([]);

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
    if (product?.category !== "shop") { setPairs([]); return; }
    let live = true;
    api.shopCategory("christmas").then((cat) => {
      if (!live) return;
      const mine = new Set([product.id, ...product.variants.map((v) => v.id)]);
      const others = groupVariants((cat.boards ?? []).filter((b) => !mine.has(b.id) && !orderingClosed(b))).map((g) => g.lead);
      // Prefer other sections (ham → cheese, pies, hampers) over more of the same.
      const sorted = [...others].sort((a, b) => Number(a.section === product.section) - Number(b.section === product.section));
      setPairs(sorted.slice(0, 3));
    }).catch(() => live && setPairs([]));
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
      <div className="app">
                <div className="notice danger">{error}</div>
        <Link className="btn btn-secondary" to="/platters">Back to boards</Link>
      </div>
    );
  }
  if (!platter) {
    return <div className="app"><p className="muted center">Loading…</p></div>;
  }

  const cleanDesc = platter.description.replace(/\s*\[CHECK PRICE.*?\]\s*$/i, "");
  const heroImage = platter.imageUrl ?? variants.find((v) => v.imageUrl)?.imageUrl ?? null;

  return (
    <div className="app app-wide">
            {platter.category === "shop"
        ? <Link to="/christmas" className="btn-ghost back">← Christmas menu</Link>
        : <Link to="/platters" className="btn-ghost back">← Back to boards</Link>}

      <div className="detail-grid">
        {/* Sizes often share one photo — fall back to any sibling's rather than showing a hole. */}
        {!heroImage && isProduct && (
          <div className="detail-photo-wrap"><ProductArt name={platter.name} section={platter.section} className="detail-art" /></div>
        )}
        {heroImage && (
          <div className="detail-photo-wrap">
            <div className="detail-photo arch vt-hero" style={{ backgroundImage: `url(${heroImage})` }} role="img" aria-label={platter.imageIllustrative ? `${platter.name} (illustrative image)` : platter.name} />
            {platter.imageIllustrative && <span className="illustrative-tag">Illustrative image — real photo coming soon</span>}
          </div>
        )}

        <div className="detail-buy">
          <div className="spread" style={{ marginTop: 18, alignItems: "flex-start" }}>
            <h1 style={{ margin: 0 }}>{platter.name}</h1>
            <div className="price">
              <strong>{gbp(platter.fixedPrice ?? platter.fromPrice)}</strong>
            </div>
          </div>
          {isProduct
            ? platter.unitLabel && <p className="serves">{platter.unitLabel}{platter.serves ? ` · serves ${platter.serves}` : ""}</p>
            : platter.serves && <p className="serves">Feeds {platter.serves}</p>}
          {platter.orderBy && <p className={`xmas-orderby${closed ? " closed" : ""}`}>{closed ? "Orders for this have closed" : orderByLabel(platter.orderBy)}</p>}

          <p className="detail-desc">{cleanDesc}</p>

          {variants.length > 1 && (
            <fieldset className="size-picker">
              <legend className="size-picker-legend">{pickerHeading(variants)}</legend>
              <div className="size-options">
                {variants.map((v) => (
                  <label key={v.id} className={`size-option${v.id === platter.id ? " is-selected" : ""}`}>
                    <input
                      type="radio"
                      name="board-size"
                      value={v.id}
                      checked={v.id === platter.id}
                      onChange={() => choose(v)}
                    />
                    <span className="size-option-label">{v.variantLabel ?? v.name}</span>
                    {/* Owners naturally write "Large — feeds 12-15", so only add the feeds line
                        when the label hasn't already said it. */}
                    {!isProduct && v.serves && !(v.variantLabel ?? "").includes(v.serves) && (
                      <span className="size-option-serves">Feeds {v.serves}</span>
                    )}
                    <span className="size-option-price">{gbp(v.fixedPrice ?? v.fromPrice)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {subOn && (
            <SubscribeSave value={subFreq} onChange={setSubFreq} discountPct={subPct} />
          )}

          <button className="btn" onClick={order} disabled={closed}>
            {closed ? "Orders closed" : effSub
              ? `Start a subscription — ${gbp(subPrice)} / board`
              : `Add & continue — ${gbp(platter.fixedPrice ?? platter.fromPrice)}`}
          </button>
          <p className="buy-reassure">
            {effSub
              ? paymentsLive
                ? "25% deposit for your first board today — we'll set your schedule up with you and confirm each board."
                : "No card taken now — we'll set your schedule up with you and confirm each board."
              : platter.payInFull
                ? "Paid at checkout · set aside with your name on it · pick your collection day"
                : "Only 25% today · balance on collection · fully refundable up to 48 hrs before"}
          </p>

          {!isProduct && (
            <>
              <p className="prebook-hint muted">
                🎂 <strong>Planning ahead?</strong> Pick a future date at checkout to book this for a birthday or celebration —
                25% locks it in, and you can add a gift note.
              </p>
              <DeadlineChip />
            </>
          )}

          {platter.items.length > 0 && (
            <>
              <h2 className="detail-h2">What&apos;s inside</h2>
              <ul className="detail-items">
                {platter.items.map((it) => <li key={it.label}>{it.label}</li>)}
              </ul>
            </>
          )}

          {/* The deposit/refund chips describe catering boards, not paid-in-full pre-orders. */}
          {!isProduct && <TrustChips />}
          <DeliVideos productId={platter.id} />
          {isProduct && (
            <section className="preorder-how" aria-label="How pre-ordering works">
              <h2>How it works</h2>
              <ol>
                <li>Add it to your basket and pick any collection day{platter.collectTo ? " up to " + new Date(`${platter.collectTo}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : ""}.</li>
                <li>{platter.payInFull ? "Pay securely online — it's then set aside with your name on it." : "Pay the 25% deposit to lock it in."}</li>
                <li>Pop in on the day, give your name, and it&apos;s ready.</li>
              </ol>
            </section>
          )}

          {pairs.length > 0 && (
            <section className="pairs">
              <h2 className="detail-h2">Goes well with</h2>
              <div className="pairs-grid">
                {pairs.map((p) => (
                  <Link key={p.id} to={`/platter/${p.id}`} className="pairs-card">
                    {p.imageUrl
                      ? <div className="pairs-img" style={{ backgroundImage: `url(${p.imageUrl})` }} role="img" aria-label={p.name} />
                      : <ProductArt name={p.name} section={p.section} />}
                    <span>{p.name}</span>
                    <span className="muted">{gbp(p.fixedPrice ?? p.fromPrice ?? 0)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {isProduct ? (
            <p className="muted footnote">
              Allergies or a question about this? Add a note when you order or ring the shop — we&apos;ll sort it.
            </p>
          ) : <p className="muted footnote">
            Allergies or dietary needs? Every board can be adapted — tell us in the notes when you order and
            we&apos;ll confirm with you directly. Extras like plates, cutlery and napkins are offered at the
            next step, sized to your numbers.
          </p>}
        </div>
      </div>
    </div>
  );
}
