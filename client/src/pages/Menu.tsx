import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, type Platter, type Category } from "../lib/api";
import { gbp } from "../lib/format";
import { Header } from "../components/Header";

const TITLES: Record<Category, { title: string; blurb: string }> = {
  home: { title: "At Home", blurb: "Dinner, date night, family & friends — sorted." },
  events: { title: "Events & Office", blurb: "Work lunches, parties and larger groups." },
  seasonal: { title: "Seasonal Spreads", blurb: "Limited-time platters for the season." },
  platters: { title: "Platters", blurb: "Grazing boards for delivery." },
};

export default function Menu() {
  const { category } = useParams<{ category: Category }>();
  const cat = (category ?? "home") as Category;
  const [platters, setPlatters] = useState<Platter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const src = params.get("src");

  useEffect(() => {
    setPlatters(null);
    api.platters(cat).then(setPlatters).catch((e) => setError(e.message));
  }, [cat]);

  const detailHref = (platterId: string) => {
    const q = new URLSearchParams({ category: cat });
    if (src) q.set("src", src);
    return `/platter/${platterId}?${q.toString()}`;
  };

  const meta = TITLES[cat] ?? TITLES.home;

  return (
    <div className="app">
      <Header />
      <Link to={src ? `/?src=${src}` : "/"} className="btn-ghost back">← Back</Link>
      <section className="hero">
        <h1>{meta.title}</h1>
        <p className="muted">{meta.blurb}</p>
      </section>

      {error && <div className="notice danger">{error}</div>}
      {!platters && !error && <p className="muted center">Loading…</p>}
      {platters && platters.length === 0 && <p className="muted center">Nothing here right now — check back soon.</p>}

      <div className="stack">
        {platters?.map((p) => (
          <Link className="card platter platter-link" key={p.id} to={detailHref(p.id)}>
            {p.imageUrl && <div className="platter-img" style={{ backgroundImage: `url(${p.imageUrl})` }} />}
            <div className="platter-body">
              <div className="spread">
                <h2 style={{ margin: 0 }}>{p.name}</h2>
                <div className="price">
                  {p.isFixed ? <strong>{gbp(p.fixedPrice!)}</strong> : <><strong>{gbp(p.pricePerHead!)}</strong><span className="muted">/head</span></>}
                </div>
              </div>
              {p.serves && <p className="serves">Serves {p.serves}{!p.isFixed && p.minHeadcount > 1 ? ` · min ${p.minHeadcount}` : ""}</p>}
              <p className="muted clamp-2">{p.description}</p>
              <ul className="items">{p.items.slice(0, 4).map((it) => <li key={it.label}>{it.label}</li>)}{p.items.length > 4 && <li className="more">+{p.items.length - 4} more</li>}</ul>
              <span className="view-cta">View platter →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
