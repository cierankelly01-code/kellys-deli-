import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, type CategoryCounts, type Platter, type ShopCategory } from "../lib/api";
import { StickyCta } from "../components/StickyCta";
import { Faq, DEFAULT_FAQ, type FaqItem } from "../components/Faq";
import { DeadlineChip, TrustChips } from "../components/Trust";
import { groupVariants } from "../lib/variants";
import { Bundles } from "../components/Bundles";
import { ReminderCapture } from "../components/ReminderCapture";
import { DeliVideos } from "../components/DeliVideos";
import { useSeason } from "../lib/season";
import { ProductCard } from "../components/site/ProductCard";
import { SectionHead } from "../components/site/SectionHead";
import { orderByLabel, orderingClosed } from "../lib/preorder";
import { DAY_LABELS, openStatus, parseHours, SHOP_ADDRESS, SHOP_MAP_URL, todayIndex } from "../lib/hours";

/* The homepage is the front door: one campaign up top, then a doorway for each of the four
 * kinds of customer (Christmas, a board for tonight, catering for a crowd, click & collect),
 * then the shelves and the deli itself. Every fact on it comes from the API or site settings.
 * Photos lead: where the owner hasn't uploaded one yet, the slot is a plain counter-colour
 * block, never a drawing. */

// Order of preference for the Christmas picks, matched against section + product name.
const SHELF_PRIORITY = [/\bhams?\b/i, /turkey/i, /cheese/i, /hamper|gift/i];

