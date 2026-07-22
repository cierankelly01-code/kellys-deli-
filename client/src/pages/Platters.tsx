import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CategoryCounts, type Platter } from "../lib/api";
import { groupVariants, groupServes, type ProductGroup } from "../lib/variants";
import { addBoard } from "../lib/cart";
import { openCartDrawer } from "../components/CartDrawer";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { StickyCta } from "../components/StickyCta";
import { Header } from "../components/Header";
import { Faq } from "../components/Faq";
import { DeadlineChip, Stars } from "../components/Trust";
import { morphNavigate } from "../lib/motion";

/** Price + feeds line, e.g. "£60 · feeds 8–10", or "From £22.50 · feeds 2–4 – 10–15" for a
 *  board sold in several sizes. "From" quotes the cheapest size, which is the honest anchor. */
function priceFeeds(g: ProductGroup): string {
  const price = g.hasChoice ? `From ${gbp(g.fromPrice)}` : gbp(g.lead.fixedPrice ?? g.lead.fromPrice ?? 0);
  const serves = groupServes(g.variants);
  return serves ? `${price} · feeds ${serves}` : price;
}

export default function Platters() {
  usePageTitle(
    "Order a board",
    "Browse Kelly's Deli grazing and charcuterie boards — charcuterie, cheese, savoury and smoked salmon in small, medium and large. Collection from the deli in Solihull, 25% deposit, 48 hours' notice.",
  );
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Platter[] | null>(null);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);

  useEffect(() => {
    api.boards().then(setBoards).catch(() => setBoards([]));
    api.categories().then(setCounts).catch(() => setCounts(null));
  }, []);

  const startOrder = (p: Platter) => {
    addBoard(p.id);
    openCartDrawer();
  };

  // Group first, then split by tier on the leading variant — otherwise a board whose sizes
  // sit in different tiers would appear twice.
  const groups = groupVariants(boards ?? []);
  const signature = groups.filter((g) => g.lead.tier === "signature");
  const gallery = groups.filter((g) => g.lead.tier !== "signature");

  return (
    <div className="app app-wide platters-page">
      <Header />
      <h1 className="page-h">Order a board</h1>
      {counts?.reviewRating && <Stars rating={counts.reviewRating} count={counts.reviewCount} />}
      <DeadlineChip />

      <button className="plan-banner" onClick={() => navigate("/plan")}>
        <span className="pb-title">Catering for a group?</span>
        <span className="pb-sub">Plan my event — we&apos;ll suggest the right spread →</span>
      </button>

      {boards === null && <p className="muted">Loading boards…</p>}

      {signature.length > 0 && (
        <section className="board-section">
          <h2 className="section-h">Signature boards</h2>
          <div className="board-grid">
            {signature.map((g, i) => {
              const p = g.lead;
              const toDetail = (e: React.MouseEvent<HTMLElement>) =>
                morphNavigate(
                  navigate,
                  `/platter/${p.id}`,
                  e.currentTarget.closest("article")?.querySelector(".board-card-img") as HTMLElement | null,
                );
              return (
                <article key={p.id} className="board-card card" data-reveal data-reveal-delay={String(i % 2)}>
                  <div
                    className="board-card-img"
                    style={{ backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : undefined }}
                    role="img"
                    aria-label={p.name}
                  />
                  <div className="board-card-body">
                    <h3 className="board-card-name">{p.name}</h3>
                    <p className="board-card-price">{priceFeeds(g)}</p>
                    <p className="board-card-desc muted">{p.description.replace(/\s*\[CHECK PRICE.*?\]\s*$/i, "")}</p>
                    <div className="board-card-actions">
                      {/* One-tap add only makes sense when there is nothing to choose. With sizes,
                          the primary button opens the page where the choice is made. */}
                      {g.hasChoice ? (
                        <button className="btn" onClick={toDetail}>
                          Choose a size · {g.variants.length} options
                        </button>
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
      )}

      {gallery.length > 0 && (
        <section className="board-section">
          <h2 className="section-h">More boards</h2>
          <div className="board-grid">
            {gallery.map((g) => (
              <button
                key={g.lead.id}
                className="gallery-card card"
                data-reveal
                onClick={(e) => morphNavigate(navigate, `/platter/${g.lead.id}`, e.currentTarget.querySelector(".board-card-img") as HTMLElement | null)}
              >
                <div
                  className="board-card-img"
                  style={{ backgroundImage: g.lead.imageUrl ? `url(${g.lead.imageUrl})` : undefined }}
                  role="img"
                  aria-label={g.lead.name}
                />
                <div className="board-card-body">
                  <h3 className="board-card-name">{g.lead.name}</h3>
                  <p className="board-card-price">{priceFeeds(g)}</p>
                  <span className="board-card-go">{g.hasChoice ? `${g.variants.length} sizes →` : "View →"}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {boards !== null && boards.length === 0 && (
        <p className="muted">Our boards are being updated — please check back shortly.</p>
      )}

      <Faq />

      <StickyCta label="Plan my event" to="/plan" />
    </div>
  );
}
