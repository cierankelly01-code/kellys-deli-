import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type CategoryCounts, type Platter, type ShopCategory } from "../lib/api";
import { addBoard } from "../lib/cart";
import { openCartDrawer } from "../components/CartDrawer";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { Header } from "../components/Header";
import { ReminderCapture } from "../components/ReminderCapture";
import { morphNavigate } from "../lib/motion";
import { groupVariants, type ProductGroup } from "../lib/variants";
import { orderByLabel, orderingClosed } from "../lib/preorder";
import { loadSiteContent } from "../lib/season";
import { ProductArt } from "../components/ProductArt";
import { Crest, Ornament } from "../components/BrandMark";
import { BasketBar } from "../components/BasketBar";
import { CART_CHANGED_EVENT } from "../components/CartDrawer";

const SITE = "https://www.kellysdeli.co.uk";

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

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Whole days from now until an ISO deadline (0 on the day itself). */
function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

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
  // Brief "Added ✓" on the tile that was just added — the drawer opens too, but on a phone
  // the tile is what the thumb is still on.
  const [justAdded, setJustAdded] = useState<string | null>(null);

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
    window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
    setJustAdded(p.id);
    window.setTimeout(() => setJustAdded((id) => (id === p.id ? null : id)), 1600);
    openCartDrawer();
  };

  return (
    <div className="app app-wide xmas-page">
      <Header />

      <header className="xmas-hero">
        {cat?.heroImageUrl && <img className="xmas-hero-img" src={cat.heroImageUrl} alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
        <div className="xmas-hero-scrim">
          <Crest className="xmas-hero-crest" />
          <p className="xmas-eyebrow">The Christmas Collection</p>
          <h1 className="xmas-hero-h">Christmas <em>at Kelly&apos;s</em></h1>
          <Ornament className="ornament xmas-hero-ornament" />
          <p className="xmas-hero-sub">
            {cat?.tagline ?? "Hams glazed in the deli, turkey, party food and hampers — ordered now, collected in December."}
          </p>
          <div className="xmas-hero-actions">
            <a className="btn xmas-cta" href="#xmas-menu">Shop the collection</a>
            <Link className="btn btn-secondary xmas-cta-alt" to="/plan">Christmas party catering</Link>
          </div>
          {lastOrders && (
            <p className="xmas-deadline">
              {orderByLabel(lastOrders)?.replace("Order by", "Last orders")}
              {daysUntil(lastOrders) > 0 && <> · {daysUntil(lastOrders)} days to go</>}
            </p>
          )}
        </div>
      </header>

      <ul className="xmas-trust" aria-label="Why order from us">
        {counts?.reviewRating && <li>{counts.reviewRating}★ on Google{counts.reviewCount ? ` · ${counts.reviewCount} reviews` : ""}</li>}
        <li>Family-run in Bentley Heath</li>
        <li>Collect any day in December</li>
        <li>{counts?.paymentsLive ? "Pay securely online" : "Order online in two minutes"}</li>
      </ul>

      <ol className="xmas-steps" aria-label="How Christmas ordering works">
        <li><span className="xmas-step-n" aria-hidden="true">I</span><strong>Choose your Christmas</strong><span>Hams, turkey, party food, cheese and hampers.</span></li>
        <li><span className="xmas-step-n" aria-hidden="true">II</span><strong>Pick your day</strong><span>Collect any day in December, up to Christmas Eve.</span></li>
        <li><span className="xmas-step-n" aria-hidden="true">III</span><strong>Pay, and it&apos;s set aside</strong><span>Waiting with your name on it — no queue.</span></li>
      </ol>

      {sections.length > 1 && (
        <nav className="xmas-chips" aria-label="Jump to a section">
          {sections.map((sec) => (
            <a key={sec.name} href={`#xs-${slug(sec.name)}`}>{sec.name}</a>
          ))}
        </nav>
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
          <section key={section.name} className="xmas-section" id={`xs-${slug(section.name)}`} aria-labelledby={`xsh-${slug(section.name)}`}>
            <header className="xmas-section-head">
              <h2 className="xmas-section-h" id={`xsh-${slug(section.name)}`}>{section.name}</h2>
              <Ornament />
            </header>
            <div className="board-grid">
              {section.groups.map((g) => {
                const p = g.lead;
                const closed = g.variants.every((v) => orderingClosed(v));
                const deadline = orderByLabel(p.orderBy);
                const toDetail = (e: React.MouseEvent<HTMLElement>) =>
                  morphNavigate(navigate, `/platter/${p.id}`, e.currentTarget.closest("article")?.querySelector(".board-card-img") as HTMLElement | null);
                return (
                  <article key={p.id} className={`board-card card xmas-card${closed ? " is-closed" : ""}`}>
                    <button type="button" className="xmas-card-media" onClick={toDetail} aria-label={`More about ${p.name}`}>
                      {p.imageUrl ? (
                        <div
                          className="board-card-img"
                          style={{ backgroundImage: `url(${p.imageUrl})` }}
                          role="img"
                          aria-label={p.imageIllustrative ? `${p.name} (illustrative image)` : p.name}
                        />
                      ) : (
                        <ProductArt name={p.name} section={p.section} className="board-card-img" />
                      )}
                      {p.imageIllustrative && p.imageUrl && <span className="illustrative-tag">Illustrative image</span>}
                    </button>
                    <div className="board-card-body">
                      <h3 className="board-card-name"><button type="button" className="xmas-card-title" onClick={toDetail}>{p.name}</button></h3>
                      <p className="board-card-price">{priceLine(g)}</p>
                      <p className="board-card-desc muted">{p.description}</p>
                      {deadline && <p className={`xmas-orderby${closed ? " closed" : ""}`}>{closed ? "Orders closed" : deadline}</p>}
                      <div className="board-card-actions">
                        {closed ? (
                          <button className="btn" disabled>Sold out for Christmas</button>
                        ) : g.hasChoice ? (
                          <button className="btn" onClick={toDetail}>Choose a size</button>
                        ) : (
                          <>
                            <button className={`btn${justAdded === p.id ? " is-added" : ""}`} onClick={() => add(p)}>
                              {justAdded === p.id ? "Added ✓" : "Add to basket"}
                            </button>
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
          <ProductArt name="Christmas Party Platter" className="xmas-band-art" />
          <p className="xmas-eyebrow">Entertaining</p>
          <h2>Christmas party catering</h2>
          <p>Office do, family get-together or Boxing Day open house — tell us how many and we&apos;ll put the spread together.</p>
          <Link className="btn btn-secondary" to="/plan">Plan my party food</Link>
        </div>
        <div className="xmas-band">
          <ProductArt name="Hamper" className="xmas-band-art" />
          <p className="xmas-eyebrow">Corporate gifting</p>
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

      <BasketBar />
    </div>
  );
}