type Door = {
  key: string;
  title: string;
  line: string;
  cta: string;
  to: string;
  photo?: string | null;
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
    if (!xmas) return groups.slice(0, 4);
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
  const signature = groupVariants(boards ?? []).slice(0, 8);
  const occasions = shopCats.filter((c) => xmas || c.slug !== "christmas");
  const hours = parseHours(counts?.openingHours ?? null);
  const status = hours ? openStatus(hours) : null;
  const today = todayIndex();
  const paymentsLive = !!counts?.paymentsLive;

  // A door's photo is the owner's photo for that part of the shop. Doors show photos only
  // when every door has one, so the row reads as one set (bread has none yet).
  const catPhoto = (slug: string) => shopCats.find((c) => c.slug === slug)?.heroImageUrl ?? null;
  const doors: Door[] = [
    ...(xmas
      ? [{
          key: "christmas",
          title: "Sort my Christmas",
          line: "Hams, turkey, party food, cheese and hampers, collected in December.",
          cta: "Order your Christmas",
          to: "/christmas",
          photo: catPhoto("christmas"),
          note: nextDeadline?.label ?? null,
        }]
      : []),
    {
      key: "board",
      title: "A board for tonight",
      line: "Cheese and grazing boards for two to eight, made up for you to collect.",
      cta: "Choose a board",
      to: "/platters",
      photo: catPhoto("at-home"),
    },
    {
      key: "catering",
      title: "Feeding a crowd",
      line: "Tell us how many are coming and we’ll suggest the spread.",
      cta: "Plan my event",
      to: "/plan",
      photo: catPhoto("hosting"),
    },
    {
      key: "collect",
      title: "Bread to collect",
      line: "Pre-order fresh bread and pick it up from the counter. Pay when you collect.",
      cta: "Order bread",
      to: "/bread",
    },
  ];

  const doorPhotos = doors.every((d) => !!d.photo);
  const occPhotos = occasions.length > 0 && occasions.every((c) => !!c.heroImageUrl);

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
      {/* 1 · Campaign: the photo leads, the headline sits on it */}
      <section className="photo-hero home-hero" aria-labelledby="home-hero-h">
        <figure className="photo-hero-photo">
          {counts?.heroImageUrl && (
            <img src={counts.heroImageUrl} alt={xmas ? "Christmas food from Kelly’s Deli" : "A board from Kelly’s Deli"} width="1600" height="900" {...{ fetchpriority: "high" }} />
          )}
        </figure>
        <div className="photo-hero-copy">
          <h1 id="home-hero-h" className="photo-hero-h">
            {xmas ? "Christmas at Kelly’s" : "The deli counter, at your table"}
          </h1>
          <p className="photo-hero-sub">
            {xmas
              ? `Hams, turkey, party food, cheese and hampers. Order now${paymentsLive ? ", pay online" : ""} and collect from the shop any day in December.`
              : "Boards, platters and fresh bread, made up in the shop. Order online and collect from the counter."}
          </p>
          {nextDeadline?.label && (
            <Link className="photo-hero-note" to={`/christmas${suffix}#xmas-dates`}>{nextDeadline.name}: {nextDeadline.label.replace(/^Order/, "order")}</Link>
          )}
          <div className="photo-hero-actions">
            {xmas ? (
              <>
                <Link className="btn" to={`/christmas${suffix}`}>Order your Christmas</Link>
                <Link className="btn btn-secondary" to={`/plan${suffix}`}>Plan a Christmas party</Link>
              </>
            ) : (
              <>
                <Link className="btn" to={`/platters${suffix}`}>See the boards</Link>
                <Link className="btn btn-secondary" to={`/plan${suffix}`}>Catering for a crowd</Link>
              </>
            )}
          </div>
        </div>
      </section>

      {counts?.firstOrderHook && counts.firstOrderHookText && (
        <p className="home-firstorder wrap">
          <strong>First order?</strong> {counts.firstOrderHookText}, on us.
        </p>
      )}

      {/* 2 · Doorways, one per customer */}
      <section className="home-doors" aria-labelledby="home-doors-h">
        <div className="wrap">
          <h2 id="home-doors-h" className="home-doors-h">How can we help?</h2>
          <ul className={`home-door-list is-${doors.length}`}>
            {doors.map((d) => (
              <li key={d.key}>
                <Link className={`home-door is-${d.key}${doorPhotos ? " has-photo" : ""}`} to={`${d.to}${suffix}`}>
                  {doorPhotos && d.photo && <span className="home-door-photo"><img src={d.photo} alt="" loading="lazy" width="640" height="480" /></span>}
                  <span className="home-door-body">
                    <span className="home-door-title">{d.title}</span>
                    <span className="home-door-line">{d.line}</span>
                    {d.note && <span className="home-door-note">{d.note}</span>}
                    <span className="home-door-cta">{d.cta}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3 · Picks from the season (or boards for a night in) */}
      {shelf.length > 0 && (
        <section className="section home-shelf" aria-labelledby="home-shelf-h">
          <div className="wrap">
            <SectionHead
              id="home-shelf-h"
              align="left"
              title={xmas ? "From the Christmas menu" : "Something for tonight"}
              intro={xmas
                ? "Each item has its own order-by date and the days you can collect it."
                : "Smaller boards for two to four."}
              action={xmas ? { to: `/christmas${suffix}`, label: "The full Christmas menu" } : { to: `/shop/at-home${suffix}`, label: "All boards for home" }}
            />
            <div className="pgrid">
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
            title="Made for the middle of the table."
            intro="Our boards and platters, made up by hand to order. Choose a size by how many you’re feeding."
            action={{ to: `/platters${suffix}`, label: "All boards and platters" }}
          />
          {signature.length === 0 ? (
            <p className="home-empty" role="status">
              {boards === null ? "Loading the boards…" : "The board menu is being updated. Browse the shop for what’s available. "}
              {boards !== null && <Link to={`/shop${suffix}`}>Browse the shop</Link>}
            </p>
          ) : (
            <div className="pgrid">
              {signature.map((g) => (
                <ProductCard key={g.lead.id} group={g} suffix={suffix} />
              ))}
            </div>
          )}
          <div className="home-boards-foot"><DeadlineChip /></div>
        </div>
      </section>

      {/* 5 · Catering, for the customer feeding a crowd */}
      <section className="section is-green on-green home-catering" aria-labelledby="home-catering-h">
        <div className="wrap home-catering-inner">
          <div className="home-catering-copy">
            <h2 id="home-catering-h" className="home-catering-h">Feeding twenty? Leave it with us.</h2>
            <p>
              Birthdays, christenings, family get-togethers and office lunches. Tell us your numbers and we’ll suggest platters
              to match. Then you choose a collection day.
            </p>
            <div className="home-catering-actions">
              <button type="button" className="btn" onClick={() => navigate(`/plan${suffix}`)}>Plan my event</button>
              <Link className="btn btn-secondary" to={`/shop/office-corporate${suffix}`}>Office and standing orders</Link>
            </div>
          </div>
          <div className="home-catering-how">
            <h3 className="home-catering-how-h">How it works</h3>
            <ol className="home-steps">
              <li><strong>Tell us your numbers</strong><span>The planner suggests a spread for your headcount. Swap anything you like.</span></li>
              <li><strong>Choose your day</strong><span>Pick a collection date with at least 48 hours’ notice.</span></li>
              <li><strong>Collect and serve</strong><span>We make it up fresh for the day.</span></li>
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
              title="Every occasion, well fed."
              action={{ to: `/shop${suffix}`, label: "Shop all occasions" }}
            />
            <div className={`home-occ-grid is-${Math.min(occasions.length, 4)}`}>
              {occasions.map((c) => (
                <Link key={c.id} className={`occasion-card home-occ${occPhotos ? " has-photo" : ""}`} to={`/shop/${c.slug}${suffix}`}>
                  {occPhotos && c.heroImageUrl && (
                    <span className="home-occ-photo"><img src={c.heroImageUrl} alt="" loading="lazy" width="640" height="480" /></span>
                  )}
                  <span className="home-occ-body">
                    <span className="occasion-name home-occ-name">{c.name}</span>
                    {c.tagline && <span className="home-occ-tag">{c.tagline}</span>}
                    <span className="home-occ-go">
                      {c.boardCount} {c.slug === "christmas" ? "to choose from" : `board${c.boardCount === 1 ? "" : "s"}`}
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
            <h3 id="home-visit-h" className="home-visit-h">Visit the deli</h3>
            <address className="home-visit-addr">
              Kelly&apos;s Deli<br />
              {SHOP_ADDRESS.split(", ").map((l) => <span key={l}>{l}<br /></span>)}
            </address>
            <a className="home-visit-map" href={SHOP_MAP_URL} target="_blank" rel="noopener noreferrer">Get directions<span className="visually-hidden"> (opens Google Maps)</span></a>
            {hours && status && (
              <>
                <p className={`home-visit-status${status.open ? " is-open" : ""}`}>{status.text.replace(" · ", ", ")}</p>
                <dl className="home-hours">
                  {DAY_LABELS.map((d, i) => (
                    <div key={d.key} className={i === today ? "is-today" : undefined}>
                      <dt>{d.long}{i === today && <span className="home-hours-today"> (today)</span>}</dt>
                      <dd>{hours[d.key]}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <div className="home-visit-cc">
              <p>Click and collect: order ahead online and pick up from the counter.</p>
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
            <p className="home-referral-h">Refer a friend and you both get £15 off</p>
            <p className="home-referral-p">Every order gives you a code to share. You’ll find it on your confirmation page.</p>
          </div>
        </div>
      </section>

      <div className="wrap home-faq">
        <Faq questions={faq} />
      </div>

      <StickyCta label={xmas ? "Order your Christmas" : "Order a board"} to={xmas ? `/christmas${suffix}` : `/platters${suffix}`} />
    </div>
  );
}
