import { useEffect, useId, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, type CategoryCounts, type Platter, type ShopCategory } from "../lib/api";
import { StickyCta } from "../components/StickyCta";
import { Faq, DEFAULT_FAQ, type FaqItem } from "../components/Faq";
import { DeadlineChip, Stars, TrustChips } from "../components/Trust";
import { groupVariants, type ProductGroup } from "../lib/variants";
import { Bundles } from "../components/Bundles";
import { ReminderCapture } from "../components/ReminderCapture";
import { DeliVideos } from "../components/DeliVideos";
import { useSeason } from "../lib/season";
import { ProductArt, artKind } from "../components/ProductArt";
import { Crest, Ornament } from "../components/BrandMark";
import { ProductCard } from "../components/site/ProductCard";
import { SectionHead } from "../components/site/SectionHead";
import { orderByLabel, orderingClosed } from "../lib/preorder";
import { DAY_LABELS, openStatus, parseHours, SHOP_ADDRESS, SHOP_MAP_URL, todayIndex } from "../lib/hours";

/* The homepage is the front door: one campaign up top, then a doorway for each of the four
 * kinds of customer (Christmas, a board for tonight, catering for a crowd, click & collect),
 * then the shelves and the deli itself. Every fact on it comes from the API or site settings. */

// Fallback art for an occasion with no photo, by slug (anything else gets a platter).
const OCCASION_ART: Record<string, string> = {
  christmas: "The Kelly's Christmas Hamper",
  hosting: "Party Platter",
  "at-home": "Cheese Board",
  "office-corporate": "Sliced meats from the counter",
};

// Order of preference for the Christmas edit, matched against section + product name.
const SHELF_PRIORITY = [/\bhams?\b/i, /turkey/i, /cheese/i, /hamper|gift/i];

/** Boards with names the engraved set doesn't recognise ("The Date Night") would fall back to
 * a gift box. Give the art a hint from the description instead — only the drawing reads
 * `section` for these, and nothing on this page shows it. */
function withArtHint(g: ProductGroup): ProductGroup {
  const p = g.lead;
  if (p.imageUrl || artKind(p.name, p.section) !== "gift" || /gift|hamper/i.test(p.name)) return g;
  const hint = /cheese/i.test(p.description) ? "Cheese" : /cuts|charcuterie|ham|salami|meat/i.test(p.description) ? "Sliced meats" : "Cheese";
  return { ...g, lead: { ...p, section: hint } };
}

type Door = {
  key: string;
  eyebrow: string;
  title: string;
  line: string;
  cta: string;
  to: string;
  art: JSX.Element;
  note?: string | null;
};

