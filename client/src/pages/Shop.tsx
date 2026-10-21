import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type ShopCategory } from "../lib/api";
import { usePageTitle } from "../lib/title";
import { StickyCta } from "../components/StickyCta";
import { Faq } from "../components/Faq";
import { ReminderCapture } from "../components/ReminderCapture";
import { Bundles } from "../components/Bundles";
import { GiftVoucher } from "../components/GiftVoucher";
import { morphNavigate } from "../lib/motion";
import { PageHero } from "../components/site/PageHero";
import { SectionHead } from "../components/site/SectionHead";

/** The floor guide: one clear way in for each kind of customer. */
type Dept = { to: string; name: string; line: string; hash?: boolean };

export default function Shop() {
  usePageTitle(
    "Shop grazing boards by occasion",
    "Browse Kelly's Deli by occasion — hosting a crowd, a board for a night in, or office & corporate catering in Solihull. Made fresh for collection, 25% deposit.",
  );
  const navigate = useNavigate();
  const [cats, setCats] = useState<ShopCategory[] | null>(null);

  useEffect(() => {
    api.shopCategories().then(setCats).catch(() => setCats([]));
  }, []);

  // Christmas has its own department page; the occasion grid is for everything else.
  const xmas = cats?.find((c) => c.slug === "christmas") ?? null;
  const occasions = (cats ?? []).filter((c) => c.slug !== "christmas");
  // Photos only when every occasion has one, so the row reads as one set.
  const occPhotos = occasions.length > 0 && occasions.every((c) => !!c.heroImageUrl);

  const depts: Dept[] = [
    ...(xmas ? [{ to: "/christmas", name: "Christmas", line: "Hams, turkey and hampers to pre-order" }] : []),
    { to: "/platters", name: "Boards and platters", line: "Every board, for two to twenty" },
    { to: "/plan", name: "Catering", line: "Plan the food by headcount" },
    { to: "/bread", name: "Fresh bread", line: "Order ahead, collect from the shop" },
    { to: "#gift-vouchers", name: "Gift vouchers", line: "Give a board as a present", hash: true },
  ];

  return (
    <div className="collection shop-page">
      <PageHero
        crumbs={[{ to: "/", label: "Home" }, { label: "Shop" }]}
        title="What's the occasion?"
        intro="Feeding a crowd, a night in, lunch for the office or Christmas. Pick the moment and we'll show you what we make for it."
      />

      <nav className="dept-dir" aria-label="Shop departments">
        <ul className="wrap">
          {depts.map((d) => (
            <li key={d.to}>
              {d.hash ? (
                <a href={d.to}>
                  <span className="dept-name">{d.name}</span>
                  <span className="dept-line">{d.line}</span>
                </a>
              ) : (
                <Link to={d.to}>
                  <span className="dept-name">{d.name}</span>
                  <span className="dept-line">{d.line}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <section className="section" aria-labelledby="occasions-h">
        <div className="wrap">
          <SectionHead id="occasions-h" title="Shop by occasion" intro="Each collection is put together for how you'll be eating, and how many of you there are." />

          {cats === null && <p className="collection-loading" role="status">Loading…</p>}

          {occasions.length > 0 && (
            <div className={`occasion-grid is-${Math.min(occasions.length, 4)}`}>
              {occasions.map((c) => (
                <Link
                  key={c.id}
                  to={`/shop/${c.slug}`}
                  className={`occasion-card${occPhotos ? " has-photo" : ""}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                    e.preventDefault();
                    morphNavigate(navigate, `/shop/${c.slug}`, e.currentTarget.querySelector(".occasion-img") as HTMLElement | null);
                  }}
                >
                  {occPhotos && c.heroImageUrl && (
                    <span className="occasion-media">
                      <img className="occasion-img" src={c.heroImageUrl} alt="" loading="lazy" width="640" height="800" />
                    </span>
                  )}
                  <span className="occasion-body">
                    <h3 className="occasion-name">{c.name}</h3>
                    {c.tagline && <span className="occasion-tag">{c.tagline}</span>}
                    <span className="occasion-count">{c.boardCount} board{c.boardCount === 1 ? "" : "s"}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          {cats && occasions.length === 0 && (
            <div className="collection-empty">
              <p>The shop is being set up. Every board is on the boards page in the meantime.</p>
              <Link className="btn btn-secondary" to="/platters">Browse all boards</Link>
            </div>
          )}
        </div>
      </section>

      {xmas && (
        <section className="section shop-xmas" aria-labelledby="shop-xmas-h">
          <div className="wrap">
            <div className={`feature${xmas.heroImageUrl ? "" : " is-text"}`}>
              {xmas.heroImageUrl && (
                <div className="feature-visual">
                  <img src={xmas.heroImageUrl} alt="Christmas food from Kelly’s Deli" loading="lazy" />
                </div>
              )}
              <div className="feature-copy">
                <h2 id="shop-xmas-h">Sort your Christmas in one go.</h2>
                {xmas.tagline && <p>{xmas.tagline}</p>}
                <Link className="btn" to="/christmas">See the Christmas menu</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ready-made combos — one-tap to fill the basket */}
      <div className="wrap shop-bundles">
        <Bundles />
      </div>

      {/* Book ahead: birthdays and celebrations */}
      <section className="section is-paper prebook" aria-labelledby="prebook-h">
        <div className="wrap prebook-inner">
          <h2 id="prebook-h">Birthday coming up? Book the board now.</h2>
          <p>
            Pick a date weeks or months ahead and pay the 25% deposit to hold it. Add a gift note if it&apos;s for
            someone special. We make it fresh for the day you collect.
          </p>
          <Link className="btn btn-secondary" to="/platters">Book a board ahead</Link>
        </div>
      </section>

      <GiftVoucher />

      <div className="wrap">
        <ReminderCapture />
      </div>

      <div className="wrap collection-faq">
        <Faq />
      </div>
      <StickyCta label="Browse all boards" to="/platters" />
    </div>
  );
}
