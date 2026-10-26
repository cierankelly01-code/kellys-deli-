import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, type CategoryCounts, type LocationT, type OpeningHours, type Platter, type ShopCategory } from "../lib/api";
import { addBoard } from "../lib/cart";
import { openCartDrawer } from "../components/CartDrawer";
import { gbp } from "../lib/format";
import { Header } from "../components/Header";
import { StickyCta } from "../components/StickyCta";
import { Faq } from "../components/Faq";
import { DeadlineChip, Stars, TrustChips } from "../components/Trust";
import { morphNavigate } from "../lib/motion";
import { groupVariants, cheapestVariant, type ProductGroup } from "../lib/variants";
import { Bundles } from "../components/Bundles";
import { ReminderCapture } from "../components/ReminderCapture";
import { DeliVideos } from "../components/DeliVideos";

const DAY_LABELS: Array<{ key: keyof OpeningHours; label: string }> = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];

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
  const target = g.hasChoice ? cheapestVariant(g) : g.lead;
  const price = g.hasChoice ? `From ${gbp(g.fromPrice)}` : gbp(target.fixedPrice ?? target.fromPrice ?? 0);
  return target.serves ? `${price} · feeds ${target.serves}` : price;
}

export default function Choice() {
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [boards, setBoards] = useState<Platter[] | null>(null);
  const [boardsError, setBoardsError] = useState(false);
  const [shopCats, setShopCats] = useState<ShopCategory[]>([]);
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [openHoursFor, setOpenHoursFor] = useState<string | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const src = params.get("src");
  const suffix = src ? `?src=${encodeURIComponent(src)}` : "";

  useEffect(() => {
    api.categories().then(setCounts).catch(() => setCounts(null));
    api.boards("signature").then(setBoards).catch(() => { setBoards([]); setBoardsError(true); });
    api.shopCategories().then(setShopCats).catch(() => setShopCats([]));
    api.locations().then(setLocations).catch(() => setLocations([]));
  }, []);

  const go = (path: string) => navigate(`${path}${suffix}`);
  const startOrder = (p: Platter) => {
    addBoard(p.id);
    openCartDrawer();
  };

  // Per-shop hours (real, admin-set) fall back to the legacy global setting only for a
  // shop that hasn't had its own hours filled in yet.
  const fallbackHours = parseHours(counts?.openingHours ?? null);
  const shopsWithHours = locations
    .filter((l) => l.active)
    .map((l) => ({ location: l, hours: (l.openingHours as OpeningHours | null) ?? fallbackHours }))
    .filter((s): s is { location: LocationT; hours: OpeningHours } => !!s.hours);
  const today = DAY_LABELS[(new Date().getDay() + 6) % 7];
  // One tile per board, not one per size (see lib/variants).
  const signature = groupVariants(boards ?? []).slice(0, 6);

  const catImage = (slug: string, fallback: string) => shopCats.find((c) => c.slug === slug)?.heroImageUrl || fallback;

  // The six doors into the shop — the first thing on the page, so "what can I actually
  // get here?" never needs a scroll to answer. Replaces the old boards-first hero.
  const MAIN_CATEGORIES: Array<{ label: string; eyebrow: string; to: string; image: string }> = [
    { label: "Lunch", eyebrow: "Order for tomorrow", to: "/lunch", image: "/images/grocery-ham-cheese.webp" },
    { label: "Deli Counter", eyebrow: "Click & collect", to: "/groceries", image: "/images/groceries-counter.webp" },
    { label: "At Home Dining", eyebrow: "A night in, sorted", to: "/shop/at-home", image: catImage("at-home", "/images/board-grazing-table.webp") },
    { label: "Events", eyebrow: "Birthdays & celebrations", to: "/shop/hosting", image: catImage("hosting", "/images/board-ultimate.webp") },
    { label: "Office & Catering", eyebrow: "Meetings & team lunches", to: "/office-catering", image: catImage("office-corporate", "/images/board-antipasti.webp") },
    { label: "Boards & Catering", eyebrow: "Any occasion", to: "/platters", image: "/images/catering-counter.webp" },
  ];

  return (
    <div className="choice">
      <Header />

      <section className="main-cats-section" data-reveal>
        <p className="deli-eyebrow main-cats-eyebrow">A little something worth sharing</p>
        <h1 className="main-cats-h">What can we get you?</h1>
        <div className="main-cats-grid">
          {MAIN_CATEGORIES.map((c, i) => (
            <button key={c.label} className="main-cat-card" data-reveal data-reveal-delay={String(i % 3)} onClick={() => go(c.to)}>
              <img src={c.image} alt="" loading={i < 3 ? "eager" : "lazy"} />
              <span className="main-cat-caption">
                <span className="main-cat-eyebrow">{c.eyebrow}</span>
                <span className="main-cat-name">{c.label}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Statement band — the brand promise in one line, with the social proof beneath it. */}
      <div className="trust-strip">
        <span className="statement-line">Independent, family-run, and prepared for your occasion.</span>
        {counts?.reviewRating && <Stars rating={counts.reviewRating} count={counts.reviewCount} />}
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
            <div>
              <p className="deli-eyebrow">From the deli counter</p>
              <h2 className="section-h" style={{ margin: 0 }}>Made for the middle of the table.</h2>
              <DeadlineChip />
            </div>
            <button className="btn-ghost" onClick={() => go("/platters")}>See all →</button>
          </div>
          {signature.length === 0 ? (
            <p className={boardsError ? "notice danger" : "muted"} role="status">
              {boards === null ? "Bringing you our boards…" : boardsError ? "We couldn't load our boards just now — please refresh." : "Our board selection is being updated. Browse the shop for what’s available."} {boards !== null && !boardsError && <Link to="/shop">Browse the shop →</Link>}
            </p>
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
        </section>

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

        {shopsWithHours.length > 0 && (
          <div className="info-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            {shopsWithHours.map(({ location, hours }) => (
              <div key={location.id} className="card hours-card">
                <button className="hours-status" onClick={() => setOpenHoursFor((cur) => (cur === location.id ? null : location.id))}>
                  <span className={`status-dot ${computeOpenStatus(hours).open ? "open" : "closed"}`} aria-hidden="true" />
                  <span className="hours-status-text">{location.name} · {computeOpenStatus(hours).text}</span>
                  <span className="hours-toggle">{openHoursFor === location.id ? "Hide hours ▲" : "Full hours ▼"}</span>
                </button>
                {openHoursFor === location.id && (
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
            ))}
          </div>
        )}

        <ReminderCapture />
        <Faq />
      </div>
      <StickyCta label="Order a board" to={`/platters${suffix}`} />
    </div>
  );
}
