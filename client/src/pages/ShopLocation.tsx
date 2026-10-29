import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type LocationT } from "../lib/api";
import { usePageTitle } from "../lib/title";
import { locationCopy, mapUrl } from "../lib/seoContent";
import { Header } from "../components/Header";
import { WhyUs } from "../components/WhyUs";
import NotFound from "./NotFound";

const DAYS: Array<[string, string]> = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

const ORDER_LINKS: Array<{ to: string; label: string; note: string }> = [
  { to: "/platters", label: "Grazing boards & platters", note: "Charcuterie, cheese, savoury and salmon" },
  { to: "/shop/hosting", label: "Party platters", note: "Birthdays, showers and celebrations" },
  { to: "/lunch", label: "Lunch", note: "Sandwiches and salads, ordered ahead" },
  { to: "/bread", label: "Bread", note: "Pre-order your loaves" },
  { to: "/groceries", label: "Deli counter", note: "Salads, meats, cheese and more" },
];

/** One page per shop: the address, hours and phone Google and ChatGPT match "deli near me" against. */
export default function ShopLocation({ slug }: { slug: string }) {
  const copy = locationCopy(slug);
  // undefined = loading, null = this shop isn't open (a real 404). A failed request is
  // NOT a 404: the address and copy still show, only the live hours/phone are missing.
  const [loc, setLoc] = useState<LocationT | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  usePageTitle(copy?.title, copy?.description, true);

  useEffect(() => {
    api.locations()
      .then((ls) => setLoc(ls.find((l) => l.slug === slug && l.active) ?? null))
      .catch(() => setLoadFailed(true));
  }, [slug]);

  if (!copy || loc === null) return <NotFound />;
  const todayKey = DAYS[(new Date().getDay() + 6) % 7][0];
  const address = loc ? [loc.address, loc.postcode].filter(Boolean).join(", ") : "";

  return (
    <div className="app app-wide shop-loc">
      <Header />
      <header className="shop-loc-hero" data-reveal>
        <p className="deli-eyebrow">Our shops</p>
        <h1 className="shop-loc-h1">{copy.h1}</h1>
        <p className="shop-loc-lede">{copy.lede}</p>
      </header>

      <div className="shop-loc-grid">
        <section className="card shop-loc-card" aria-labelledby="visit-h">
          <h2 id="visit-h" className="shop-loc-card-h">Find us</h2>
          {address ? (
            <p className="shop-loc-address">{address}</p>
          ) : loadFailed ? (
            <p className="shop-loc-address">{copy.mapQuery.replace(/^Kelly's Deli /, "")}</p>
          ) : (
            <p className="muted">Loading address…</p>
          )}
          <p><a className="u-link" href={mapUrl(copy.mapQuery)} target="_blank" rel="noreferrer">Open in Google Maps ↗</a></p>
          {loc?.phone && <p><a className="u-link" href={`tel:${loc.phone.replace(/\s+/g, "")}`}>{loc.phone}</a></p>}
          <p><a className="u-link" href="mailto:hello@kellysdeli.co.uk">hello@kellysdeli.co.uk</a></p>
          <p className="muted small">Handy for {copy.nearby.join(", ")}.</p>
        </section>

        <section className="card shop-loc-card" aria-labelledby="hours-h">
          <h2 id="hours-h" className="shop-loc-card-h">Opening hours</h2>
          {loc?.openingHours ? (
            <dl className="shop-loc-hours">
              {DAYS.map(([k, label]) => (
                <div key={k} className={k === todayKey ? "is-today" : undefined}>
                  <dt>{label}</dt>
                  <dd>{loc.openingHours?.[k] && !/closed/i.test(loc.openingHours[k]) ? loc.openingHours[k].replace("-", "–") : "Closed"}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">{loadFailed ? "We couldn't load today's hours. Please refresh." : loc === undefined ? "Loading hours…" : "Email hello@kellysdeli.co.uk for today's hours."}</p>
          )}
        </section>
      </div>

      <section className="shop-loc-order" data-reveal aria-labelledby="order-h">
        <h2 id="order-h" className="section-h">Order here for collection</h2>
        <ul className="shop-loc-links">
          {ORDER_LINKS.map((o) => (
            <li key={o.to}>
              <Link to={o.to}>
                <span className="shop-loc-link-label">{o.label}</span>
                <span className="shop-loc-link-note">{o.note}</span>
                <span aria-hidden="true" className="shop-loc-link-arrow">→</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="muted small">Pick this shop at checkout. Boards and platters need at least 48 hours’ notice.</p>
      </section>

      <WhyUs />
    </div>
  );
}
