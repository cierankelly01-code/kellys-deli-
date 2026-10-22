import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type ShopCategory, type CategoryCounts, type Platter } from "../lib/api";
import { addBoard } from "../lib/cart";
import { openCartDrawer } from "../components/CartDrawer";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { Header } from "../components/Header";
import { CorporateEnquiryForm } from "../components/CorporateEnquiryForm";
import { Stars } from "../components/Trust";
import { morphNavigate } from "../lib/motion";
import { groupVariants, cheapestVariant, type ProductGroup } from "../lib/variants";

const SITE = "https://www.kellysdeli.co.uk";

const QUICK_ANSWERS: Array<{ label: string; value: (c: CategoryCounts | null) => string }> = [
  { label: "People", value: () => "Each size shows how many it serves — ask us if you need help." },
  { label: "Notice", value: () => "At least 48 hours before collection. Bigger events, the earlier the better." },
  { label: "Collection", value: () => "From our deli in Bentley Heath, Solihull." },
  {
    label: "Delivery",
    value: (c) => (c?.corporateNextDayDelivery ? "Next working day for regular office orders." : "Ask us to confirm availability and cost."),
  },
  { label: "Dietary needs", value: () => "Tell us what you need before you book and we'll confirm what we can do." },
  { label: "Invoices & repeats", value: () => "Weekly, fortnightly or monthly — tell us in your enquiry." },
];

const OFFICE_FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Do you do office catering near Solihull?",
    a: "Yes — Kelly's Deli is a family-run deli in Bentley Heath, Solihull, and we cater platters and boards for offices across Solihull, Knowle and Dorridge for meetings, team lunches and workplace gatherings.",
  },
  {
    q: "How much notice do you need for a meeting or office lunch?",
    a: "At least 48 hours for a standard order. For a larger one-off event or a regular weekly lunch, get in touch as early as you can so we can reserve your date.",
  },
  {
    q: "Can you deliver to our office, or is it collection only?",
    a: "Office platters can be collected from Bentley Heath. Delivery is available for regular office orders — tell us your postcode and how often you need food, and we'll confirm availability and any delivery cost.",
  },
  {
    q: "Can you invoice monthly instead of paying per order?",
    a: "For regular office lunches we can arrange monthly invoicing — tell us how often you need feeding in your enquiry and we'll set it up with you.",
  },
  {
    q: "Can you cater for dietary requirements and allergies?",
    a: "Yes. Tell us about allergies or dietary needs when you enquire and we'll talk through what we can provide before anything is booked.",
  },
  {
    q: "How many platters do we need for our office?",
    a: "Each board's size shows how many it feeds. As a rough guide, plan a light platter per 3-4 people if it's alongside other food, or per 2-3 people if it's the main lunch — tell us your headcount and we'll help you get it right.",
  },
];

function priceFeeds(g: ProductGroup): string {
  const target = g.hasChoice ? cheapestVariant(g) : g.lead;
  const price = g.hasChoice ? `From ${gbp(g.fromPrice)}` : gbp(target.fixedPrice ?? target.fromPrice ?? 0);
  return target.serves ? `${price} · feeds ${target.serves}` : price;
}

