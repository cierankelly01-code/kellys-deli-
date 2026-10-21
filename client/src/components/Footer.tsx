import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { OPEN_CONSENT_EVENT } from "../lib/consent";
import { loadSiteContent } from "../lib/season";
import { DAY_LABELS, openStatus, parseHours, todayIndex, SHOP_ADDRESS, SHOP_MAP_URL, SHOP_EMAIL } from "../lib/hours";
import type { OpeningHours } from "../lib/api";

/** Site footer — the shop's front door online: where we are, when we're open, every
 * department, and the UK-required legal links. id="our-shops" is the "Visit us" target. */
export function Footer() {
  const year = new Date().getFullYear();
  const [hours, setHours] = useState<OpeningHours | null>(null);
  const [rating, setRating] = useState<{ value: string; count: string | null } | null>(null);

  useEffect(() => {
    loadSiteContent().then((c) => {
      setHours(parseHours(c?.openingHours));
      if (c?.reviewRating) setRating({ value: c.reviewRating, count: c.reviewCount });
    });
  }, []);

  const today = todayIndex();

  return (
    <footer className="site-footer" id="our-shops">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <p className="footer-word">Kelly&apos;s</p>
          <p className="footer-tag">Deli, Bentley Heath</p>
          {rating && <p className="footer-rating">Rated {rating.value} out of 5 on Google{rating.count ? ` from ${rating.count} reviews` : ""}</p>}
        </div>

        <div className="footer-cols">
          <div className="footer-col">
            <p className="footer-col-h">Visit the shop</p>
            <a href={SHOP_MAP_URL} target="_blank" rel="noreferrer" className="footer-address">
              Kelly&apos;s Deli<br />{SHOP_ADDRESS.split(", ").map((l) => <span key={l}>{l}<br /></span>)}
              <span className="footer-map">Get directions</span>
            </a>
            <a href={`mailto:${SHOP_EMAIL}`}>{SHOP_EMAIL}</a>
          </div>

          <div className="footer-col">
            <p className="footer-col-h">Opening hours</p>
            {hours ? (
              <>
                <p className="footer-status">{openStatus(hours).text.replace(" · ", ", ")}</p>
                <dl className="footer-hours">
                  {DAY_LABELS.map((d, i) => (
                    <div key={d.key} className={i === today ? "is-today" : undefined}>
                      <dt>{d.long}</dt>
                      <dd>{hours[d.key]}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="footer-muted">Pop in, or email us for opening times.</p>
            )}
          </div>

          <div className="footer-col">
            <p className="footer-col-h">Shop</p>
            <Link to="/christmas">Christmas</Link>
            <Link to="/platters">Boards &amp; platters</Link>
            <Link to="/shop">Shop by occasion</Link>
            <Link to="/bread">Fresh bread</Link>
            <Link to="/plan">Catering &amp; events</Link>
            <Link to="/shop/office-corporate">Office &amp; corporate</Link>
          </div>

          <div className="footer-col">
            <p className="footer-col-h">Good to know</p>
            <Link to="/terms">Terms and conditions</Link>
            <Link to="/privacy">Privacy policy</Link>
            <button type="button" className="footer-linkbtn" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT))}>
              Cookie settings
            </button>
            <Link to="/admin">Staff login</Link>
          </div>
        </div>

        <p className="footer-copy">© {year} Kelly&apos;s Deli, Bentley Heath, Solihull</p>
      </div>
    </footer>
  );
}
