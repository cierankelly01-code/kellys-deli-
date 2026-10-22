import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type CategoryCounts } from "../lib/api";
import { usePageTitle } from "../lib/title";
import { Header } from "../components/Header";
import { Stars } from "../components/Trust";

const SITE = "https://www.kellysdeli.co.uk";

const DEFAULT_ABOUT = "Proper food from the people you know — grazing boards for collection, made fresh.";
const DEFAULT_MISSION = "The deli your grandparents would recognise — local produce, no shortcuts, boards built the same way every time.";
const DEFAULT_NOTE = "We've been doing this the same way for years — proper local produce, boards built by hand, nothing rushed. Every order that goes out the door is one we'd be happy to serve our own family.";

const VALUES = [
  { h: "Local, named suppliers", p: "We buy from people we know, not a catalogue — so we can tell you exactly where something came from, not just “local produce.”" },
  { h: "Made to order, not made ahead", p: "Nothing sits pre-built waiting for a customer. Your board is made once you've booked your date." },
  { h: "The same way, every time", p: "No seasonal shortcuts, no substituting down when something's dear — if it's on the board, it's the real thing." },
];

/**
 * Our Story — pulls real, admin-editable content (Site Settings) rather than inventing
 * a founder name or history that isn't in the data. Serves two purposes at once: a trust
 * signal for a first-time phone shopper, and the provenance narrative that private/premium
 * buyers specifically look for before they hand over a big event.
 */
export default function OurStory() {
  const [counts, setCounts] = useState<CategoryCounts | null>(null);

  useEffect(() => {
    api.categories().then(setCounts).catch(() => setCounts(null));
  }, []);

  usePageTitle(
    "Our story",
    "Kelly's Deli is a family-run delicatessen in Bentley Heath, Solihull — real suppliers, boards built by hand, nothing rushed. Meet the deli behind the boards.",
    true,
  );

  useEffect(() => {
    const data = {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "Our story — Kelly's Deli",
      url: `${SITE}/our-story`,
      about: { "@type": "LocalBusiness", name: "Kelly's Deli", "@id": `${SITE}/#business` },
    };
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.text = JSON.stringify(data);
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  return (
    <div className="app app-wide our-story-page">
      <Header />

      <header className="os-hero" data-reveal>
        <p className="deli-eyebrow">Our story</p>
        <h1 className="os-h1">{counts?.missionTagline || DEFAULT_MISSION}</h1>
        {counts?.reviewRating && (
          <div className="os-hero-rating"><Stars rating={counts.reviewRating} count={counts.reviewCount} /></div>
        )}
      </header>

      <section className="os-note" data-reveal>
        <p className="os-note-text">&ldquo;{counts?.founderNote || DEFAULT_NOTE}&rdquo;</p>
        <p className="os-note-attr">— Kelly&apos;s Deli, Bentley Heath</p>
      </section>

      <section className="os-about" data-reveal>
        <p>{counts?.aboutText || DEFAULT_ABOUT}</p>
      </section>

      <section className="os-values" data-reveal>
        {VALUES.map((v) => (
          <div key={v.h} className="os-value">
            <h2 className="step-h">{v.h}</h2>
            <p>{v.p}</p>
          </div>
        ))}
      </section>

      <section className="os-visit" data-reveal>
        <h2 className="section-h">Come and see us</h2>
        <p>
          <a href="https://www.google.com/maps/search/?api=1&query=Kelly%27s+Deli+1+Slater+Road+Solihull+B93+8AQ" target="_blank" rel="noreferrer">
            1 Slater Road, Bentley Heath, Solihull B93 8AQ ↗
          </a>
        </p>
        <p className="muted">Tuesday–Friday 8am–4pm · Saturday 8am–3pm · Closed Sunday &amp; Monday</p>
      </section>

      <section className="os-close" data-reveal>
        <h2 className="section-h">Get to know the food</h2>
        <div className="os-close-links">
          <Link className="btn" to="/shop">Browse boards &amp; platters</Link>
          <Link className="btn-secondary" to="/office-catering">Office catering</Link>
        </div>
      </section>
    </div>
  );
}
