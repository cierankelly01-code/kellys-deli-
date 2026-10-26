import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { OPEN_CONSENT_EVENT } from "../lib/consent";
import { api, type LocationT } from "../lib/api";

/** Site footer — a designed destination, not an afterthought: giant wordmark,
 * useful links, contact, and the UK-required legal links. */
export function Footer() {
  const year = new Date().getFullYear();
  const [locations, setLocations] = useState<LocationT[]>([]);

  useEffect(() => {
    api.locations().then(setLocations).catch(() => setLocations([]));
  }, []);

  return (
    <footer className="site-footer grain" id="our-shops">
      <div className="site-footer-inner">
        <p className="footer-word" aria-hidden="true">Kelly&apos;s Deli</p>

        <div className="footer-cols">
          <div className="footer-col">
            <p className="footer-col-h">Order</p>
            <Link className="u-link" to="/lunch">Order lunch</Link>
            <Link className="u-link" to="/groceries">Deli Counter</Link>
            <Link className="u-link" to="/shop">Boards &amp; platters</Link>
            <Link className="u-link" to="/office-catering">Office catering</Link>
            <Link className="u-link" to="/bread">Bread pre-orders</Link>
            <Link className="u-link" to="/plan">Plan an event</Link>
          </div>
          <div className="footer-col">
            <p className="footer-col-h">Collect from</p>
            {locations.length === 0 ? (
              <a href="https://www.google.com/maps/search/?api=1&query=Kelly%27s+Deli+1+Slater+Road+Solihull+B93+8AQ" target="_blank" rel="noreferrer">Bentley Heath ↗</a>
            ) : (
              locations.map((l) => {
                const full = [l.address, l.postcode].filter(Boolean).join(", ");
                return full ? (
                  <a
                    key={l.id}
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Kelly's Deli ${full}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {l.name} — {full} ↗
                  </a>
                ) : (
                  <span key={l.id} className="muted">{l.name}</span>
                );
              })
            )}
            <Link className="u-link" to="/our-story">Our story</Link>
          </div>
          <div className="footer-col">
            <p className="footer-col-h">Get in touch</p>
            <a className="u-link" href="mailto:hello@kellysdeli.co.uk">hello@kellysdeli.co.uk</a>
            {locations.filter((l) => l.phone).map((l) => (
              <a key={l.id} className="u-link" href={`tel:${l.phone!.replace(/\s+/g, "")}`}>{l.name}: {l.phone}</a>
            ))}
            <Link className="u-link" to="/privacy">Privacy Policy</Link>
            <Link className="u-link" to="/terms">Terms &amp; Conditions</Link>
            <button
              type="button"
              className="u-link footer-linkbtn"
              onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT))}
            >
              Cookie settings
            </button>
            <Link className="u-link" to="/admin">Staff login</Link>
          </div>
        </div>

        <p className="footer-copy">© {year} Kelly&apos;s Deli. Boards built by hand, same as always.</p>
      </div>
    </footer>
  );
}
