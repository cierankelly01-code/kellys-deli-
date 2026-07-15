import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CategoryCounts, type Platter } from "../lib/api";
import { addBoard } from "../lib/cart";
import { openCartDrawer } from "../components/CartDrawer";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { StickyCta } from "../components/StickyCta";
import { Header } from "../components/Header";
import { Faq } from "../components/Faq";
import { DeadlineChip, Stars } from "../components/Trust";
import { morphNavigate } from "../lib/motion";

/** Price + feeds line, e.g. "£60 · feeds 8–10". */
function priceFeeds(p: Platter): string {
  const price = gbp(p.fixedPrice ?? p.fromPrice ?? 0);
  return p.serves ? `${price} · feeds ${p.serves}` : price;
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

  const signature = boards?.filter((b) => b.tier === "signature") ?? [];
  const gallery = boards?.filter((b) => b.tier !== "signature") ?? [];

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
            {signature.map((p, i) => (
              <article key={p.id} className="board-card card" data-reveal data-reveal-delay={String(i % 2)}>
                <div
                  className="board-card-img"
                  style={{ backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : undefined }}
                  role="img"
                  aria-label={p.name}
                />
                <div className="board-card-body">
                  <h3 className="board-card-name">{p.name}</h3>
                  <p className="board-card-price">{priceFeeds(p)}</p>
                  <p className="board-card-desc muted">{p.description.replace(/\s*\[CHECK PRICE.*?\]\s*$/i, "")}</p>
                  <div className="board-card-actions">
                    <button className="btn" onClick={() => startOrder(p)}>Order · {gbp(p.fixedPrice ?? 0)}</button>
                    <button
                      className="btn-ghost"
                      onClick={(e) =>
                        morphNavigate(
                          navigate,
                          `/platter/${p.id}`,
                          e.currentTarget.closest("article")?.querySelector(".board-card-img") as HTMLElement | null,
                        )
                      }
                    >
                      Details
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="board-section">
          <h2 className="section-h">More boards</h2>
          <div className="board-grid">
            {gallery.map((p) => (
              <button
                key={p.id}
                className="gallery-card card"
                data-reveal
                onClick={(e) => morphNavigate(navigate, `/platter/${p.id}`, e.currentTarget.querySelector(".board-card-img") as HTMLElement | null)}
              >
                <div
                  className="board-card-img"
                  style={{ backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : undefined }}
                  role="img"
                  aria-label={p.name}
                />
                <div className="board-card-body">
                  <h3 className="board-card-name">{p.name}</h3>
                  <p className="board-card-price">{priceFeeds(p)}</p>
                  <span className="board-card-go">View →</span>
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
