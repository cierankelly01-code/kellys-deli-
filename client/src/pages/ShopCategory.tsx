import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, type ShopCategory as ShopCategoryT, type CategoryCounts } from "../lib/api";
import { usePageTitle } from "../lib/title";
import { StickyCta } from "../components/StickyCta";
import { Faq } from "../components/Faq";
import { DeadlineChip } from "../components/Trust";
import { CorporateEnquiryForm } from "../components/CorporateEnquiryForm";
import { ReminderCapture } from "../components/ReminderCapture";
import { ProductArt } from "../components/ProductArt";
import { PageHero } from "../components/site/PageHero";
import { ProductCard } from "../components/site/ProductCard";
import { SectionHead } from "../components/site/SectionHead";
import { groupVariants, type ProductGroup } from "../lib/variants";

const SITE = "https://www.kellysdeli.co.uk";

/* ---------- Collection helpers, shared with /platters ---------- */

export type SortKey = "recommended" | "price-asc" | "price-desc" | "feeds";

export const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "feeds", label: "Feeds the most" },
];

/** The most people any size of this product feeds — from feedsMax, or the numbers in "serves". */
export function maxFeeds(g: ProductGroup): number {
  let best = 0;
  for (const v of g.variants) {
    if (v.feedsMax) best = Math.max(best, v.feedsMax);
    for (const n of (v.serves ?? "").match(/\d+/g) ?? []) best = Math.max(best, Number(n));
  }
  return best;
}

/** "Recommended" keeps the owner's own order; the rest are stable sorts on real data. */
export function sortGroups(groups: ProductGroup[], key: SortKey): ProductGroup[] {
  if (key === "recommended") return groups;
  const out = [...groups];
  if (key === "price-asc") out.sort((a, b) => a.fromPrice - b.fromPrice);
  if (key === "price-desc") out.sort((a, b) => b.fromPrice - a.fromPrice);
  if (key === "feeds") out.sort((a, b) => maxFeeds(b) - maxFeeds(a));
  return out;
}

/** The sort lives in the URL so "back" from a product returns to the same order. */
export function useSort(): [SortKey, (k: SortKey) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("sort");
  const sort: SortKey = SORTS.some((s) => s.value === raw) ? (raw as SortKey) : "recommended";
  const setSort = (k: SortKey) => {
    const next = new URLSearchParams(params);
    if (k === "recommended") next.delete("sort");
    else next.set("sort", k);
    setParams(next, { replace: true });
  };
  return [sort, setSort];
}

