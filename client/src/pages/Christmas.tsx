import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type CategoryCounts, type Platter, type ShopCategory } from "../lib/api";
import { addBoard } from "../lib/cart";
import { openCartDrawer } from "../components/CartDrawer";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { Header } from "../components/Header";
import { Stars } from "../components/Trust";
import { ReminderCapture } from "../components/ReminderCapture";
import { morphNavigate } from "../lib/motion";
import { groupVariants, type ProductGroup } from "../lib/variants";
import { orderByLabel, orderingClosed } from "../lib/preorder";
import { loadSiteContent } from "../lib/season";

const SITE = "https://www.kellysdeli.co.uk";
const HERO_IMG = "/img/christmas/hero.webp";

// Section order on the page; anything the owner names differently follows after.
const SECTION_ORDER = ["Hams & Joints", "Turkey & Trimmings", "Party Food", "Cheese", "Hampers & Gifts", "Party Platters"];

const XMAS_FAQ = [
  {
    q: "When can I collect?",
    a: "Any day in December the shop is open, up to Christmas Eve — you pick the day at checkout. Some items (like turkey crowns) are collected closer to Christmas; the checkout only offers the days that work for everything in your basket.",
  },
  {
    q: "Do I pay now?",
    a: "Yes — Christmas orders are paid in full when you order, so your food is set aside for you and collection is a quick hello at the counter. Party platters take the usual 25% deposit.",
  },
  {
    q: "Can you slice my ham?",
    a: "Of course. Add a note at checkout (\"sliced, please\") and we'll have it ready.",
  },
  {
    q: "What's the last day to order?",
    a: "Each item shows its own order-by date. Stock is ordered in for you, so once a date passes we can't promise it — order early to be sure.",
  },
  {
    q: "Ordering for the office or as gifts?",
    a: "Hampers and party platters can be ordered in any quantity. For a big gifting order, get in touch and we'll sort it with you.",
  },
];

function priceLine(g: ProductGroup): string {
  const p = g.lead;
  const price = g.hasChoice ? `From ${gbp(g.fromPrice)}` : gbp(p.fixedPrice ?? p.fromPrice ?? 0);
  if (p.kind === "product") return !g.hasChoice && p.unitLabel ? `${price} · ${p.unitLabel}` : price;
  return p.serves ? `${price} · feeds ${p.serves}` : price;
}

