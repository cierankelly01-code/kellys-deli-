import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type CategoryCounts, type Platter, type ShopCategory } from "../lib/api";
import { usePageTitle } from "../lib/title";
import { ReminderCapture } from "../components/ReminderCapture";
import { groupVariants } from "../lib/variants";
import { orderByLabel, orderingClosed } from "../lib/preorder";
import { loadSiteContent } from "../lib/season";
import { BasketBar } from "../components/BasketBar";
import { ProductCard } from "../components/site/ProductCard";

const SITE = "https://www.kellysdeli.co.uk";

// Section order on the page; anything the owner names differently follows after.
const SECTION_ORDER = ["Hams & Joints", "Turkey & Trimmings", "Party Food", "Cheese", "Hampers & Gifts", "Party Platters"];

const XMAS_FAQ = [
  {
    q: "When can I collect?",
    a: "Any day in December the shop is open, up to Christmas Eve. You pick the day at checkout. Some items (like turkey crowns) are collected closer to Christmas; the checkout only offers the days that work for everything in your basket.",
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

export default function Christmas() {
  const [cat, setCat] = useState<ShopCategory | null>(null);
  const [failed, setFailed] = useState(false);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [active, setActive] = useState<string | null>(null);

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

  const products = useMemo(() => cat?.boards ?? [], [cat]);
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
      .map(([name, items]) => {
        // The soonest open order-by in the section — shown over its heading.
        const open = items.filter((p) => p.orderBy && !orderingClosed(p)).map((p) => p.orderBy!).sort();
        return { name, id: slug(name), groups: groupVariants(items), firstOrderBy: open.length ? open[0] : null };
      });
  }, [products]);

  // The soonest real deadline across the menu — a fact from the data, not invented urgency.
  const lastOrders = useMemo(() => {
    const open = products.filter((p) => p.orderBy && !orderingClosed(p)).map((p) => p.orderBy!);
    return open.length ? open.sort()[0] : null;
  }, [products]);

  // The Christmas diary: every open order-by date, with what has to be ordered by then.
  const diary = useMemo(() => {
    const byDay = new Map<string, { iso: string; names: string[] }>();
    for (const g of groupVariants(products)) {
      const p = g.lead;
      if (!p.orderBy || orderingClosed(p)) continue;
      const label = orderByLabel(p.orderBy);
      if (!label) continue;
      const row = byDay.get(label) ?? { iso: p.orderBy, names: [] };
      if (!row.names.includes(p.name)) row.names.push(p.name);
      if (p.orderBy < row.iso) row.iso = p.orderBy;
      byDay.set(label, row);
    }
    return [...byDay.entries()].sort(([, a], [, b]) => (a.iso < b.iso ? -1 : 1)).map(([label, v]) => ({ label, ...v }));
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

  // Highlight the section in view in the jump nav (and keep that chip scrolled into view).
  useEffect(() => {
    if (sections.length < 2 || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    sections.forEach((s) => {
      const el = document.getElementById(`xs-${s.id}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [sections]);

  useEffect(() => {
    if (!active) return;
    const chip = document.querySelector<HTMLElement>(`.xm-nav a[href="#${active}"]`);
    const bar = chip?.parentElement;
    if (chip && bar && bar.scrollWidth > bar.clientWidth) {
      bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
    }
  }, [active]);

  const empty = failed || (cat && products.length === 0);
  const daysLeft = lastOrders ? daysUntil(lastOrders) : 0;

  return (
    <div className="xm">
      <section className="photo-hero xm-hero" aria-labelledby="xm-hero-h">
        <figure className="photo-hero-photo">
          {cat?.heroImageUrl && <img src={cat.heroImageUrl} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
        </figure>
        <div className="photo-hero-copy">
          <h1 id="xm-hero-h" className="photo-hero-h">Christmas at Kelly&apos;s</h1>
          <p className="photo-hero-sub">
            {cat?.tagline ?? "Hams glazed in the deli, turkey, party food and hampers. Order now and collect in December."}
          </p>
          {lastOrders && (
            <a className="photo-hero-note" href="#xmas-dates">
              {orderByLabel(lastOrders)?.replace("Order by", "First order-by date:")}
              {daysLeft > 0 && `, ${daysLeft} days to go`}
            </a>
          )}
          <div className="photo-hero-actions">
            <a className="btn" href="#xmas-menu">Shop the Christmas menu</a>
            <Link className="btn btn-secondary" to="/plan">Christmas party catering</Link>
          </div>
        </div>
      </section>

      <div className="wrap">
        <ol className="xm-steps" aria-label="How Christmas ordering works">
          <li><strong>Choose your Christmas</strong><span>Hams, turkey, party food, cheese and hampers.</span></li>
          <li><strong>Pick your day</strong><span>Collect from the shop any day in December, up to Christmas Eve.</span></li>
          <li><strong>{counts?.paymentsLive ? "Pay online, and it’s set aside" : "Send your order, and it’s set aside"}</strong><span>Waiting with your name on it when you come in.</span></li>
        </ol>
      </div>

      {sections.length > 1 && (
        <nav className="xm-nav" aria-label="Jump to a section">
          <div className="xm-nav-track">
            {sections.map((sec) => (
              <a key={sec.name} href={`#xs-${sec.id}`} aria-current={active === `xs-${sec.id}` ? "true" : undefined}>
                {sec.name}
              </a>
            ))}
            {diary.length > 0 && <a href="#xmas-dates" className="xm-nav-dates">Order-by dates</a>}
          </div>
        </nav>
      )}

      <div id="xmas-menu" className="xm-menu">
        {!cat && !failed && <div className="wrap xm-loading" role="status">Loading the Christmas menu…</div>}

        {empty && (
          <section className="wrap xm-empty">
            <h2>The Christmas menu is nearly ready.</h2>
            <p>
              Hams, turkey crowns, party food and hampers. Leave your details below and we&apos;ll tell you when ordering opens.
            </p>
            <a className="btn btn-secondary" href="#xmas-reminder">Remind me when it opens</a>
          </section>
        )}

        {sections.map((section) => (
          <section key={section.name} className="xm-section" id={`xs-${section.id}`} aria-labelledby={`xsh-${section.id}`}>
            <div className="wrap">
              <header className="xm-section-head">
                <h2 id={`xsh-${section.id}`} className="xm-section-h">{section.name}</h2>
                {section.firstOrderBy
                  ? <p className="xm-section-by">{orderByLabel(section.firstOrderBy)}</p>
                  : <p className="xm-section-by is-quiet">{section.groups.length} to choose from</p>}
              </header>
              <div className="pgrid" data-n={section.groups.length}>
                {section.groups.map((g) => (
                  <ProductCard key={g.lead.id} group={g} showDescription />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      {diary.length > 0 && (
        <section className="xm-dates" id="xmas-dates" aria-labelledby="xmas-dates-h">
          <div className="wrap">
            <h2 id="xmas-dates-h" className="xm-dates-h">Order-by dates</h2>
            <p className="xm-dates-intro">Stock is ordered in for you, so each item has its own last day to order. Once a date has passed we can&apos;t promise it.</p>
            <ol className="xm-book">
              {diary.map((d) => {
                const n = daysUntil(d.iso);
                return (
                  <li key={d.label}>
                    <p className="xm-book-date">
                      {d.label.replace("Order by ", "")}
                      <span className="xm-book-left">{n > 0 ? `${n} days to go` : "Today"}</span>
                    </p>
                    <p className="xm-book-items">{d.names.join(", ")}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      <section className="xm-band on-green" aria-label="Catering and gifting">
        <div className="wrap xm-band-grid">
          <div className="xm-offer">
            <h2>Christmas party catering</h2>
            <p>Office do, family get-together or Boxing Day open house. Tell us how many and we&apos;ll put the spread together.</p>
            <Link className="btn" to="/plan">Plan my party food</Link>
          </div>
          <div className="xm-offer">
            <h2>Gifts for clients and staff</h2>
            <p>Hampers in any quantity, with a printed note in each. For a bigger order, we&apos;ll sort it with you.</p>
            <Link className="btn btn-secondary" to="/shop/office-corporate">Talk to us about gifting</Link>
          </div>
        </div>
      </section>

      <div className="wrap xm-reminder" id="xmas-reminder">
        <ReminderCapture defaultOccasion="Christmas" />
      </div>

      <section className="wrap xm-faq" aria-labelledby="xmas-faq-h">
        <h2 id="xmas-faq-h" className="xm-faq-h">Christmas questions</h2>
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