/** Slim sticky bar above a product grid: how many, when you can collect, and the sort. */
export function CollectionToolbar({
  count,
  noun = "board",
  sort,
  onSort,
  children,
}: {
  count: number;
  noun?: string;
  sort: SortKey;
  onSort: (k: SortKey) => void;
  children?: ReactNode;
}) {
  return (
    <div className="ctoolbar">
      <div className="wrap ctoolbar-inner">
        <p className="ctoolbar-count" aria-live="polite">
          <strong>{count}</strong> {noun}
          {count === 1 ? "" : "s"}
        </p>
        {children && <div className="ctoolbar-note">{children}</div>}
        <label className="ctoolbar-sort">
          <span>Sort by</span>
          <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

/** Illustration to stand in for an occasion that has no photo yet. */
export function occasionArt(slug: string, name: string): string {
  if (slug === "hosting") return "Party Platter";
  if (slug === "at-home") return "Cheese";
  if (slug === "office-corporate") return "Sliced ham from the counter";
  if (slug === "christmas") return "Honey Roast Ham";
  return name;
}

/* ---------- /shop/:slug ---------- */

export default function ShopCategory() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [cat, setCat] = useState<ShopCategoryT | null>(null);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [others, setOthers] = useState<ShopCategoryT[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [sort, setSort] = useSort();

  useEffect(() => {
    if (!slug) return;
    setCat(null);
    setNotFound(false);
    api.shopCategory(slug).then(setCat).catch(() => setNotFound(true));
    api.categories().then(setCounts).catch(() => setCounts(null));
    api.shopCategories().then(setOthers).catch(() => setOthers([]));
  }, [slug]);

  // Next-day delivery for corporate is the owner's call — honestly off until they switch
  // the admin toggle on (surfaced in the public counts payload).
  const nextDay = !!counts?.corporateNextDayDelivery;

  // Per-category SEO title/description (exact — the seed titles already include the brand).
  usePageTitle(
    cat?.seoTitle ?? cat?.name,
    cat?.seoDescription ?? cat?.description ?? undefined,
    !!cat?.seoTitle,
  );

  // Structured data: CollectionPage + ItemList of the assigned boards, and a breadcrumb.
  // Injected when the category loads (search landing pages), removed on unmount.
  useEffect(() => {
    if (!cat) return;
    // One entry per product, not per size — otherwise the same board is listed to search
    // engines two or three times, which is exactly the duplication the grouping removed.
    const boards = groupVariants(cat.boards ?? []).map((g) => g.lead);
    const itemList = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: cat.seoTitle ?? cat.name,
      description: cat.seoDescription ?? cat.description ?? undefined,
      url: `${SITE}/shop/${cat.slug}`,
      isPartOf: { "@type": "WebSite", name: "Kelly's Deli", url: SITE },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: boards.length,
        itemListElement: boards.map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Product",
            name: b.name,
            url: `${SITE}/platter/${b.id}`,
            ...(b.imageUrl ? { image: b.imageUrl } : {}),
            offers: {
              "@type": "Offer",
              priceCurrency: "GBP",
              price: String(b.fixedPrice ?? b.fromPrice ?? 0),
              availability: "https://schema.org/InStock",
            },
          },
        })),
      },
    };
    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Shop", item: `${SITE}/shop` },
        { "@type": "ListItem", position: 2, name: cat.name, item: `${SITE}/shop/${cat.slug}` },
      ],
    };
    const nodes = [itemList, breadcrumb].map((data) => {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.text = JSON.stringify(data);
      document.head.appendChild(el);
      return el;
    });
    return () => nodes.forEach((n) => n.remove());
  }, [cat]);

  const groups = useMemo(() => groupVariants(cat?.boards ?? []), [cat]);
  const sorted = useMemo(() => sortGroups(groups, sort), [groups, sort]);

  if (notFound) {
    return (
      <div className="collection shop-cat-page">
        <PageHero
          crumbs={[{ to: "/", label: "Home" }, { to: "/shop", label: "Shop" }, { label: "Not found" }]}
          title="We couldn't find that section."
          intro="It may have moved. Everything we make is still a click away."
        >
          <Link className="btn" to="/shop">Back to the shop</Link>
          <Link className="btn btn-secondary" to="/platters">See all boards</Link>
        </PageHero>
      </div>
    );
  }
  if (!cat) {
    return (
      <div className="collection shop-cat-page">
        <div className="collection-loading" role="status">Loading…</div>
      </div>
    );
  }

  const otherCats = others.filter((o) => o.slug !== cat.slug && o.slug !== "christmas");
  const planMyEvent = (
    <button type="button" className="btn" onClick={() => navigate("/plan")}>Plan my event</button>
  );

  return (
    <div className={`collection shop-cat-page${cat.isCorporate ? " is-corporate" : ""}`}>
      <PageHero
        crumbs={[{ to: "/", label: "Home" }, { to: "/shop", label: "Shop" }, { label: cat.name }]}
        eyebrow="Shop by occasion"
        title={cat.name}
        intro={
          <>
            {cat.tagline && <span className="collection-tagline">{cat.tagline}</span>}
            {cat.tagline && cat.description ? " " : null}
            {cat.description}
          </>
        }
        imageUrl={cat.heroImageUrl}
        art={occasionArt(cat.slug, cat.name)}
      >
        {cat.promotePlanner && planMyEvent}
        {cat.isCorporate && <a className="btn" href="#office-enquiry">Set up office catering</a>}
        {groups.length > 0 && (
          <a className={`btn${cat.promotePlanner || cat.isCorporate ? " btn-secondary" : ""}`} href="#collection-grid">
            See the {groups.length} board{groups.length === 1 ? "" : "s"}
          </a>
        )}
      </PageHero>

      <ul className="cfacts" aria-label="How ordering works">
        <li><DeadlineChip /></li>
        <li>25% deposit secures your date</li>
        <li>Balance paid on collection</li>
      </ul>

      {groups.length > 0 ? (
        <>
          <CollectionToolbar count={groups.length} sort={sort} onSort={setSort} />
          <section className="section collection-grid-section" id="collection-grid" aria-label={`${cat.name} boards`}>
            <div className="wrap">
              <div className="pgrid cgrid" data-n={sorted.length}>
                {sorted.map((g) => (
                  <ProductCard key={g.lead.id} group={g} showDescription />
                ))}
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="section">
          <div className="wrap-narrow collection-empty">
            <h2>Boards for this occasion are on their way.</h2>
            <p>In the meantime, every board we make is on the board counter.</p>
            <Link className="btn btn-secondary" to="/platters">See all boards</Link>
          </div>
        </section>
      )}

      {/* Hosting: promote the event planner alongside the boards */}
      {cat.promotePlanner && (
        <section className="section is-green planner-band" aria-labelledby="planner-band-h">
          <div className="wrap planner-band-inner">
            <div>
              <p className="eyebrow">Not sure how much you need?</p>
              <h2 id="planner-band-h" className="planner-band-h">Tell us how many are coming. We&apos;ll suggest the spread.</h2>
              <p className="planner-band-copy">
                The event planner works from your headcount and puts together the boards to feed everyone —
                you can swap anything before you order.
              </p>
            </div>
            {/* A link, not a second "Plan my event" button: the hero carries that one. */}
            <div className="planner-band-cta"><Link className="btn" to="/plan">Start with your headcount</Link></div>
          </div>
        </section>
      )}

      {/* Subscribe & Save is offered per-board on the board page — signpost it honestly */}
      {!cat.isCorporate && (
        <div className="wrap">
          <p className="subscribe-note">
            <span className="subscribe-note-mark" aria-hidden="true">↻</span>
            <span>
              Order it on repeat and <strong>save 10%</strong> — pick weekly, fortnightly or monthly on any board.
              No card taken now; we set the schedule up with you.
            </span>
          </p>
        </div>
      )}

      {/* Corporate: standing-order copy + enquiry form */}
      {cat.isCorporate && (
        <section className="section is-paper corp-section" id="office-enquiry">
          <div className="wrap corp-layout">
            <div className="corp-standing">
              <p className="eyebrow">Office &amp; corporate</p>
              <h2 className="corp-standing-h">A standing platter for the office</h2>
              <p className="corp-standing-copy">
                Set up a regular weekly, fortnightly or monthly platter and save 10% with Subscribe &amp; Save — we&apos;ll
                invoice monthly and confirm every delivery with you. {nextDay
                  ? "Regular orders are delivered the next working day."
                  : "Delivery is available for regular office orders — we'll confirm your schedule with you."}
              </p>
              <ol className="corp-steps">
                <li><span aria-hidden="true">I</span>Tell us your numbers and how often</li>
                <li><span aria-hidden="true">II</span>We talk it through and confirm the schedule</li>
                <li><span aria-hidden="true">III</span>Platters arrive made fresh, invoiced monthly</li>
              </ol>
              <p className="corp-alt">
                Just one meeting? Order any board above for collection, or <Link to="/plan">plan it by headcount</Link>.
              </p>
            </div>
            <CorporateEnquiryForm nextDayConfirmed={nextDay} />
          </div>
        </section>
      )}

      {/* Book-ahead / birthday selling point */}
      {!cat.isCorporate && (
        <section className="section">
          <div className="wrap">
            <div className="feature is-reverse prebook">
              <div className="feature-visual">
                <ProductArt name="Gift" />
              </div>
              <div className="feature-copy">
                <p className="eyebrow">Book ahead</p>
                <h2>Got a date in the diary? Book it in now.</h2>
                <p>
                  Birthday, celebration or a big weekend coming up — pick a date ahead, pay the 25% deposit and it&apos;s
                  locked in. Add a gift note at checkout if it&apos;s for someone else.
                </p>
                <Link className="btn btn-secondary" to="/platters">Book a board ahead</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {!cat.isCorporate && (
        <div className="wrap">
          <ReminderCapture />
        </div>
      )}

      {otherCats.length > 0 && (
        <section className="section other-occasions" aria-labelledby="other-occasions-h">
          <div className="wrap">
            <SectionHead id="other-occasions-h" eyebrow="Something else in mind?" title="Other occasions" />
            <ul className="other-occasions-list">
              {otherCats.map((o) => (
                <li key={o.id}>
                  <Link to={`/shop/${o.slug}`}>
                    <span className="other-occasions-name">{o.name}</span>
                    {o.tagline && <span className="other-occasions-tag">{o.tagline}</span>}
                    <span className="other-occasions-go" aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/platters">
                  <span className="other-occasions-name">Every board</span>
                  <span className="other-occasions-tag">The whole board counter, for two to twenty.</span>
                  <span className="other-occasions-go" aria-hidden="true">→</span>
                </Link>
              </li>
            </ul>
          </div>
        </section>
      )}

      <div className="wrap-narrow">
        <Faq />
      </div>
      {cat.promotePlanner ? <StickyCta label="Plan the food for your event" to="/plan" /> : <StickyCta label="Browse all boards" to="/platters" />}
    </div>
  );
}