export default function Choice() {
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [boards, setBoards] = useState<Platter[] | null>(null);
  const [shopCats, setShopCats] = useState<ShopCategory[]>([]);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const src = params.get("src");
  const suffix = src ? `?src=${encodeURIComponent(src)}` : "";
  const { season } = useSeason();
  const xmas = season === "christmas";

  useEffect(() => {
    api.categories().then(setCounts).catch(() => setCounts(null));
    api.boards("signature").then(setBoards).catch(() => setBoards([]));
    api.shopCategories().then(setShopCats).catch(() => setShopCats([]));
  }, []);

  // The curated shelf: the Christmas range in season, boards for a night in otherwise.
  const [shelfRange, setShelfRange] = useState<Platter[] | null>(null);
  useEffect(() => {
    setShelfRange(null);
    api.shopCategory(xmas ? "christmas" : "at-home")
      .then((c) => setShelfRange(c.boards ?? []))
      .catch(() => setShelfRange([]));
  }, [xmas]);

  const shelf = (() => {
    const groups = groupVariants((shelfRange ?? []).filter((p) => !orderingClosed(p)));
    if (!xmas) return groups.slice(0, 4).map(withArtHint);
    // One pick per section rather than three hams — the centrepieces first (ham, turkey,
    // cheese, a hamper), then whatever else the menu holds.
    const seen = new Set<string>();
    const firstOfEach = groups.filter((g) => {
      const s = g.lead.section ?? g.lead.id;
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
    const rank = (g: (typeof groups)[number]) => {
      const i = SHELF_PRIORITY.findIndex((re) => re.test(`${g.lead.section ?? ""} ${g.lead.name}`));
      return i < 0 ? SHELF_PRIORITY.length : i;
    };
    const picks = [...firstOfEach].sort((a, b) => rank(a) - rank(b));
    return [...picks, ...groups.filter((g) => !picks.includes(g))].slice(0, 4);
  })();

  // The next Christmas order-by date, straight from the products.
  const nextDeadline = (() => {
    if (!xmas || !shelfRange) return null;
    const open = shelfRange.filter((p) => p.orderBy && !orderingClosed(p));
    if (!open.length) return null;
    const first = open.reduce((a, b) => (new Date(a.orderBy!).getTime() <= new Date(b.orderBy!).getTime() ? a : b));
    return { name: first.name, label: orderByLabel(first.orderBy) };
  })();

  // One tile per board, not one per size (see lib/variants).
  const signature = groupVariants(boards ?? []).slice(0, 8).map(withArtHint);
  const occasions = shopCats.filter((c) => xmas || c.slug !== "christmas");
  const hours = parseHours(counts?.openingHours ?? null);
  const status = hours ? openStatus(hours) : null;
  const today = todayIndex();
  const paymentsLive = !!counts?.paymentsLive;

  const doors: Door[] = [
    ...(xmas
      ? [{
          key: "christmas",
          eyebrow: "Christmas",
          title: "Sort my Christmas",
          line: "Hams, turkey, party food, cheese and hampers, collected in December.",
          cta: "Order your Christmas",
          to: "/christmas",
          art: <ProductArt name="Honey Roast Ham" className="door-art" fit="meet" />,
          note: nextDeadline?.label ?? null,
        }]
      : []),
    {
      key: "board",
      eyebrow: "Tonight or this weekend",
      title: "A board for tonight",
      line: "Cheese and grazing boards for two to eight, made up for you to collect.",
      cta: "Choose a board",
      to: "/platters",
      art: <ProductArt name="Cheese Board" className="door-art" fit="meet" />,
    },
    {
      key: "catering",
      eyebrow: "Parties, offices, christenings",
      title: "Feeding a crowd",
      line: "Tell us how many are coming and we’ll suggest the spread.",
      cta: "Plan my event",
      to: "/plan",
      art: <PlatterArt className="door-art" />,
    },
    {
      key: "collect",
      eyebrow: "Click & collect",
      title: "Bread & bits to collect",
      line: "Pre-order fresh bread and pick it up from the counter. Pay when you collect.",
      cta: "Order bread",
      to: "/bread",
      art: <LoafArt className="door-art" />,
    },
  ];

  const faq: FaqItem[] = xmas
    ? [
        {
          q: "How does Christmas ordering work?",
          a: paymentsLive
            ? "Choose your Christmas food, pick a collection day and pay in full online when you order. Each item shows its own order-by date and the days it can be collected."
            : "Choose your Christmas food, pick a collection day and send your order — we’ll confirm it with you. Each item shows its own order-by date and the days it can be collected.",
        },
        ...DEFAULT_FAQ,
      ]
    : DEFAULT_FAQ;

  return (
    <div className={`home${xmas ? " is-xmas" : " is-classic"}`}>
      {/* 1 · Campaign */}
      <section className="home-hero" aria-labelledby="home-hero-h">
        <div className="wrap home-hero-inner">
          <div className="home-hero-copy">
            <p className="eyebrow">{xmas ? "The Christmas Collection · Orders open" : "Kelly’s Deli · Bentley Heath"}</p>
            {xmas ? (
              <h1 id="home-hero-h" className="home-hero-h">Christmas <em>at Kelly&apos;s</em></h1>
            ) : (
              <h1 id="home-hero-h" className="home-hero-h">The deli counter, <em>at your table</em></h1>
            )}
            <Ornament className="ornament home-hero-orn" />
            <p className="home-hero-promise">
              {xmas
                ? `Hams, turkey, party food, cheese and hampers. Order now${paymentsLive ? ", pay online" : ""} and collect any day in December.`
                : "Hand-built boards, generous platters and fresh bread. Order online and collect from the deli."}
            </p>
            <div className="home-hero-actions">
              {xmas ? (
                <>
                  <Link className="btn home-btn-gold" to={`/christmas${suffix}`}>Order your Christmas</Link>
                  <Link className="btn btn-secondary home-btn-line" to={`/plan${suffix}`}>Plan a Christmas party</Link>
                </>
              ) : (
                <>
                  <Link className="btn" to={`/platters${suffix}`}>Explore our boards</Link>
                  <Link className="btn btn-secondary" to={`/plan${suffix}`}>Catering for a crowd</Link>
                </>
              )}
            </div>
            <div className="home-hero-meta">
              {counts?.reviewRating && <Stars rating={counts.reviewRating} count={counts.reviewCount} />}
              {nextDeadline?.label && <p className="home-hero-deadline">{nextDeadline.name}: {nextDeadline.label.toLowerCase()}</p>}
            </div>
          </div>
          <figure className={`home-hero-art${counts?.heroImageUrl ? " has-photo" : ""}`}>
            {counts?.heroImageUrl ? (
              <img src={counts.heroImageUrl} alt={xmas ? "Christmas food from Kelly’s Deli" : "A board from Kelly’s Deli"} width="1000" height="800" {...{ fetchpriority: "high" }} />
            ) : (
              <>
                <div className="home-hero-plate">
                  {xmas
                    ? <ProductArt name="Honey Roast Ham" className="home-hero-main" />
                    : <ProductArt name="Sliced meats from the counter" className="home-hero-main" />}
                </div>
                <div className="home-hero-label" aria-hidden="true">
                  {xmas
                    ? <ProductArt name="The Kelly's Christmas Hamper" className="home-hero-small" fit="meet" />
                    : <LoafArt className="home-hero-small" />}
                </div>
              </>
            )}
          </figure>
        </div>
      </section>


      {counts?.firstOrderHook && counts.firstOrderHookText && (
        <p className="home-firstorder">
          <span className="home-firstorder-k">First order?</span> {counts.firstOrderHookText} — on us.
        </p>
      )}

      {/* 2 · Doorways, one per customer */}
      <section className="home-doors" aria-labelledby="home-doors-h">
        <div className="wrap">
          <h2 id="home-doors-h" className="home-doors-h">How can we help?</h2>
          <ul className={`home-door-list is-${doors.length}`}>
            {doors.map((d) => (
              <li key={d.key}>
                <Link className={`home-door is-${d.key}`} to={`${d.to}${suffix}`}>
                  <span className="home-door-art">{d.art}</span>
                  <span className="home-door-body">
                    <span className="home-door-eyebrow">{d.eyebrow}</span>
                    <span className="home-door-title">{d.title}</span>
                    <span className="home-door-line">{d.line}</span>
                    <span className="home-door-cta">{d.cta}<span aria-hidden="true"> →</span></span>
                    {d.note && <span className="home-door-note">{d.note}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {counts?.reviewRating && <div className="home-doors-stars"><Stars rating={counts.reviewRating} count={counts.reviewCount} /></div>}
        </div>
      </section>

      <ul className="home-strip" aria-label="About Kelly’s">
        <li>Independent &amp; family-run</li>
        <li>Made in Bentley Heath</li>
        <li>Prepared for your occasion</li>
      </ul>

      {/* 3 · Curated shelf */}
      {shelf.length > 0 && (
        <section className="section home-shelf" aria-labelledby="home-shelf-h">
          <div className="wrap">
            <SectionHead
              id="home-shelf-h"
              align="left"
              eyebrow={xmas ? "Christmas pre-orders are open" : "For a night in"}
              title={xmas ? "The Christmas edit." : "Something lovely for tonight."}
              intro={xmas
                ? "Picks from the Christmas menu. Every item shows its own order-by date and the days it can be collected."
                : "Smaller boards with a bit of personality, for two to four."}
              action={xmas ? { to: `/christmas${suffix}`, label: "The full Christmas menu" } : { to: `/shop/at-home${suffix}`, label: "All boards for home" }}
            />
            <div className={shelf.length >= 4 ? "shelf" : "pgrid"}>
              {shelf.map((g) => (
                <ProductCard key={g.lead.id} group={g} suffix={suffix} eyebrow={xmas ? g.lead.section : null} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4 · Signature boards */}
      <section className={`section home-boards${xmas ? " is-paper" : ""}`} aria-labelledby="home-boards-h">
        <div className="wrap">
          <SectionHead
            id="home-boards-h"
            align="left"
            eyebrow="From the deli counter"
            title="Made for the middle of the table."
            intro="Our signature boards and platters, built by hand to order. Choose a size by how many you’re feeding."
            action={{ to: `/platters${suffix}`, label: "All boards & platters" }}
          />
          {signature.length === 0 ? (
            <p className="home-empty" role="status">
              {boards === null ? "Bringing you our boards…" : "Our board selection is being updated. Browse the shop for what’s available. "}
              {boards !== null && <Link to={`/shop${suffix}`}>Browse the shop →</Link>}
            </p>
          ) : (
            <div className={`pgrid${signature.length % 4 === 0 ? " is-4" : ""}`}>
              {signature.map((g) => (
                <ProductCard key={g.lead.id} group={g} suffix={suffix} />
              ))}
            </div>
          )}
          <div className="home-boards-foot"><DeadlineChip /></div>
        </div>
      </section>

      {/* 5 · Catering, for the customer feeding a crowd */}
      <section className="section is-green home-catering" aria-labelledby="home-catering-h">
        <div className="wrap home-catering-inner">
          <div className="home-catering-copy">
            <p className="eyebrow">Catering &amp; events</p>
            <h2 id="home-catering-h" className="home-catering-h">Feeding twenty? <em>Leave it with us.</em></h2>
            <p>
              Birthdays, christenings, family get-togethers and office lunches. Tell us your numbers and we’ll suggest platters sized to
              match — then you choose a collection day.
            </p>
            <div className="home-catering-actions">
              <button type="button" className="btn home-btn-gold" onClick={() => navigate(`/plan${suffix}`)}>Plan my event</button>
              <Link className="btn btn-secondary home-btn-line" to={`/shop/office-corporate${suffix}`}>Office &amp; standing orders</Link>
            </div>
          </div>
          <div className="home-catering-how">
            <p className="home-catering-how-h">How it works</p>
            <ol className="home-steps">
              <li><span className="home-step-n" aria-hidden="true">i.</span><span><strong>Tell us your numbers</strong>The planner suggests a spread for your headcount — swap anything you like.</span></li>
              <li><span className="home-step-n" aria-hidden="true">ii.</span><span><strong>Choose your day</strong>Pick a collection date with at least 48 hours’ notice.</span></li>
              <li><span className="home-step-n" aria-hidden="true">iii.</span><span><strong>Collect &amp; serve</strong>We build it fresh for the day. Lift the lid, take the credit.</span></li>
            </ol>
            <TrustChips />
          </div>
        </div>
      </section>

      {/* 6 · Shop by occasion */}
      {occasions.length > 0 && (
        <section className="section home-occasions" aria-labelledby="home-occ-h">
          <div className="wrap">
            <SectionHead
              id="home-occ-h"
              align="left"
              eyebrow="Shop by occasion"
              title="Every occasion, well fed."
              action={{ to: `/shop${suffix}`, label: "Shop all occasions" }}
            />
            <div className={`home-occ-grid is-${Math.min(occasions.length, 4)}`}>
              {occasions.map((c) => (
                <Link key={c.id} className="occasion-card home-occ" to={`/shop/${c.slug}${suffix}`}>
                  <span className="home-occ-media">
                    {c.heroImageUrl
                      ? <img src={c.heroImageUrl} alt="" loading="lazy" width="640" height="480" />
                      : <ProductArt name={OCCASION_ART[c.slug] ?? "Party Platter"} className="home-occ-art" />}
                  </span>
                  <span className="home-occ-body">
                    <span className="occasion-name home-occ-name">{c.name}</span>
                    {c.tagline && <span className="home-occ-tag">{c.tagline}</span>}
                    <span className="home-occ-go">
                      {c.boardCount} {c.slug === "christmas" ? "to choose from" : `board${c.boardCount === 1 ? "" : "s"}`}<span aria-hidden="true"> →</span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Ready-made combos (renders nothing until the owner creates one) */}
      <div className="wrap home-bundles"><Bundles /></div>

      {/* 7 · The deli, and how to find it */}
      <section className="section is-paper home-deli" aria-labelledby="home-deli-h" id="visit">
        <div className="wrap home-deli-inner">
          <div className="home-story">
            <p className="eyebrow">The deli</p>
            <h2 id="home-deli-h" className="home-story-h">A proper neighbourhood deli.</h2>
            {counts?.missionTagline && <p className="home-story-quote">{counts.missionTagline}</p>}
            {counts?.aboutText && <p className="home-story-text">{counts.aboutText}</p>}
            {counts?.founderNote && (
              <figure className="home-founder">
                <blockquote><p>{counts.founderNote}</p></blockquote>
                <figcaption>A note from the deli</figcaption>
              </figure>
            )}
            <p className="home-story-text">
              Pop in for your favourites, pick up something new, or let us take care of the food for your next get-together.
            </p>
          </div>
          <aside className="home-visit" aria-labelledby="home-visit-h">
            <Crest className="home-visit-crest" />
            <h3 id="home-visit-h" className="home-visit-h">Visit the deli</h3>
            <address className="home-visit-addr">
              Kelly&apos;s Deli<br />
              {SHOP_ADDRESS.split(", ").map((l) => <span key={l}>{l}<br /></span>)}
            </address>
            <a className="home-visit-map" href={SHOP_MAP_URL} target="_blank" rel="noopener noreferrer">Get directions<span className="visually-hidden"> (opens Google Maps)</span></a>
            {hours && status && (
              <>
                <p className={`home-visit-status${status.open ? " is-open" : ""}`}>
                  <span className="home-visit-dot" aria-hidden="true" />{status.text}
                </p>
                <dl className="home-hours">
                  {DAY_LABELS.map((d, i) => (
                    <div key={d.key} className={i === today ? "is-today" : undefined}>
                      <dt>{d.long}</dt>
                      <dd>{hours[d.key]}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <div className="home-visit-cc">
              <p>Click &amp; collect: order ahead online and pick up from the counter.</p>
              <Link className="btn btn-secondary" to={`/bread${suffix}`}>Order bread to collect</Link>
            </div>
          </aside>
        </div>
      </section>

      <div className="wrap home-videos"><DeliVideos /></div>

      {/* 8 · Keep in touch + questions */}
      <section className="section home-keep" aria-label="Reminders and offers">
        <div className="wrap">
          <ReminderCapture />
          <div className="home-referral">
            <Ornament className="ornament home-referral-orn" />
            <p className="home-referral-h">Refer a friend, you both get £15 off</p>
            <p className="home-referral-p">Every order gives you a code to share — it turns up on your confirmation page.</p>
          </div>
        </div>
      </section>

      <div className="wrap-narrow home-faq">
        <Faq questions={faq} eyebrow="Good to know" />
      </div>

      <StickyCta label={xmas ? "Order your Christmas" : "Order a board"} to={xmas ? `/christmas${suffix}` : `/platters${suffix}`} />
    </div>
  );
}

/* ---------- Engraved art the shared set doesn't cover ----------
 * Drawn in the same manner as ProductArt (single ink line work, hatched shading, a fine
 * double oval in gold on a warm ground) so they sit beside it without a seam. */

const INK = "#16352c";
const GOLD = "#a98a4f";
const PAPER = "#fbf7ef";
const GROUND = "#f3ecdf";
const stroke = { fill: "none", stroke: INK, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Frame({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <svg className={`product-art${className ? ` ${className}` : ""}`} viewBox="0 0 400 300" role="img" aria-label={`Illustration: ${label}`} preserveAspectRatio="xMidYMid meet">
      <rect width="400" height="300" fill={GROUND} />
      <ellipse cx="200" cy="152" rx="174" ry="124" fill={PAPER} opacity=".6" />
      <g fill="none" stroke={GOLD}>
        <ellipse cx="200" cy="152" rx="182" ry="132" strokeWidth="1.2" />
        <ellipse cx="200" cy="152" rx="175" ry="125" strokeWidth="0.6" />
      </g>
      {children}
    </svg>
  );
}

function HatchIn({ id, d, gap = 4.2, slant = 0.3, opacity = 0.5 }: { id: string; d: string; gap?: number; slant?: number; opacity?: number }) {
  const lines = [];
  for (let x = 20; x < 400; x += gap) lines.push(<line key={x} x1={x} y1={280} x2={x + 240 * slant} y2={40} />);
  return (
    <g>
      <defs><clipPath id={id}><path d={d} /></clipPath></defs>
      <g clipPath={`url(#${id})`} stroke={INK} strokeWidth="0.9" opacity={opacity}>{lines}</g>
    </g>
  );
}

function BoardBase({ cy = 216, rx = 132 }: { cy?: number; rx?: number }) {
  return (
    <g {...stroke}>
      <path d={`M${200 - rx} ${cy} v7 a${rx} 24 0 0 0 ${rx * 2} 0 v-7`} fill={PAPER} />
      <ellipse cx="200" cy={cy} rx={rx} ry="24" fill={PAPER} />
      <path d={`M${200 - rx + 30} ${cy - 6} q60 -8 120 -4 M${200 - rx + 60} ${cy + 8} q70 -6 150 0`} strokeWidth="0.9" opacity=".5" />
    </g>
  );
}

/** A bloomer and a baguette on a bread board, with an ear of wheat. */
function LoafArt({ className }: { className?: string }) {
  const uid = `la${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const loaf = "M98 204 C 92 150, 140 116, 196 114 C 258 112, 304 146, 300 204 Z";
  const slashes = [[136, 146], [168, 128], [200, 120], [232, 124], [264, 138]];
  return (
    <Frame label="A loaf and a baguette" className={className}>
      <BoardBase />
      <path d={loaf} fill={PAPER} />
      <HatchIn id={`${uid}-a`} d="M244 118 C 280 128, 304 160, 300 204 L 252 204 C 262 170, 262 140, 244 118 Z" gap={4} slant={0.12} opacity={0.55} />
      <HatchIn id={`${uid}-b`} d="M98 204 C 96 186, 100 170, 108 160 C 108 178, 112 194, 122 204 Z" gap={4} slant={0.12} opacity={0.35} />
      <path d={loaf} {...stroke} strokeWidth={2.4} />
      <g {...stroke} strokeWidth={1.6}>
        {slashes.map(([x, y]) => <path key={x} d={`M${x - 14} ${y + 4} C ${x - 4} ${y + 2}, ${x + 6} ${y + 10}, ${x + 12} ${y + 22}`} />)}
      </g>
      <g {...stroke} strokeWidth={0.9} opacity=".55">
        {slashes.map(([x, y]) => <path key={x} d={`M${x - 10} ${y + 9} C ${x - 2} ${y + 8}, ${x + 4} ${y + 14}, ${x + 8} ${y + 24}`} />)}
      </g>
      <g transform="rotate(-9 250 222)">
        <rect x="150" y="210" width="210" height="26" rx="13" fill={PAPER} {...stroke} strokeWidth={2.2} />
        <HatchIn id={`${uid}-c`} d="M150 226 L 360 226 L 360 236 L 150 236 Z" gap={3.4} slant={0.05} opacity={0.5} />
        <g {...stroke} strokeWidth={1.4}>
          {[180, 214, 248, 282, 316].map((x) => <path key={x} d={`M${x} 228 q 10 -10 22 -12`} />)}
        </g>
      </g>
      <g {...stroke} strokeWidth={1.3}>
        <path d="M70 236 C 74 200, 80 170, 92 140" />
        {Array.from({ length: 6 }, (_, i) => {
          const y = 150 + i * 13;
          const x = 90 - i * 2.6;
          return (
            <g key={i}>
              <ellipse cx={x - 6} cy={y} rx="3.6" ry="7.5" transform={`rotate(-28 ${x - 6} ${y})`} fill={PAPER} />
              <ellipse cx={x + 6} cy={y - 3} rx="3.6" ry="7.5" transform={`rotate(24 ${x + 6} ${y - 3})`} fill={PAPER} />
            </g>
          );
        })}
        <path d="M94 136 l 4 -16 M90 138 l -6 -14" strokeWidth={0.9} />
      </g>
    </Frame>
  );
}

/** A party platter: finger sandwiches, sausage rolls and a dip. */
function PlatterArt({ className }: { className?: string }) {
  const uid = `pt${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const sandwiches = [[86, 204], [110, 196], [134, 190], [158, 186], [104, 222], [128, 214], [152, 208]];
  const rolls = [[226, 188], [256, 190], [286, 194], [240, 206], [270, 210], [300, 212]];
  return (
    <Frame label="A party platter" className={className}>
      <g {...stroke} strokeWidth={2.2}>
        <path d="M40 204 v9 a160 46 0 0 0 320 0 v-9" fill={PAPER} />
        <ellipse cx="200" cy="204" rx="160" ry="46" fill={PAPER} />
        <ellipse cx="200" cy="204" rx="146" ry="38" strokeWidth={0.9} opacity=".6" />
      </g>
      {sandwiches.map(([x, y], i) => (
        <g key={`s${i}`}>
          <path d={`M${x} ${y} L ${x + 14} ${y - 36} L ${x + 28} ${y} Z`} fill={PAPER} {...stroke} strokeWidth={1.7} />
          <path d={`M${x + 14} ${y - 36} L ${x + 22} ${y - 30} L ${x + 34} ${y - 4} L ${x + 28} ${y}`} fill={PAPER} {...stroke} strokeWidth={1.4} />
          <HatchIn id={`${uid}-s${i}`} d={`M${x + 14} ${y - 36} L ${x + 22} ${y - 30} L ${x + 34} ${y - 4} L ${x + 28} ${y} Z`} gap={2.8} slant={0} opacity={0.6} />
          <path d={`M${x + 6} ${y - 14} L ${x + 22} ${y - 14}`} {...stroke} strokeWidth={0.9} opacity=".7" />
        </g>
      ))}
      {rolls.map(([x, y], i) => (
        <g key={`r${i}`} transform={`rotate(-8 ${x} ${y})`}>
          <rect x={x - 14} y={y - 9} width="28" height="18" rx="8" fill={PAPER} {...stroke} strokeWidth={1.6} />
          <HatchIn id={`${uid}-r${i}`} d={`M${x - 14} ${y + 2} L ${x + 14} ${y + 2} L ${x + 14} ${y + 9} L ${x - 14} ${y + 9} Z`} gap={2.6} slant={0.2} opacity={0.55} />
          <path d={`M${x - 6} ${y - 7} l 4 6 M${x + 2} ${y - 7} l 4 6`} {...stroke} strokeWidth={1} />
        </g>
      ))}
      <g {...stroke} strokeWidth={1.8}>
        <path d="M184 228 q 16 14 32 0" fill={PAPER} />
        <ellipse cx="200" cy="228" rx="16" ry="6" fill={PAPER} />
      </g>
      <g {...stroke} strokeWidth={1.4} fill={PAPER}>
        {[[318, 226], [330, 220], [326, 232], [340, 228]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="6" />)}
      </g>
    </Frame>
  );
}
