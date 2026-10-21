import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type ShopCategory } from "../lib/api";
import { usePageTitle } from "../lib/title";
import { StickyCta } from "../components/StickyCta";
import { Faq } from "../components/Faq";
import { ReminderCapture } from "../components/ReminderCapture";
import { Bundles } from "../components/Bundles";
import { GiftVoucher } from "../components/GiftVoucher";
import { ProductArt } from "../components/ProductArt";
import { Crest } from "../components/BrandMark";
import { morphNavigate } from "../lib/motion";
import { PageHero } from "../components/site/PageHero";
import { SectionHead } from "../components/site/SectionHead";
import { occasionArt } from "./ShopCategory";

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

  const depts: Dept[] = [
    ...(xmas ? [{ to: "/christmas", name: "Christmas", line: "Hams, turkey & hampers to pre-order" }] : []),
    { to: "/platters", name: "Boards & platters", line: "Every board, for two to twenty" },
    { to: "/plan", name: "Catering", line: "Plan the food by headcount" },
    { to: "/bread", name: "Fresh bread", line: "Click & collect for the morning" },
    { to: "#gift-vouchers", name: "Gift vouchers", line: "Give a board as a present", hash: true },
  ];

  return (
    <div className="collection shop-page">
      <PageHero
        crumbs={[{ to: "/", label: "Home" }, { label: "Shop" }]}
        eyebrow="The Kelly's shop"
        title="What's the occasion?"
        intro="Pick the moment and we'll show you what's made for it — feeding a crowd, a night in, lunch for the office, or Christmas sorted."
      />

      <nav className="dept-dir" aria-label="Shop departments">
        <ul className="wrap">
          {depts.map((d, i) => (
            <li key={d.to}>
              {d.hash ? (
                <a href={d.to}>
                  <span className="dept-n" aria-hidden="true">{["I", "II", "III", "IV", "V", "VI"][i]}</span>
                  <span className="dept-name">{d.name}</span>
                  <span className="dept-line">{d.line}</span>
                </a>
              ) : (
                <Link to={d.to} className={d.to === "/christmas" ? "is-season" : undefined}>
                  <span className="dept-n" aria-hidden="true">{["I", "II", "III", "IV", "V", "VI"][i]}</span>
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
          <SectionHead id="occasions-h" eyebrow="Shop by occasion" title="Made for the moment" intro="Each collection is put together for how you'll be eating — and how many." />

          {cats === null && <div className="collection-loading" role="status">Loading…</div>}

          {occasions.length > 0 && (
            <div className="occasion-grid">
              {occasions.map((c, i) => (
                <Link
                  key={c.id}
                  to={`/shop/${c.slug}`}
                  className="occasion-card"
                  data-reveal
                  data-reveal-delay={String(i % 3)}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                    e.preventDefault();
                    morphNavigate(navigate, `/shop/${c.slug}`, e.currentTarget.querySelector(".occasion-img") as HTMLElement | null);
                  }}
                >
                  <span className="occasion-media">
                    {c.heroImageUrl ? (
                      <img className="occasion-img" src={c.heroImageUrl} alt="" loading="lazy" />
                    ) : (
                      <ProductArt name={occasionArt(c.slug, c.name)} className="occasion-img" />
                    )}
                  </span>
                  <span className="occasion-body">
                    <span className="occasion-count">{c.boardCount} board{c.boardCount === 1 ? "" : "s"}</span>
                    <h3 className="occasion-name">{c.name}</h3>
                    {c.tagline && <span className="occasion-tag">{c.tagline}</span>}
                    <span className="occasion-go">Shop now <span aria-hidden="true">→</span></span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          {cats && occasions.length === 0 && (
            <div className="collection-empty">
              <p>Our shop is being set up — every board is on the board counter in the meantime.</p>
              <Link className="btn btn-secondary" to="/platters">Browse all boards</Link>
            </div>
          )}
        </div>
      </section>

      {xmas && (
        <section className="section shop-xmas" aria-labelledby="shop-xmas-h">
          <div className="wrap">
            <div className="shop-xmas-panel">
              <div className="shop-xmas-copy">
                <Crest className="shop-xmas-crest" />
                <p className="eyebrow">The Christmas collection</p>
                <h2 id="shop-xmas-h">Sort your Christmas in one go.</h2>
                {xmas.tagline && <p>{xmas.tagline}</p>}
                <p className="shop-xmas-meta">Pay in full online · collect any day in December</p>
                <Link className="btn shop-xmas-cta" to="/christmas">Shop Christmas</Link>
              </div>
              <div className="shop-xmas-art">
                {xmas.heroImageUrl ? <img src={xmas.heroImageUrl} alt="" /> : <ProductArt name="Honey Roast Ham" />}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ready-made combos — one-tap to fill the basket */}
      <div className="wrap section shop-bundles">
        <Bundles />
      </div>

      {/* Book ahead — birthdays & celebrations as a selling point */}
      <section className="section">
        <div className="wrap">
          <div className="feature prebook">
            <div className="feature-visual">
              <ProductArt name="Gift" />
            </div>
            <div className="feature-copy">
              <p className="eyebrow">Book ahead</p>
              <h2>Birthday coming up? Book the board now, sorted.</h2>
              <p>
                Pick a date weeks or months ahead, pay just the 25% deposit to lock it in, and add a gift note if it&apos;s
                for someone special. We&apos;ll make it fresh the day you collect — one less thing to think about.
              </p>
              <Link className="btn btn-secondary" to="/platters">Book a board ahead</Link>
            </div>
          </div>
        </div>
      </section>

      <GiftVoucher />

      <div className="wrap">
        <ReminderCapture />
      </div>

      <div className="wrap-narrow">
        <Faq />
      </div>
      <StickyCta label="Browse all boards" to="/platters" />
    </div>
  );
}
