import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type ShopCategory } from "../lib/api";
import { usePageTitle } from "../lib/title";
import { Header } from "../components/Header";
import { StickyCta } from "../components/StickyCta";
import { Faq } from "../components/Faq";
import { ReminderCapture } from "../components/ReminderCapture";
import { Bundles } from "../components/Bundles";
import { GiftVoucher } from "../components/GiftVoucher";
import { morphNavigate } from "../lib/motion";

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

  return (
    <div className="app app-wide shop-page">
      <Header />
      <h1 className="page-h">What&apos;s the occasion?</h1>
      <p className="shop-intro muted">
        Pick the moment and we&apos;ll show you the boards built for it — feeding a crowd, a night in,
        or lunch for the office.
      </p>

      {cats === null && <p className="muted">Loading…</p>}

      {cats && cats.length > 0 && (
        <div className="occasion-grid">
          {cats.map((c, i) => (
            <button
              key={c.id}
              className="occasion-card card"
              data-reveal
              data-reveal-delay={String(i % 2)}
              onClick={(e) =>
                morphNavigate(navigate, `/shop/${c.slug}`, e.currentTarget.querySelector(".occasion-img") as HTMLElement | null)
              }
            >
              <div
                className="occasion-img"
                style={{ backgroundImage: c.heroImageUrl ? `url(${c.heroImageUrl})` : undefined }}
                role="img"
                aria-label={c.name}
              />
              <div className="occasion-body">
                <h2 className="occasion-name">{c.name}</h2>
                {c.tagline && <p className="occasion-tag">{c.tagline}</p>}
                <span className="occasion-go">
                  {c.boardCount} board{c.boardCount === 1 ? "" : "s"} →
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {cats && cats.length === 0 && (
        <p className="muted">Our shop is being set up — <Link to="/platters">browse all boards</Link> in the meantime.</p>
      )}

      {/* Ready-made combos — one-tap to fill the basket */}
      <Bundles />

      {/* Book ahead — birthdays & celebrations as a selling point */}
      <section className="prebook-band grain" data-reveal>
        <div>
          <h2 className="prebook-h">Birthday coming up? Book the board now, sorted.</h2>
          <p className="prebook-copy">
            Pick a date weeks or months ahead, pay just the 25% deposit to lock it in, and add a gift note if it&apos;s
            for someone special. We&apos;ll make it fresh the day you collect — one less thing to think about.
          </p>
          <Link className="btn prebook-cta" to="/platters">Book a board ahead</Link>
        </div>
      </section>

      <ReminderCapture />

      <GiftVoucher />

      <Faq />
      <StickyCta label="Browse all boards" to="/platters" />
    </div>
  );
}
