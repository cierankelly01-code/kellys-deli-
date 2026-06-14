import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, type Platter } from "../lib/api";
import { gbp } from "../lib/format";
import { Header } from "../components/Header";

export default function PlatterDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [platter, setPlatter] = useState<Platter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const src = params.get("src");
  const category = params.get("category");

  useEffect(() => {
    if (!id) return;
    api.platter(id).then(setPlatter).catch((e) => setError(e.message));
  }, [id]);

  const orderHref = () => {
    const q = new URLSearchParams({ platter: id ?? "" });
    if (category) q.set("category", category);
    if (src) q.set("src", src);
    return `/order?${q.toString()}`;
  };
  const backHref = category ? `/menu/${category}${src ? `?src=${src}` : ""}` : "/";

  if (error) {
    return (
      <div className="app">
        <Header />
        <div className="notice danger">{error}</div>
        <Link className="btn btn-secondary" to="/">Back to menu</Link>
      </div>
    );
  }
  if (!platter) {
    return <div className="app"><Header /><p className="muted center">Loading…</p></div>;
  }

  return (
    <div className="app">
      <Header />
      <Link to={backHref} className="btn-ghost back">← Back</Link>

      {platter.imageUrl && <div className="detail-photo" style={{ backgroundImage: `url(${platter.imageUrl})` }} />}

      <div className="spread" style={{ marginTop: 18, alignItems: "flex-start" }}>
        <h1 style={{ margin: 0 }}>{platter.name}</h1>
        <div className="price">
          {platter.isFixed ? <strong>{gbp(platter.fixedPrice!)}</strong> : <><strong>{gbp(platter.pricePerHead!)}</strong><span className="muted">/head</span></>}
        </div>
      </div>
      {platter.serves && (
        <p className="serves">Serves {platter.serves}{!platter.isFixed && platter.minHeadcount > 1 ? ` · minimum ${platter.minHeadcount}` : ""}</p>
      )}

      <p className="detail-desc">{platter.description}</p>

      <h2 className="detail-h2">What&apos;s inside</h2>
      <ul className="detail-items">
        {platter.items.map((it) => <li key={it.label}>{it.label}</li>)}
      </ul>

      <p className="muted footnote">25% deposit secures your date · 48 hours&apos; notice · collect or send as a gift.</p>

      <div className="nav-row">
        <Link className="btn" to={orderHref()}>Order this — from {gbp(platter.fromPrice)}</Link>
      </div>
    </div>
  );
}
