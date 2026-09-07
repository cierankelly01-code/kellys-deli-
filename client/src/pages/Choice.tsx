import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, type CategoryCounts, type OpeningHours, type Platter, type ShopCategory } from "../lib/api";
import { addBoard } from "../lib/cart";
import { openCartDrawer } from "../components/CartDrawer";
import { gbp } from "../lib/format";
import { Header } from "../components/Header";
import { StickyCta } from "../components/StickyCta";
import { Faq } from "../components/Faq";
import { DeadlineChip, Stars, TrustChips } from "../components/Trust";
import { morphNavigate } from "../lib/motion";
import { groupVariants, groupServes, type ProductGroup } from "../lib/variants";
import { Bundles } from "../components/Bundles";
import { ReminderCapture } from "../components/ReminderCapture";
import { DeliVideos } from "../components/DeliVideos";

const DAY_LABELS: Array<{ key: keyof OpeningHours; label: string }> = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];

const DEFAULT_HERO_IMG = "https://images.unsplash.com/photo-1695606392727-d8b959879721?auto=format&fit=crop&w=1400&q=70";
const DEFAULT_MISSION = "The deli your grandparents would recognise — local produce, no shortcuts, boards built the same way every time.";

function parseHours(raw: string | null): OpeningHours | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as OpeningHours; } catch { return null; }
}
function toMinutes(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}
function parseRange(str: string | undefined): [number, number] | null {
  if (!str || /closed/i.test(str)) return null;
  const [a, b] = str.split("-").map((s) => s.trim());
  const start = a ? toMinutes(a) : null;
  const end = b ? toMinutes(b) : null;
  return start != null && end != null ? [start, end] : null;
}
function fmtMinutes(mins: number): string {
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}
function computeOpenStatus(hours: OpeningHours): { open: boolean; text: string } {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dayIdx = (now.getDay() + 6) % 7;
  const todayRange = parseRange(hours[DAY_LABELS[dayIdx].key]);
  if (todayRange && nowMin >= todayRange[0] && nowMin < todayRange[1]) {
    return { open: true, text: `Open now · closes ${fmtMinutes(todayRange[1])}` };
  }
  for (let i = 0; i <= 7; i++) {
    const idx = (dayIdx + i) % 7;
    const range = parseRange(hours[DAY_LABELS[idx].key]);
    if (!range) continue;
    if (i === 0 && nowMin < range[0]) return { open: false, text: `Closed · opens today ${fmtMinutes(range[0])}` };
    if (i > 0) return { open: false, text: `Closed · opens ${DAY_LABELS[idx].label} ${fmtMinutes(range[0])}` };
  }
  return { open: false, text: "Closed" };
}

function priceFeeds(g: ProductGroup): string {
  const price = g.hasChoice ? `From ${gbp(g.fromPrice)}` : gbp(g.lead.fixedPrice ?? g.lead.fromPrice ?? 0);
  const serves = groupServes(g.variants);
  return serves ? `${price} · feeds ${serves}` : price;
}

