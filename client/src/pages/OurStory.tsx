import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type CategoryCounts, type LocationT } from "../lib/api";
import { usePageTitle } from "../lib/title";
import { Header } from "../components/Header";
import { Stars } from "../components/Trust";
import { family } from "../lib/seoContent";


const DEFAULT_ABOUT = "Proper food from the people you know — grazing boards for collection, made fresh.";
const DEFAULT_MISSION = "The deli your grandparents would recognise — local produce, no shortcuts, boards built the same way every time.";
const DEFAULT_NOTE = "We've been doing this the same way for years — proper local produce, boards built by hand, nothing rushed. Every order that goes out the door is one we'd be happy to serve our own family.";

const VISIT_DAYS = [
  { key: "mon", short: "Mon" }, { key: "tue", short: "Tue" }, { key: "wed", short: "Wed" },
  { key: "thu", short: "Thu" }, { key: "fri", short: "Fri" }, { key: "sat", short: "Sat" }, { key: "sun", short: "Sun" },
];

function fmtClock(t: string): string {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return t.trim();
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return min === "00" ? `${h}${ap}` : `${h}:${min}${ap}`;
}

/** Collapses a shop's day-by-day opening hours into a readable line, e.g.
 * "Closed Mon · Tue–Fri 8am–4pm · Sat 8am–3pm · Closed Sun" — same idea as the
 * hand-written copy this replaces, but honest for whichever shop it's rendering. */
function fmtHoursLine(hours: Record<string, string> | null): string | null {
  if (!hours) return null;
  const days = VISIT_DAYS.map((d) => ({ short: d.short, raw: (hours[d.key] || "Closed").trim() }));
  const groups: Array<{ shorts: string[]; raw: string }> = [];
  for (const d of days) {
    const last = groups[groups.length - 1];
    if (last && last.raw.toLowerCase() === d.raw.toLowerCase()) last.shorts.push(d.short);
    else groups.push({ shorts: [d.short], raw: d.raw });
  }
  const parts = groups.map((g) => {
    const label = g.shorts.length > 1 ? `${g.shorts[0]}–${g.shorts[g.shorts.length - 1]}` : g.shorts[0];
    if (/closed/i.test(g.raw)) return `Closed ${label}`;
    const [a, b] = g.raw.split("-").map((s) => s.trim());
    return a && b ? `${label} ${fmtClock(a)}–${fmtClock(b)}` : `${label} ${g.raw}`;
  });
  return parts.join(" · ");
}

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
  const [locations, setLocations] = useState<LocationT[]>([]);

  useEffect(() => {
    api.categories().then(setCounts).catch(() => setCounts(null));
    api.locations().then(setLocations).catch(() => setLocations([]));
  }, []);

  usePageTitle(
    "Our story",
    "Kelly's Deli is a family-run delicatessen in Bentley Heath, Solihull — real suppliers, boards built by hand, nothing rushed. Meet the deli behind the boards.",
    true,
  );

  // AboutPage structured data is rendered once by the server (server/src/lib/seo-pages.ts).

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

      <section className="os-about os-family" data-reveal aria-labelledby="os-family-h">
        <h2 id="os-family-h" className="section-h">{family.h}</h2>
        <p>{family.p}</p>
      </section>

      <section className="os-note" data-reveal>
        <p className="os-note-text">&ldquo;{counts?.founderNote || DEFAULT_NOTE}&rdquo;</p>
        <p className="os-note-attr">— Kelly&apos;s Deli</p>
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
        {locations.filter((l) => l.active).length === 0 ? (
          <>
            <p>
              <a href="https://www.google.com/maps/search/?api=1&query=Kelly%27s+Deli+1+Slater+Road+Solihull+B93+8AQ" target="_blank" rel="noreferrer">
                1 Slater Road, Bentley Heath, Solihull B93 8AQ ↗
              </a>
            </p>
            <p className="muted">Tuesday–Friday 8am–4pm · Saturday 8am–3pm · Closed Sunday &amp; Monday</p>
          </>
        ) : (
          locations.filter((l) => l.active).map((l) => {
            const full = [l.address, l.postcode].filter(Boolean).join(", ");
            const hoursLine = fmtHoursLine(l.openingHours);
            return (
              <div key={l.id} className="os-visit-shop">
                <p className="os-visit-name">{l.name}</p>
                {full && (
                  <p>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Kelly's Deli ${full}`)}`} target="_blank" rel="noreferrer">
                      {full} ↗
                    </a>
                  </p>
                )}
                {hoursLine && <p className="muted">{hoursLine}</p>}
              </div>
            );
          })
        )}
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
