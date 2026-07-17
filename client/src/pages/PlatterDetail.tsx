import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Platter, type CategoryCounts, type SubscriptionFrequency } from "../lib/api";
import { addBoard, loadCart, saveCart, emptyCart } from "../lib/cart";
import { openCartDrawer } from "../components/CartDrawer";
import { gbp } from "../lib/format";
import { Header } from "../components/Header";
import { usePageTitle } from "../lib/title";
import { DeadlineChip, TrustChips } from "../components/Trust";
import { SubscribeSave } from "../components/SubscribeSave";

export default function PlatterDetail() {
  const { id } = useParams();
  const [platter, setPlatter] = useState<Platter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [subFreq, setSubFreq] = useState<SubscriptionFrequency | null>(null);
  usePageTitle(platter?.name);

  useEffect(() => {
    if (!id) return;
    api.platter(id).then(setPlatter).catch((e) => setError(e.message));
    api.categories().then(setCounts).catch(() => setCounts(null));
    // Pre-select any subscription choice already in the cart.
    setSubFreq(loadCart()?.subscription?.frequency ?? null);
  }, [id]);

  // Per-board Product structured data — Google rich results + something concrete for
  // AI answer engines to cite. Injected when the board loads, removed on unmount.
  useEffect(() => {
    if (!platter) return;
    const price = platter.fixedPrice ?? platter.fromPrice ?? 0;
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
        availability: "https://schema.org/InStock",
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
    const cart = loadCart() ?? emptyCart();
    if (subFreq) cart.subscription = { frequency: subFreq };
    else delete cart.subscription;
    saveCart(cart);
    addBoard(platter.id);
    openCartDrawer();
  };

  const subOn = counts?.subscribeSave !== false;
  const subPct = counts?.subscribeSaveDiscountPct ?? 10;
  const price = platter?.fixedPrice ?? platter?.fromPrice ?? 0;
  const subPrice = Math.round(price * (1 - subPct / 100) * 100) / 100;

  if (error) {
    return (
      <div className="app">
        <Header />
        <div className="notice danger">{error}</div>
        <Link className="btn btn-secondary" to="/platters">Back to boards</Link>
      </div>
    );
  }
  if (!platter) {
    return <div className="app"><Header /><p className="muted center">Loading…</p></div>;
  }

  const cleanDesc = platter.description.replace(/\s*\[CHECK PRICE.*?\]\s*$/i, "");

  return (
    <div className="app app-wide">
      <Header />
      <Link to="/platters" className="btn-ghost back">← Back to boards</Link>

      <div className="detail-grid">
        {platter.imageUrl && <div className="detail-photo arch vt-hero" style={{ backgroundImage: `url(${platter.imageUrl})` }} role="img" aria-label={platter.name} />}

        <div className="detail-buy">
          <div className="spread" style={{ marginTop: 18, alignItems: "flex-start" }}>
            <h1 style={{ margin: 0 }}>{platter.name}</h1>
            <div className="price">
              <strong>{gbp(platter.fixedPrice ?? platter.fromPrice)}</strong>
            </div>
          </div>
          {platter.serves && <p className="serves">Feeds {platter.serves}</p>}

          <p className="detail-desc">{cleanDesc}</p>

          {subOn && (
            <SubscribeSave value={subFreq} onChange={setSubFreq} discountPct={subPct} />
          )}

          <button className="btn" onClick={order}>
            {subFreq
              ? `Start a subscription — ${gbp(subPrice)} / board`
              : `Add & continue — ${gbp(platter.fixedPrice ?? platter.fromPrice)}`}
          </button>
          <p className="buy-reassure">
            {subFreq
              ? "No card taken now — we'll set your schedule up with you and confirm each board."
              : "Only 25% today · balance on collection · fully refundable up to 48 hrs before"}
          </p>

          <p className="prebook-hint muted">
            🎂 <strong>Planning ahead?</strong> Pick a future date at checkout to book this for a birthday or celebration —
            25% locks it in, and you can add a gift note.
          </p>
          <DeadlineChip />

          {platter.items.length > 0 && (
            <>
              <h2 className="detail-h2">What&apos;s inside</h2>
              <ul className="detail-items">
                {platter.items.map((it) => <li key={it.label}>{it.label}</li>)}
              </ul>
            </>
          )}

          <TrustChips />
          <p className="muted footnote">
            Allergies or dietary needs? Every board can be adapted — tell us in the notes when you order and
            we&apos;ll confirm with you directly. Extras like plates, cutlery and napkins are offered at the
            next step, sized to your numbers.
          </p>
        </div>
      </div>
    </div>
  );
}
