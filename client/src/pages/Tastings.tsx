import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Experience } from "../lib/api";
import { gbp } from "../lib/format";
import { Header } from "../components/Header";

export default function Tastings() {
  const [experiences, setExperiences] = useState<Experience[] | null>(null);
  const [comingSoon, setComingSoon] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const src = params.get("src");

  useEffect(() => {
    api.categories().then((c) => setComingSoon(c.tastingsComingSoon)).catch(() => setComingSoon(true));
    api.experiences().then(setExperiences).catch((e) => setError(e.message));
  }, []);

  const bookHref = (id: string) => {
    const q = new URLSearchParams({ experience: id });
    if (src) q.set("src", src);
    return `/book?${q.toString()}`;
  };

  return (
    <div className="app">
      <Header />
      <Link to={src ? `/?src=${src}` : "/"} className="btn-ghost back">← Back</Link>
      <section className="hero">
        <h1>Tastings &amp; Experiences</h1>
        <p className="muted">Guided evenings with the people who know the produce best. Limited seats.</p>
      </section>

      {comingSoon && (
        <div className="comingsoon-banner">
          <strong>Coming soon 🧀</strong>
          <span>We&apos;re putting the finishing touches to our tastings. Join the list and we&apos;ll text you the moment they open.</span>
          <Link className="btn" to="/menu/home">Browse platters meanwhile</Link>
        </div>
      )}

      {error && <div className="notice danger">{error}</div>}
      {!experiences && !error && <p className="muted center">Loading…</p>}

      <div className="stack">
        {experiences?.map((e) => (
          <article className="card platter" key={e.id}>
            {e.imageUrl && <div className="platter-img" style={{ backgroundImage: `url(${e.imageUrl})` }} />}
            <div className="platter-body">
              <div className="spread">
                <h2 style={{ margin: 0 }}>{e.name}</h2>
                <div className="price"><strong>{gbp(e.pricePerHead)}</strong><span className="muted">/head</span></div>
              </div>
              <p className="serves">Up to {e.capacity} guests per session</p>
              <p className="muted">{e.description}</p>
              {comingSoon ? (
                <button className="btn" disabled>Coming soon</button>
              ) : (
                <Link className="btn" to={bookHref(e.id)}>Book {e.name}</Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