export default function OfficeCatering() {
  const navigate = useNavigate();
  const [cat, setCat] = useState<ShopCategory | null>(null);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.shopCategory("office-corporate").then(setCat).catch(() => setNotFound(true));
    api.categories().then(setCounts).catch(() => setCounts(null));
  }, []);

  usePageTitle(
    "Office catering in Solihull",
    "Boards and platters for meetings, team lunches and workplace gatherings, from Kelly's Deli in Bentley Heath, Solihull. 48 hours' notice, dietary needs confirmed before you book, invoicing available for regular orders.",
    true,
  );

  // Service + FAQPage structured data — Google rich results and a concrete, extractable
  // answer set for AI assistants asked "office catering near Solihull" or similar.
  useEffect(() => {
    const service = {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: "Office catering",
      name: "Kelly's Deli office catering",
      description: "Boards and platters for meetings, team lunches and workplace gatherings, prepared by Kelly's Deli in Bentley Heath, Solihull.",
      provider: { "@type": "LocalBusiness", name: "Kelly's Deli", "@id": `${SITE}/#business` },
      areaServed: [
        { "@type": "City", name: "Solihull" },
        { "@type": "Place", name: "Bentley Heath" },
        { "@type": "Place", name: "Knowle" },
        { "@type": "Place", name: "Dorridge" },
      ],
      url: `${SITE}/office-catering`,
    };
    const faq = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: OFFICE_FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Office catering", item: `${SITE}/office-catering` },
      ],
    };
    const nodes = [service, faq, breadcrumb].map((data) => {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.text = JSON.stringify(data);
      document.head.appendChild(el);
      return el;
    });
    return () => nodes.forEach((n) => n.remove());
  }, []);

  const startOrder = (p: Platter) => {
    addBoard(p.id);
    openCartDrawer();
  };

  const scrollToEnquiry = () => {
    document.getElementById("enquiry")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("enquiry-h")?.focus(), 400);
  };

  const boards = groupVariants(cat?.boards ?? []).slice(0, 3);
  const nextDay = !!counts?.corporateNextDayDelivery;

  if (notFound) {
    return (
      <div className="app">
        <Header />
        <div className="notice">
          <p>We couldn&apos;t load office catering right now.</p>
          <p className="muted">Call or email us and we&apos;ll help directly — <a href="mailto:hello@kellysdeli.co.uk">hello@kellysdeli.co.uk</a>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app app-wide office-page">
      <Header />

      <header className="office-hero" data-reveal>
        <p className="deli-eyebrow">Office &amp; workplace catering · Solihull</p>
        <h1 className="office-h1">Office catering</h1>
        <p className="office-lede">Boards and platters for meetings, team lunches and workplace gatherings — prepared fresh by our family deli in Bentley Heath.</p>

        <ul className="office-quick-answers">
          {QUICK_ANSWERS.map((qa) => (
            <li key={qa.label}>
              <span className="oqa-label">{qa.label}</span>
              <span className="oqa-value">{qa.value(counts)}</span>
            </li>
          ))}
        </ul>

        <div className="office-paths">
          <Link className="btn office-path-primary" to="/shop/office-corporate">Choose platters for collection</Link>
          <p className="office-path-note">Choose your food, then your collection date.</p>
          <button className="btn btn-secondary office-path-secondary" onClick={scrollToEnquiry}>Ask about catering</button>
          <p className="office-path-note">For delivery, help with quantities, or a regular order.</p>
        </div>

        {counts?.reviewRating && <Stars rating={counts.reviewRating} count={counts.reviewCount} />}
      </header>

      {/* No category hero photo here deliberately: the assigned image for this category is
          restaurant-interior stock, not food — showing it would repeat exactly the mistake
          the storefront audit flagged. Real product photography carries this section instead,
          via the board cards below (swap in via Admin → Categories once real office photos exist). */}

      <section className="office-boards" data-reveal>
        <div className="spread shelf-head">
          <div>
            <p className="deli-eyebrow">Choose food for the meeting</p>
            <h2 className="section-h" style={{ margin: 0 }}>Office platters</h2>
          </div>
          <Link className="btn-ghost" to="/shop/office-corporate">See all office platters →</Link>
        </div>
        {boards.length === 0 ? (
          <p className="muted" role="status">Office platters are being updated — <Link to="/shop">browse the shop</Link> or ask us below.</p>
        ) : (
          <div className="board-grid">
            {boards.map((g, i) => {
              const p = g.lead;
              const toDetail = (e: React.MouseEvent<HTMLElement>) =>
                morphNavigate(navigate, `/platter/${p.id}`, e.currentTarget.closest("article")?.querySelector(".board-card-img") as HTMLElement | null);
              return (
                <article key={p.id} className="board-card card" data-reveal data-reveal-delay={String(i % 2)}>
                  <Link to={`/platter/${p.id}`} className="deli-product-image" aria-label={`View ${p.name}`}>
                    {p.imageUrl ? <img className="board-card-img" src={p.imageUrl} alt={p.name} width="640" height="480" loading="lazy" /> : <span className="deli-image-placeholder">Kelly&apos;s Deli<br /><small>{p.name}</small></span>}
                  </Link>
                  <div className="board-card-body">
                    <h3 className="board-card-name"><Link to={`/platter/${p.id}`}>{p.name}</Link></h3>
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

      <section className="office-info-grid" data-reveal>
        <div className="office-info-card">
          <h2 className="step-h">Will this feed everyone?</h2>
          <p>Each board's size tells you how many it serves. Planning a full lunch, or food alongside other dishes? Tell us your numbers when you enquire and we'll suggest enough — never a guess, always confirmed with you.</p>
        </div>
        <div className="office-info-card">
          <h2 className="step-h">Collection, delivery &amp; dietary needs</h2>
          <p>Collect from our deli at 1 Slater Road, Bentley Heath, Solihull B93 8AQ. {nextDay ? "Regular office orders are delivered the next working day." : "Delivery is available for regular office orders — tell us your postcode and we'll confirm."} Please tell us about allergies or dietary requirements before you book — we'll discuss what we can provide.</p>
        </div>
        <div className="office-info-card">
          <h2 className="step-h">Ordering regularly?</h2>
          <p>Set up a standing weekly, fortnightly or monthly lunch and we'll invoice monthly where that's agreed. Tell us how often you need feeding and whether you need an invoice — we'll set it up with you directly, nothing is billed automatically.</p>
        </div>
      </section>

      <section className="office-enquiry" id="enquiry" data-reveal>
        <div className="office-enquiry-intro">
          <h2 className="office-enquiry-h" id="enquiry-h" tabIndex={-1}>Tell us what you need</h2>
          <p className="muted">A one-off meeting or a regular lunch — send us the details you know and we'll take it from there.</p>
        </div>
        <CorporateEnquiryForm nextDayConfirmed={nextDay} />
      </section>

      <section className="office-faq" data-reveal>
        <h2 className="choice-h">Office catering — questions</h2>
        {OFFICE_FAQ.map((item) => (
          <details className="faq-item" key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>

      <section className="office-contact" data-reveal>
        <p>
          <strong>Collect from:</strong>{" "}
          <a href="https://www.google.com/maps/search/?api=1&query=Kelly%27s+Deli+1+Slater+Road+Solihull+B93+8AQ" target="_blank" rel="noreferrer">
            1 Slater Road, Bentley Heath, Solihull B93 8AQ ↗
          </a>
        </p>
        <p><strong>Email:</strong> <a href="mailto:hello@kellysdeli.co.uk">hello@kellysdeli.co.uk</a></p>
        <p><Link to="/shop">← Browse the full shop</Link></p>
      </section>
    </div>
  );
}
