import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Platter } from "../lib/api";
import { saveCart } from "../lib/cart";
import { gbp } from "../lib/format";
import { Header } from "../components/Header";
import { usePageTitle } from "../lib/title";

export default function PlatterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [platter, setPlatter] = useState<Platter | null>(null);
  const [error, setError] = useState<string | null>(null);
  usePageTitle(platter?.name);

  useEffect(() => {
    if (!id) return;
    api.platter(id).then(setPlatter).catch((e) => setError(e.message));
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
    saveCart({ boards: [{ platterId: platter.id, quantity: 1 }], addOns: [], headcount: 0, origin: "direct" });
    navigate("/order");
  };

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
    <div className="app">
      <Header />
      <Link to="/platters" className="btn-ghost back">← Back to boards</Link>

      {platter.imageUrl && <div className="detail-photo" style={{ backgroundImage: `url(${platter.imageUrl})` }} role="img" aria-label={platter.name} />}

      <div className="spread" style={{ marginTop: 18, alignItems: "flex-start" }}>
        <h1 style={{ margin: 0 }}>{platter.name}</h1>
        <div className="price">
          <strong>{gbp(platter.fixedPrice ?? platter.fromPrice)}</strong>
        </div>
      </div>
      {platter.serves && <p className="serves">Feeds {platter.serves}</p>}

      <p className="detail-desc">{cleanDesc}</p>

      {platter.items.length > 0 && (
        <>
          <h2 className="detail-h2">What&apos;s inside</h2>
          <ul className="detail-items">
            {platter.items.map((it) => <li key={it.label}>{it.label}</li>)}
          </ul>
        </>
      )}

      <p className="muted footnote">A 25% deposit confirms your order · 48 hours&apos; notice · collect from your chosen shop.</p>

      <div className="nav-row">
        <button className="btn" onClick={order}>Add &amp; continue — {gbp(platter.fixedPrice ?? platter.fromPrice)}</button>
      </div>
    </div>
  );
}
