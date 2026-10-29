import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type ShopCategory, type CategoryCounts, type Platter } from "../lib/api";
import { addBoard } from "../lib/cart";
import { openCartDrawer } from "../components/CartDrawer";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { Header } from "../components/Header";
import { StickyCta } from "../components/StickyCta";
import { Faq } from "../components/Faq";
import { DeadlineChip, Stars } from "../components/Trust";
import { CorporateEnquiryForm } from "../components/CorporateEnquiryForm";
import { ReminderCapture } from "../components/ReminderCapture";
import { morphNavigate } from "../lib/motion";
import { groupVariants, cheapestVariant, type ProductGroup } from "../lib/variants";
import { categoryQA } from "../lib/seoContent";


function priceFeeds(g: ProductGroup): string {
  const target = g.hasChoice ? cheapestVariant(g) : g.lead;
  const price = g.hasChoice ? `From ${gbp(g.fromPrice)}` : gbp(target.fixedPrice ?? target.fromPrice ?? 0);
  return target.serves ? `${price} · feeds ${target.serves}` : price;
}

export default function ShopCategory() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [cat, setCat] = useState<ShopCategory | null>(null);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [nextDay, setNextDay] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setCat(null);
    setNotFound(false);
    api.shopCategory(slug).then(setCat).catch(() => setNotFound(true));
    api.categories().then(setCounts).catch(() => setCounts(null));
  }, [slug]);

  // Next-day delivery for corporate is the owner's call — honestly off until they switch
  // the admin toggle on (surfaced in the public counts payload).
  useEffect(() => {
    setNextDay(!!counts?.corporateNextDayDelivery);
  }, [counts]);

  // Per-category SEO title/description (exact — the seed titles already include the brand).
  usePageTitle(
    cat?.seoTitle ?? cat?.name,
    cat?.seoDescription ?? cat?.description ?? undefined,
    !!cat?.seoTitle,
  );

  // Structured data (breadcrumb etc.) is rendered once by the server: server/src/lib/seo-pages.ts.

  const startOrder = (p: Platter) => {
    addBoard(p.id);
    openCartDrawer();
  };

  if (notFound) {
    return (
      <div className="app">
        <Header />
        <div className="notice">We couldn&apos;t find that section.</div>
        <Link className="btn btn-secondary" to="/shop">Back to the shop</Link>
      </div>
    );
  }
  if (!cat) {
    return <div className="app"><Header /><p className="muted center">Loading…</p></div>;
  }

  const boards = cat.boards ?? [];
  const groups = groupVariants(boards);

  return (
    <div className="app app-wide shop-cat-page">
      <Header />
      <Link to="/shop" className="btn-ghost back">← All occasions</Link>

      <header className="cat-hero" style={{ backgroundImage: cat.heroImageUrl ? `url(${cat.heroImageUrl})` : undefined }}>
        <div className="cat-hero-scrim">
          <h1 className="cat-hero-h">{cat.name}</h1>
          {cat.tagline && <p className="cat-hero-tag">{cat.tagline}</p>}
        </div>
      </header>

      {cat.description && <p className="cat-desc">{cat.description}</p>}

      {/* Answer-first Q&A for this occasion ("Hosting friends?"), shared with the server render. */}
      {categoryQA(cat.slug).map((q) => (
        <section key={q.h} className="pg-section cat-qa" data-reveal>
          <h2 className="section-h">{q.h}</h2>
          <p>
            {q.p}{" "}
            {q.link && <Link className="u-link" to={q.link}>How much party food you need →</Link>}
          </p>
        </section>
      ))}

      <div className="cat-trust" data-reveal>
        {counts?.reviewRating && <Stars rating={counts.reviewRating} count={counts.reviewCount} />}
        <DeadlineChip />
      </div>

      {/* Hosting: promote the event planner alongside the boards */}
      {cat.promotePlanner && (
        <button className="plan-banner" onClick={() => navigate("/plan")}>
          <span className="pb-title">Not sure how much you need?</span>
          <span className="pb-sub">Plan my event — tell us your numbers and we&apos;ll suggest the spread →</span>
        </button>
      )}

      {boards.length > 0 ? (
        <section className="board-section">
          <div className="board-grid">
            {groups.map((g, i) => {
              const p = g.lead;
              const toDetail = (e: React.MouseEvent<HTMLElement>) =>
                morphNavigate(navigate, `/platter/${p.id}`, e.currentTarget.closest("article")?.querySelector(".board-card-img") as HTMLElement | null);
              return (
                <article key={p.id} className="board-card card" data-reveal data-reveal-delay={String(i % 2)}>
                  <div className="board-card-img" style={{ backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : undefined }} role="img" aria-label={p.name} />
                  <div className="board-card-body">
                    <h3 className="board-card-name">{p.name}</h3>
                    <p className="board-card-price">{priceFeeds(g)}</p>
                    <p className="board-card-desc muted">{p.description.replace(/\s*\[CHECK PRICE.*?\]\s*$/i, "")}</p>
                    <div className="board-card-actions">
                      {g.hasChoice ? (
                        <button className="btn" onClick={toDetail}>Choose a size · {g.variants.length} options</button>
                      ) : (
                        <>
                          <button className="btn" onClick={() => startOrder(p)}>Order · {gbp(p.fixedPrice ?? 0)}</button>
                          <button className="btn-ghost" onClick={toDetail}>Details</button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="muted">Boards for this occasion are being added — <Link to="/platters">see all boards</Link>.</p>
      )}

      {/* Subscribe & Save is offered per-board on the board page — signpost it honestly */}
      {!cat.isCorporate && (
        <div className="cat-subscribe-note" data-reveal>
          <span className="csn-badge" aria-hidden="true">↻</span>
          <span>Order it on repeat and <strong>save 10%</strong> — pick weekly, fortnightly or monthly on any board. You pay for your first board when you order; we set the rest of the schedule up with you.</span>
        </div>
      )}

      {/* Corporate: standing-order copy + enquiry form */}
      {cat.isCorporate && (
        <section className="corp-section" data-reveal>
          <div className="corp-standing">
            <h2 className="section-h">A standing platter for the office</h2>
            <p className="muted">
              Set up a regular weekly, fortnightly or monthly platter and save 10% with Subscribe &amp; Save — we&apos;ll
              invoice monthly and confirm every delivery with you. {nextDay
                ? "Regular orders are delivered the next working day."
                : "Delivery is available for regular office orders — we'll confirm your schedule with you."}
            </p>
          </div>
          <CorporateEnquiryForm nextDayConfirmed={nextDay} />
        </section>
      )}

      {/* Book-ahead / birthday selling point */}
      <section className="prebook-band grain" data-reveal>
        <div>
          <h2 className="prebook-h">Got a date in the diary? Book it in now.</h2>
          <p className="prebook-copy">
            Birthday, celebration or a big weekend coming up — pick a date ahead, pay when you order and it&apos;s locked in.
            Add a gift note at checkout if it&apos;s for someone else.
          </p>
          <Link className="btn prebook-cta" to="/platters">Book a board ahead</Link>
        </div>
      </section>

      {!cat.isCorporate && <ReminderCapture />}

      <Faq />
      <StickyCta label="Browse all boards" to="/platters" />
    </div>
  );
}