export default function Choice() {
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [boards, setBoards] = useState<Platter[] | null>(null);
  const [shopCats, setShopCats] = useState<ShopCategory[]>([]);
  const [showHours, setShowHours] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const src = params.get("src");
  const suffix = src ? `?src=${encodeURIComponent(src)}` : "";

  useEffect(() => {
    api.categories().then(setCounts).catch(() => setCounts(null));
    api.boards("signature").then(setBoards).catch(() => setBoards([]));
    api.shopCategories().then(setShopCats).catch(() => setShopCats([]));
  }, []);

  const go = (path: string) => navigate(`${path}${suffix}`);
  const startOrder = (p: Platter) => {
    addBoard(p.id);
    openCartDrawer();
  };

  const hours = parseHours(counts?.openingHours ?? null);
  const today = DAY_LABELS[(new Date().getDay() + 6) % 7];
  // One tile per board, not one per size (see lib/variants).
  const signature = groupVariants(boards ?? []).slice(0, 6);

  return (
    <div className="choice">
      <Header />
      <header className="deli-hero">
        <div className="deli-hero-copy">
          <p className="deli-eyebrow">A little something worth sharing</p>
          <h1>The deli counter.<br /><em>At your table.</em></h1>
          <p className="deli-hero-intro">Hand-prepared boards, generous platters and deli favourites. For a table full of friends, or simply something lovely for the weekend.</p>
          <Link className="btn deli-primary" to={`/platters${suffix}`}>Explore our boards <span aria-hidden="true">↗</span></Link>
          <p className="deli-hero-note">Made to order. Collected from your local deli.</p>
          {counts?.reviewRating && <Stars rating={counts.reviewRating} count={counts.reviewCount} />}
        </div>
        <figure className="deli-hero-photo">
          <img src={counts?.heroImageUrl || DEFAULT_HERO_IMG} alt="A generous spread of cheese, charcuterie and accompaniments" width="1000" height="1100" {...{ fetchpriority: "high" }} />
          <figcaption><span>THE KELLY’S TABLE</span><span>Something for everyone.</span></figcaption>
        </figure>
      </header>

      {/* Trust strip (build spec §5.3) */}
      <div className="trust-strip">
        <span>Independent &amp; family-run</span>
        <span aria-hidden="true">·</span>
        <span>Made in Bentley Heath</span>
        <span aria-hidden="true">·</span>
        <span>Prepared for your occasion</span>
      </div>

      {counts?.firstOrderHook && counts.firstOrderHookText && (
        <div className="firstorder-band">
          <span className="fob-gift" aria-hidden="true">🎁</span>
          <span><b>First order?</b> {counts.firstOrderHookText} — on us.</span>
        </div>
      )}

      <div className="app app-wide">
        <section className="board-section">
          <div className="spread shelf-head" data-reveal>
            <div><p className="deli-eyebrow">From the deli counter</p><h2 className="section-h" style={{ margin: 0 }}>Made for the middle of the table.</h2></div>
            <button className="btn-ghost" onClick={() => go("/platters")}>See all →</button>
          </div>
          {signature.length === 0 ? (
            <p className="muted" role="status">{boards === null ? "Bringing you our boards…" : "Our board selection is being updated. Browse the shop for what’s available."} {boards !== null && <Link to="/shop">Browse the shop →</Link>}</p>
          ) : (
            <div className="board-grid">
              {signature.map((g, i) => {
                const p = g.lead;
                const toDetail = (e: React.MouseEvent<HTMLElement>) =>
                  morphNavigate(
                    navigate,
                    `/platter/${p.id}${suffix}`,
                    e.currentTarget.closest("article")?.querySelector(".board-card-img") as HTMLElement | null,
                  );
                return (
                  <article key={p.id} className="board-card card" data-reveal data-reveal-delay={String(i % 2)}>
                    <Link to={`/platter/${p.id}${suffix}`} className="deli-product-image" aria-label={`View ${p.name}`}>
                      {p.imageUrl ? <img className="board-card-img" src={p.imageUrl} alt={p.name} width="640" height="480" loading="lazy" /> : <span className="deli-image-placeholder">Kelly’s Deli<br /><small>{p.name}</small></span>}
                    </Link>
                    <div className="board-card-body">
                      <h3 className="board-card-name"><Link to={`/platter/${p.id}${suffix}`}>{p.name}</Link></h3>
                      <p className="board-card-price">{priceFeeds(g)}</p>
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
          )}
          <div data-reveal><DeadlineChip /></div>
        </section>

        {shopCats.length > 0 && (
          <section className="occasion-section" data-reveal>
            <div className="spread shelf-head">
              <div><p className="deli-eyebrow">Bring something lovely</p><h2 className="section-h" style={{ margin: 0 }}>Every occasion, well fed.</h2></div>
              <button className="btn-ghost" onClick={() => go("/shop")}>See all →</button>
            </div>
            <div className="occasion-grid">
              {shopCats.map((c, i) => (
                <button
                  key={c.id}
                  className="occasion-card card"
                  data-reveal
                  data-reveal-delay={String(i % 2)}
                  onClick={(e) =>
                    morphNavigate(navigate, `/shop/${c.slug}${suffix}`, e.currentTarget.querySelector(".occasion-img") as HTMLElement | null)
                  }
                >
                  <div className="occasion-img" style={{ backgroundImage: c.heroImageUrl ? `url(${c.heroImageUrl})` : undefined }} role="img" aria-label={c.name} />
                  <div className="occasion-body">
                    <h3 className="occasion-name">{c.name}</h3>
                    {c.tagline && <p className="occasion-tag">{c.tagline}</p>}
                    <span className="occasion-go">{c.boardCount} board{c.boardCount === 1 ? "" : "s"} →</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <Bundles />
        <DeliVideos />
        <section className="deli-story" data-reveal>
          <div><p className="deli-eyebrow">A proper neighbourhood deli</p><h2>A warm welcome.<br />A well-stocked table.</h2></div>
          <div><p>{counts?.missionTagline || DEFAULT_MISSION}</p><p>Pop in for your favourites, pick up something new, or let us take care of the food for your next get-together.</p><a className="deli-text-link" href="#our-shops">Find your local Kelly’s <span aria-hidden="true">↗</span></a></div>
        </section>

        <section className="how-it-works" data-reveal>
          <h2 className="section-h">From our counter to your table</h2>
          <ol className="hiw-steps">
            <li>
              <span className="hiw-num" aria-hidden="true">1</span>
              <h3 className="hiw-h">Pick your board</h3>
              <p>Choose your favourites, select a size and add something extra for the table.</p>
            </li>
            <li>
              <span className="hiw-num" aria-hidden="true">2</span>
              <h3 className="hiw-h">We build it fresh</h3>
              <p>We prepare your order for your occasion, ready for your chosen collection date.</p>
            </li>
            <li>
              <span className="hiw-num" aria-hidden="true">3</span>
              <h3 className="hiw-h">Collect &amp; serve</h3>
              <p>Pick it up from your chosen shop, lift the lid, take the credit.</p>
            </li>
          </ol>
        </section>

        <button className="plan-banner" onClick={() => go("/plan")}>
          <span className="pb-title">Catering for a group?</span>
          <span className="pb-sub">Plan my event — tell us your numbers and we&apos;ll suggest the spread →</span>
        </button>

        <div className="deli-reassurance"><TrustChips /></div>

        {hours && (
          <div className="info-row">
            <div className="card hours-card">
              <button className="hours-status" onClick={() => setShowHours((s) => !s)}>
                <span className={`status-dot ${computeOpenStatus(hours).open ? "open" : "closed"}`} aria-hidden="true" />
                <span className="hours-status-text">{computeOpenStatus(hours).text}</span>
                <span className="hours-toggle">{showHours ? "Hide hours ▲" : "Full hours ▼"}</span>
              </button>
              {showHours && (
                <div className="hours-grid">
                  {DAY_LABELS.map((d) => (
                    <div key={d.key} className={`hours-row${d.key === today.key ? " is-today" : ""}`}>
                      <span className="hours-day">{d.label}</span>
                      <span className="hours-time">{hours[d.key]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="referral-teaser">
          <span className="referral-teaser-title">Refer a friend, you both get £15 off</span>
          <span className="muted">Every order gives you a code to share — turns up on your confirmation page.</span>
        </div>

        <ReminderCapture />
        <Faq />
      </div>
      <StickyCta label="Order a board" to={`/platters${suffix}`} />
    </div>
  );
}