export default function Christmas() {
  const navigate = useNavigate();
  const [cat, setCat] = useState<ShopCategory | null>(null);
  const [failed, setFailed] = useState(false);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);

  usePageTitle(
    cat?.seoTitle ?? "Christmas Food Pre-Orders — Hams, Turkey & Hampers | Kelly's Deli",
    cat?.seoDescription ??
      "Pre-order Christmas hams, turkey crowns, party food, cheese and hampers from Kelly's Deli, Bentley Heath. Pay online and collect any day in December.",
    true,
  );

  useEffect(() => {
    api.shopCategory("christmas").then(setCat).catch(() => setFailed(true));
    loadSiteContent().then(setCounts);
  }, []);

  const products = cat?.boards ?? [];
  const sections = useMemo(() => {
    const bySection = new Map<string, Platter[]>();
    for (const p of products) {
      const key = p.section?.trim() || "More for Christmas";
      if (!bySection.has(key)) bySection.set(key, []);
      bySection.get(key)!.push(p);
    }
    const rank = (s: string) => (SECTION_ORDER.indexOf(s) === -1 ? 99 : SECTION_ORDER.indexOf(s));
    return [...bySection.entries()]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([name, items]) => ({ name, groups: groupVariants(items) }));
  }, [products]);

  // The soonest real deadline across the menu — a fact from the data, not invented urgency.
  const lastOrders = useMemo(() => {
    const open = products.filter((p) => p.orderBy && !orderingClosed(p)).map((p) => p.orderBy!);
    return open.length ? open.sort()[0] : null;
  }, [products]);

  // Structured data for the landing page: the Christmas range as an ItemList.
  useEffect(() => {
    if (!products.length) return;
    const leads = groupVariants(products).map((g) => g.lead);
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Christmas at Kelly's Deli",
      url: `${SITE}/christmas`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: leads.length,
        itemListElement: leads.map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Product",
            name: b.name,
            url: `${SITE}/platter/${b.id}`,
            ...(b.imageUrl ? { image: b.imageUrl } : {}),
            offers: { "@type": "Offer", priceCurrency: "GBP", price: String(b.fixedPrice ?? b.fromPrice ?? 0), availability: "https://schema.org/PreOrder" },
          },
        })),
      },
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [products]);

  const add = (p: Platter) => {
    addBoard(p.id);
    openCartDrawer();
  };

  return (
    <div className="app app-wide xmas-page">
      <Header />

      <header className="xmas-hero">
        <img className="xmas-hero-img" src={cat?.heroImageUrl || HERO_IMG} alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <div className="xmas-hero-scrim">
          <p className="xmas-eyebrow">Christmas at Kelly&apos;s Deli</p>
          <h1 className="xmas-hero-h">Christmas, sorted from the deli.</h1>
          <p className="xmas-hero-sub">
            {cat?.tagline ?? "Hams, turkey, party food and hampers — ordered now, collected in December."}
          </p>
          <div className="xmas-hero-actions">
            <a className="btn xmas-cta" href="#xmas-menu">See the Christmas menu</a>
            {lastOrders && <span className="xmas-deadline">{orderByLabel(lastOrders)?.replace("Order by", "Last orders")}</span>}
          </div>
        </div>
      </header>

      <ol className="xmas-steps" aria-label="How Christmas ordering works">
        <li><strong>Pick your Christmas</strong><span>Hams, turkey, party food, cheese, hampers.</span></li>
        <li><strong>Choose your day</strong><span>Collect any day in December, up to Christmas Eve.</span></li>
        <li><strong>Pay online, skip the queue</strong><span>It&apos;s set aside with your name on it.</span></li>
      </ol>

      {counts?.reviewRating && (
        <div className="cat-trust">
          <Stars rating={counts.reviewRating} count={counts.reviewCount} />
        </div>
      )}

      <div id="xmas-menu" className="xmas-menu">
        {!cat && !failed && <p className="muted center">Loading the Christmas menu…</p>}

        {(failed || (cat && products.length === 0)) && (
          <section className="xmas-empty card">
            <h2>The Christmas menu is landing very soon.</h2>
            <p className="muted">
              Hams, turkey crowns, party food and hampers — leave your details and we&apos;ll tell you the moment
              ordering opens.
            </p>
          </section>
        )}

        {sections.map((section) => (
          <section key={section.name} className="xmas-section" aria-labelledby={`xs-${section.name}`}>
            <h2 className="xmas-section-h" id={`xs-${section.name}`}>{section.name}</h2>
            <div className="board-grid">
              {section.groups.map((g) => {
                const p = g.lead;
                const closed = g.variants.every((v) => orderingClosed(v));
                const deadline = orderByLabel(p.orderBy);
                const toDetail = (e: React.MouseEvent<HTMLElement>) =>
                  morphNavigate(navigate, `/platter/${p.id}`, e.currentTarget.closest("article")?.querySelector(".board-card-img") as HTMLElement | null);
                return (
                  <article key={p.id} className={`board-card card xmas-card${closed ? " is-closed" : ""}`}>
                    <div className="xmas-card-media">
                      <div
                        className="board-card-img"
                        style={{ backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : undefined }}
                        role="img"
                        aria-label={p.imageIllustrative ? `${p.name} (illustrative image)` : p.name}
                      />
                      {p.imageIllustrative && p.imageUrl && <span className="illustrative-tag">Illustrative image</span>}
                    </div>
                    <div className="board-card-body">
                      <h3 className="board-card-name">{p.name}</h3>
                      <p className="board-card-price">{priceLine(g)}</p>
                      <p className="board-card-desc muted">{p.description}</p>
                      {deadline && <p className={`xmas-orderby${closed ? " closed" : ""}`}>{closed ? "Orders closed" : deadline}</p>}
                      <div className="board-card-actions">
                        {closed ? (
                          <button className="btn" disabled>Sold out for Christmas</button>
                        ) : g.hasChoice ? (
                          <button className="btn" onClick={toDetail}>Choose · {g.variants.length} sizes</button>
                        ) : (
                          <>
                            <button className="btn" onClick={() => add(p)}>Add · {gbp(p.fixedPrice ?? 0)}</button>
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
        ))}
      </div>

      <section className="xmas-bands">
        <div className="xmas-band">
          <h2>Christmas party catering</h2>
          <p>Office do, family get-together or Boxing Day open house — tell us how many and we&apos;ll put the spread together.</p>
          <Link className="btn btn-secondary" to="/plan">Plan my party food</Link>
        </div>
        <div className="xmas-band">
          <h2>Gifts for clients &amp; staff</h2>
          <p>Hampers in any quantity, with a printed note in each. Bigger order? We&apos;ll sort it with you.</p>
          <Link className="btn btn-secondary" to="/shop/office-corporate">Talk to us about gifting</Link>
        </div>
      </section>

      <ReminderCapture defaultOccasion="Christmas" />

      <section className="faq">
        <h2 className="choice-h">Christmas questions</h2>
        {XMAS_FAQ.map((item) => (
          <details className="faq-item" key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
