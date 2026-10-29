import type { Request, Response, NextFunction } from "express";
import type { Location, Platter } from "@prisma/client";
import { prisma } from "./prisma";
import content from "../content/seo-content.json";

/**
 * Server-rendered page content for search engines and AI assistants.
 *
 * The storefront is a React SPA, so without this every URL served the same empty
 * `<div id="root">`. Google renders JavaScript eventually; GPTBot, ClaudeBot,
 * PerplexityBot and most link-preview bots don't at all, so they saw no products, no
 * prices and no shops — which is why ChatGPT could name us but not say why.
 *
 * For every public route we build a plain-HTML snapshot of the page's real content
 * (from the same DB the React app reads) plus a route-specific <title>, description,
 * canonical and JSON-LD, and inject it into index.html. Everyone gets the same HTML —
 * people and bots alike, so this is not cloaking — and React's createRoot() replaces
 * the snapshot as soon as the bundle runs.
 *
 * Structured data is emitted here, once per page, and the static JSON-LD in
 * index.html is stripped (it stays only as the fallback when rendering fails).
 *
 * Unknown paths return a real 404 (with noindex) instead of a 200 "soft 404".
 */

export const SITE = "https://www.kellysdeli.co.uk";
export const OG_IMAGE = `${SITE}/images/og-kellys-deli.jpg`;

export type SeoPage = {
  status: number;
  title: string;
  description: string;
  path: string;
  /** Canonical path when it differs from `path` (e.g. a board's other sizes). */
  canonical?: string;
  body: string;
  jsonLd: object[];
  noindex?: boolean;
};

type Hours = Record<string, string>;
const DAYS: Array<{ key: string; label: string }> = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

// ---------------------------------------------------------------- helpers

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** The seed's "[CHECK PRICE & DETAILS]" owner-review marker — the React pages strip it too. */
export const cleanDesc = (s: string | null | undefined): string => (s ?? "").replace(/\s*\[CHECK PRICE.*?\]\s*$/i, "").trim();

/** Absolute URL for a product photo, or nothing for stock-library images (never pass those off as ours). */
const realImage = (url: string | null | undefined): string | undefined =>
  !url || /unsplash\.com|pexels\.com/i.test(url) ? undefined : url.startsWith("http") ? url : SITE + url;

const gbp = (n: number): string => `£${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
const link = (href: string, text: string) => `<a href="${esc(href)}">${esc(text)}</a>`;
const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : "");

function platterPrice(p: Platter): { amount: number; perHead: boolean } | null {
  if (p.fixedPrice != null) return { amount: Number(p.fixedPrice), perHead: false };
  if (p.pricePerHead != null) return { amount: Number(p.pricePerHead), perHead: true };
  return null;
}
const priceText = (p: Platter): string | null => {
  const pr = platterPrice(p);
  return pr ? (pr.perHead ? `${gbp(pr.amount)} per person` : gbp(pr.amount)) : null;
};
function platterFeeds(p: Platter): string | null {
  if (p.serves) return p.serves;
  if (p.feedsMin && p.feedsMax) return `${p.feedsMin}–${p.feedsMax}`;
  if (p.feedsMin) return `${p.feedsMin}+`;
  return null;
}
function platterLine(p: Platter): string {
  const bits = [priceText(p), platterFeeds(p) ? `feeds ${platterFeeds(p)}` : null].filter(Boolean);
  return `${link(`/platter/${p.id}`, p.name)}${bits.length ? ` — ${esc(bits.join(", "))}` : ""}`;
}

/** "8", "8:00", "8am", "4.30pm", "16:00" -> "HH:MM"; anything else -> null. */
export function parseClock(t: string): string | null {
  const m = t.trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Admin hours are free text: "08:00-16:00", "8am – 4pm", "8 to 4". Closed/blank/unreadable -> null. */
export function parseRange(raw: string | undefined): [string, string] | null {
  if (!raw || /closed/i.test(raw)) return null;
  const parts = raw.split(/\s*(?:-|–|—|to)\s*/i);
  if (parts.length !== 2) return null;
  const a = parseClock(parts[0]);
  const b = parseClock(parts[1]);
  return a && b ? [a, b] : null;
}

function hoursHtml(h: Hours | null): string {
  if (!h) return "";
  return `<dl class="seo-hours">${DAYS.map((d) => {
    const raw = (h[d.key] ?? "").trim();
    const r = parseRange(raw);
    // Unreadable but non-empty text is shown as typed rather than turned into "Closed".
    const shown = r ? `${r[0]}–${r[1]}` : raw && !/closed/i.test(raw) ? raw : "Closed";
    return `<dt>${d.label}</dt><dd>${esc(shown)}</dd>`;
  }).join("")}</dl>`;
}

function hoursSchema(h: Hours | null) {
  if (!h) return undefined;
  const specs = DAYS.map((d) => ({ d, r: parseRange(h[d.key]) }))
    .filter((x): x is { d: (typeof DAYS)[number]; r: [string, string] } => !!x.r)
    .map(({ d, r }) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: d.label, opens: r[0], closes: r[1] }));
  return specs.length ? specs : undefined;
}

const locContent = (slug: string) => (content.locations as Record<string, (typeof content.locations)["bentley-heath"]>)[slug];
const mapUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

function locationSchema(l: Location) {
  const c = locContent(l.slug);
  const hours = l.openingHours as Hours | null;
  return {
    "@type": ["Delicatessen", "FoodEstablishment", "LocalBusiness"],
    "@id": `${SITE}/#${l.slug}`,
    name: `Kelly's Deli — ${l.name}`,
    url: `${SITE}/${l.slug}`,
    branchOf: { "@id": `${SITE}/#organization` },
    image: OG_IMAGE,
    priceRange: "££",
    servesCuisine: ["Delicatessen", "Grazing boards", "Charcuterie", "Catering"],
    ...(l.phone ? { telephone: l.phone } : {}),
    email: "hello@kellysdeli.co.uk",
    address: {
      "@type": "PostalAddress",
      streetAddress: l.address ?? undefined,
      addressRegion: l.slug === "bentley-heath" ? "Solihull" : "Warwickshire",
      postalCode: l.postcode ?? undefined,
      addressCountry: "GB",
    },
    ...(c ? { areaServed: c.areaServedSchema.map((name) => ({ "@type": "Place", name })), hasMap: mapUrl(c.mapQuery) } : {}),
    hasMenu: `${SITE}/platters`,
    openingHoursSpecification: hoursSchema(hours),
  };
}

/** The business and its shops, once per page, built from live DB hours. */
function businessGraph(locs: Location[]) {
  const shops = locs.filter((l) => locContent(l.slug));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: "Kelly's Deli",
        url: `${SITE}/`,
        email: "hello@kellysdeli.co.uk",
        logo: `${SITE}/favicon.svg`,
        image: OG_IMAGE,
        description:
          "Independent, family-run deli with shops in Bentley Heath (Solihull) and Stratford-upon-Avon, making grazing boards, party platters and office catering to order for collection, with bread, lunch and a deli counter.",
        department: shops.map((l) => ({ "@id": `${SITE}/#${l.slug}` })),
      },
      ...shops.map(locationSchema),
    ],
  };
}

function breadcrumb(trail: Array<[string, string]>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [["Home", "/"] as [string, string], ...trail].map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: SITE + path,
    })),
  };
}

// Same questions the visible <Faq /> renders on these pages (one source in seo-content.json).
const faqSchema = (items: Array<{ q: string; a: string }>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
});
const faqHtml = (items: Array<{ q: string; a: string }>) =>
  `<section><h2>Questions</h2>${items.map((i) => `<h3>${esc(i.q)}</h3><p>${esc(i.a)}</p>`).join("")}</section>`;

const NAV = [
  ["/", "Home"],
  ["/platters", "Boards & platters"],
  ["/shop/hosting", "Party platters"],
  ["/party-food-solihull", "Party food guide"],
  ["/office-catering", "Office catering"],
  ["/lunch", "Lunch"],
  ["/bread", "Bread"],
  ["/groceries", "Deli counter"],
  ["/bentley-heath", "Bentley Heath"],
  ["/stratford-upon-avon", "Stratford-upon-Avon"],
  ["/our-story", "Our story"],
] as const;

function shopsFooter(locs: Location[]): string {
  return `<section><h2>Our shops</h2>${locs
    .filter((l) => locContent(l.slug))
    .map(
      (l) =>
        `<p><strong>${link(`/${l.slug}`, `Kelly's Deli ${l.name}`)}</strong><br>${esc([l.address, l.postcode].filter(Boolean).join(", "))}${
          l.phone ? `<br>Tel: ${esc(l.phone)}` : ""
        }</p>`
    )
    .join("")}<p>Email: hello@kellysdeli.co.uk</p></section>`;
}

function frame(h1: string, inner: string, locs: Location[]): string {
  return `<div class="seo-snapshot"><header class="seo-top"><a class="seo-brand" href="/">Kelly&#39;s Deli</a><nav aria-label="Site">${NAV.map(([href, t]) =>
    link(href, t)
  ).join("")}</nav></header><main class="seo-main"><h1>${esc(h1)}</h1>${inner}${shopsFooter(locs)}</main></div>`;
}

const whyUsHtml = () => `<section><h2>Why Kelly&#39;s Deli</h2>${list(content.whyUs.map((w) => esc(w.fact)))}</section>`;

// ---------------------------------------------------------------- data

async function activeLocations(): Promise<Location[]> {
  return prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}
async function activePlatters(): Promise<Platter[]> {
  return prisma.platter.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
}
async function settings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Board / feeds / price, one row per board (each size is its own row). */
function boardTable(platters: Platter[]): string {
  if (!platters.length) return "";
  const rows = platters
    .map((p) => `<tr><td>${link(`/platter/${p.id}`, p.name)}</td><td>${esc(platterFeeds(p) ?? "—")}</td><td>${esc(priceText(p) ?? "—")}</td></tr>`)
    .join("");
  return `<table><thead><tr><th>Board</th><th>Feeds</th><th>Price</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ---------------------------------------------------------------- routes

const notFound = (locs: Location[]): SeoPage => ({
  status: 404,
  title: "Page not found — Kelly's Deli",
  description: "That page isn't on the menu. Browse grazing boards, party platters, bread and the deli counter at Kelly's Deli.",
  path: "/404",
  noindex: true,
  jsonLd: [],
  body: frame("That page isn't on the menu", `<p>${link("/", "Back to the homepage")}</p>`, locs),
});

const PRIVATE_PREFIXES = ["/admin", "/order", "/confirm"];

/** Every page gets the business graph; route builders add their own nodes on top. */
export async function buildSeoPage(rawPath: string): Promise<SeoPage> {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  if (PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return { status: 200, title: "Kelly's Deli", description: "", path, noindex: true, jsonLd: [], body: "" };
  }
  // Bot probes for files (/wp-login.php, /favicon.ico, /.env) never reach the DB.
  if (/\.[a-z0-9]{1,8}$/i.test(path)) return notFound([]);

  const locs = await activeLocations();
  const page = await routePage(path, locs);
  if (page.status === 200) page.jsonLd = [businessGraph(locs), ...page.jsonLd];
  return page;
}

async function routePage(path: string, locs: Location[]): Promise<SeoPage> {
  const faq = content.faq;

  if (path === "/") {
    const [platters, s, cats] = await Promise.all([
      prisma.platter.findMany({ where: { active: true, tier: "signature" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 12 }),
      settings(["missionTagline"]),
      prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    ]);
    const inner = [
      `<p>Kelly's Deli is an independent, family-run deli with shops in Bentley Heath, Solihull and Stratford-upon-Avon. We make grazing boards, party platters and office catering to order. You can also pre-order bread and lunch, and click and collect from the deli counter.</p>`,
      s.missionTagline ? `<p>${esc(s.missionTagline)}</p>` : "",
      `<h2>What can we get you?</h2>`,
      list([
        `${link("/shop/hosting", "Events & parties")} — birthdays, showers and celebrations`,
        `${link("/lunch", "Lunch")} — order sandwiches and salads ahead`,
        `${link("/bread", "Bread")} — baked fresh every day, pre-order for collection`,
        `${link("/groceries", "Deli counter")} — click and collect`,
        `${link("/shop/at-home", "At home dining")} — boards for a night in`,
        `${link("/office-catering", "Office & catering")} — meetings and team lunches`,
        `${link("/platters", "Boards & catering")} — every board and platter, with what it feeds`,
        ...cats.filter((c) => !["at-home", "hosting"].includes(c.slug)).map((c) => `${link(`/shop/${c.slug}`, c.name)}${c.tagline ? ` — ${esc(c.tagline)}` : ""}`),
      ]),
      platters.length ? `<h2>Signature boards</h2>${list(platters.map(platterLine))}` : "",
      whyUsHtml(),
      `<h2>Planning a party?</h2><p>${link(content.partyGuide.path, "Party food in Solihull: what to order, how much, and when")}</p>`,
      faqHtml(faq),
    ].join("");
    return {
      status: 200,
      title: "Kelly's Deli — Grazing Boards & Platters, Bentley Heath & Stratford-upon-Avon",
      description:
        "Family-run deli in Bentley Heath (Solihull) and Stratford-upon-Avon. Grazing boards and party platters made to order with 48 hours' notice, plus bread, lunch and a deli counter for collection.",
      path,
      jsonLd: [{ "@context": "https://schema.org", "@type": "WebSite", name: "Kelly's Deli", url: `${SITE}/` }, faqSchema(faq)],
      body: frame("Kelly's Deli — grazing boards, party platters & a proper deli counter", inner, locs),
    };
  }

  if (path === "/platters") {
    const platters = await activePlatters();
    return {
      status: 200,
      title: "Grazing Boards & Catering Platters to Order — Kelly's Deli",
      description: "Every grazing board and catering platter at Kelly's Deli, with what each one feeds and costs. Made to order for collection in Bentley Heath, Solihull or Stratford-upon-Avon.",
      path,
      jsonLd: [breadcrumb([["Boards & platters", path]]), faqSchema(faq)],
      body: frame(
        "Grazing boards & catering platters",
        `<p>Charcuterie, cheese, savoury and smoked-salmon boards and catering platters, made to order with at least 48 hours' notice and collected from Bentley Heath or Stratford-upon-Avon.</p>${boardTable(platters)}${faqHtml(faq)}`,
        locs
      ),
    };
  }

  if (path === "/shop") {
    const cats = await prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
    return {
      status: 200,
      title: "Shop by Occasion — Kelly's Deli",
      description: "Grazing boards and platters by occasion: hosting, a night in, office and corporate. Made to order at Kelly's Deli, Solihull and Stratford-upon-Avon.",
      path,
      jsonLd: [breadcrumb([["Shop", path]]), faqSchema(faq)],
      body: frame("Shop by occasion", list(cats.map((c) => `${link(`/shop/${c.slug}`, c.name)}${c.tagline ? ` — ${esc(c.tagline)}` : ""}`)) + faqHtml(faq), locs),
    };
  }

  const cat = path.match(/^\/shop\/([a-z0-9-]+)$/);
  if (cat) {
    const c = await prisma.category.findUnique({
      where: { slug: cat[1] },
      include: { platters: { include: { platter: true }, orderBy: { sortOrder: "asc" } } },
    });
    if (!c || !c.active) return notFound(locs);
    const boards = c.platters.map((pc) => pc.platter).filter((p) => p.active);
    return {
      status: 200,
      title: c.seoTitle || `${c.name} — Grazing Boards & Platters | Kelly's Deli`,
      description: c.seoDescription || c.tagline || `${c.name} boards and platters from Kelly's Deli, made to order for collection.`,
      path,
      jsonLd: [breadcrumb([["Shop", "/shop"], [c.name, path]]), faqSchema(faq)],
      body: frame(
        c.name,
        `${c.tagline ? `<p>${esc(c.tagline)}</p>` : ""}${c.description ? `<p>${esc(c.description)}</p>` : ""}${boardTable(boards)}${faqHtml(faq)}`,
        locs
      ),
    };
  }

  const board = path.match(/^\/platter\/([a-z0-9_-]+)$/);
  if (board) {
    const p = await prisma.platter.findUnique({ where: { id: board[1] } });
    if (!p || !p.active) return notFound(locs);
    const siblings = p.variantGroup
      ? await prisma.platter.findMany({ where: { active: true, variantGroup: p.variantGroup }, orderBy: [{ variantOrder: "asc" }, { createdAt: "asc" }] })
      : [p];
    // The Product node always describes the lead size (the canonical page) so name,
    // description and image agree; the visible body describes the size actually asked for.
    const lead = siblings[0] ?? p;
    const desc = cleanDesc(p.description);
    const leadDesc = cleanDesc(lead.description);
    const items = Array.isArray(p.items) ? (p.items as Array<{ label?: string }>).map((i) => i?.label).filter((l): l is string => !!l) : [];
    // Only fixed prices become Offers: a per-head price as a flat "price" would misstate it.
    const offers = siblings
      .filter((v) => v.fixedPrice != null)
      .map((v) => ({
        "@type": "Offer",
        name: v.variantLabel || v.name,
        price: Number(v.fixedPrice).toFixed(2),
        priceCurrency: "GBP",
        availability: "https://schema.org/MadeToOrder",
        url: `${SITE}/platter/${v.id}`,
        seller: { "@id": `${SITE}/#organization` },
      }));
    const image = realImage(lead.imageUrl);
    return {
      status: 200,
      title: `${p.name} — Kelly's Deli`,
      description: (desc || `${p.name}, made to order at Kelly's Deli for collection.`).slice(0, 155),
      path,
      canonical: `/platter/${lead.id}`,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: lead.name,
          ...(leadDesc ? { description: leadDesc } : {}),
          ...(image ? { image } : {}),
          brand: { "@type": "Brand", name: "Kelly's Deli" },
          ...(offers.length ? { offers } : {}),
        },
        breadcrumb([["Boards & platters", "/platters"], [lead.name, `/platter/${lead.id}`]]),
      ],
      body: frame(
        p.name,
        `${desc ? `<p>${esc(desc)}</p>` : ""}${siblings.length > 1 ? `<h2>Sizes</h2>${boardTable(siblings)}` : `<p>${platterLine(p)}</p>`}${
          items.length ? `<h2>What's on it</h2>${list(items.map(esc))}` : ""
        }<p>Made to order with at least 48 hours' notice, for collection from Bentley Heath or Stratford-upon-Avon.</p>`,
        locs
      ),
    };
  }

  if (path === "/bread") {
    const bread = await prisma.breadProduct.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    return {
      status: 200,
      title: "Fresh Bread to Pre-order — Kelly's Deli",
      description: "Bread baked fresh every day and delivered to Kelly's Deli by our own baker. Pre-order for collection in Bentley Heath, Solihull or Stratford-upon-Avon.",
      path,
      jsonLd: [breadcrumb([["Bread", path]])],
      body: frame(
        "Bread, pre-ordered",
        `<p>Our bread is baked fresh every day and delivered to us by our own baker. Pick your loaves, pick a collection day, and we'll have them waiting at the counter. Pay on collection.</p>${list(
          bread.map((b) => `${esc(b.name)} — ${esc(gbp(Number(b.price)))}${b.description ? `. ${esc(cleanDesc(b.description))}` : ""}`)
        )}`,
        locs
      ),
    };
  }

  if (path === "/groceries" || path === "/lunch") {
    const all = await prisma.groceryProduct.findMany({ where: { active: true }, orderBy: [{ department: "asc" }, { sortOrder: "asc" }] });
    // Lunch is the sandwich builder (client/src/pages/Lunch.tsx): sandwiches + the salad box,
    // not the whole counter — so the two pages aren't near-duplicates.
    const products = path === "/lunch" ? all.filter((g) => g.department === "sandwiches" || (g.department === "salads" && /salad box/i.test(g.name))) : all;
    const byDept = new Map<string, typeof products>();
    for (const g of products) byDept.set(g.department, [...(byDept.get(g.department) ?? []), g]);
    const depts = [...byDept.entries()]
      .map(
        ([d, items]) =>
          `<h2>${esc(d.charAt(0).toUpperCase() + d.slice(1).replace(/-/g, " "))}</h2>${list(
            items.map((g) => `${esc(g.name)}${Number(g.price) > 0 ? ` — ${esc(gbp(Number(g.price)))}${g.unitLabel ? ` ${esc(g.unitLabel)}` : ""}` : ""}`)
          )}`
      )
      .join("");
    const lunch = path === "/lunch";
    return {
      status: 200,
      title: lunch ? "Order Lunch for Collection — Kelly's Deli" : "Deli Counter Click & Collect — Kelly's Deli",
      description: lunch
        ? "Order sandwiches, salads and lunch from Kelly's Deli ahead, ready to collect in Bentley Heath, Solihull or Stratford-upon-Avon."
        : "Order from the Kelly's Deli counter online: sandwiches, salads and more, for click and collect in Solihull or Stratford-upon-Avon.",
      path,
      jsonLd: [breadcrumb([[lunch ? "Lunch" : "Deli counter", path]])],
      body: frame(
        lunch ? "Lunch, ordered ahead" : "The deli counter, click & collect",
        `<p>${lunch ? "Order ahead and collect from your chosen shop." : "Order from the counter online and collect from your chosen shop."} Pay on collection.</p>${depts}`,
        locs
      ),
    };
  }

  const loc = locs.find((l) => path === `/${l.slug}`);
  if (loc && locContent(loc.slug)) {
    const c = locContent(loc.slug);
    const hours = loc.openingHours as Hours | null;
    return {
      status: 200,
      title: c.title,
      description: c.description,
      path,
      // The shop's LocalBusiness node is already in the business graph every page carries.
      jsonLd: [breadcrumb([[loc.name, path]])],
      body: frame(
        c.h1,
        `<p>${esc(c.lede)}</p><h2>Address</h2><p>${esc([loc.address, loc.postcode].filter(Boolean).join(", "))}<br>${link(mapUrl(c.mapQuery), "Open in Google Maps")}</p>${
          loc.phone ? `<p>Tel: ${esc(loc.phone)}</p>` : ""
        }<h2>Opening hours</h2>${hoursHtml(hours)}<h2>Handy for</h2><p>${esc(c.nearby.join(", "))}</p><h2>Order for collection here</h2>${list([
          link("/platters", "Grazing boards & platters"),
          link("/shop/hosting", "Party platters"),
          link("/lunch", "Lunch"),
          link("/bread", "Bread"),
          link("/groceries", "Deli counter"),
        ])}${whyUsHtml()}`,
        locs
      ),
    };
  }

  if (path === content.partyGuide.path) {
    const g = content.partyGuide;
    const platters = (await activePlatters()).filter((p) => platterFeeds(p));
    return {
      status: 200,
      title: g.title,
      description: g.description,
      path,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: g.h1,
          description: g.description,
          image: OG_IMAGE,
          author: { "@id": `${SITE}/#organization` },
          publisher: { "@id": `${SITE}/#organization` },
          mainEntityOfPage: SITE + path,
        },
        faqSchema(g.sections.map((s) => ({ q: s.h, a: s.p }))),
        breadcrumb([["Party food in Solihull", path]]),
      ],
      body: frame(
        g.h1,
        `<p><strong>${esc(g.answer)}</strong></p>${g.sections
          .map((s, i) => `<h2>${esc(s.h)}</h2><p>${esc(s.p)}</p>${i === 0 ? boardTable(platters) : ""}`)
          .join("")}<h2>Occasions we cater for</h2><p>${esc(g.occasions.join(", "))}</p>${whyUsHtml()}<p>${link("/shop/hosting", "See party platters")}</p>`,
        locs
      ),
    };
  }

  if (path === "/office-catering") {
    const officeFaq = content.officeFaq;
    return {
      status: 200,
      title: "Office Catering in Solihull — Platters & Team Lunches | Kelly's Deli",
      description: "Platters for meetings, team lunches and workplace events from Kelly's Deli in Bentley Heath, Solihull. Standing weekly or monthly orders, with invoicing where agreed.",
      path,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Office catering",
          name: "Kelly's Deli office catering",
          description: "Boards and platters for meetings, team lunches and workplace gatherings, prepared by Kelly's Deli in Bentley Heath, Solihull.",
          provider: { "@id": `${SITE}/#bentley-heath` },
          areaServed: ["Solihull", "Bentley Heath", "Knowle", "Dorridge"].map((name) => ({ "@type": "Place", name })),
          url: SITE + path,
        },
        faqSchema(officeFaq),
        breadcrumb([["Office catering", path]]),
      ],
      body: frame(
        "Office catering",
        `<p>Platters for meetings, team lunches and workplace gatherings across Solihull, Knowle and Dorridge, with standing weekly, fortnightly or monthly orders and invoicing where agreed. Tell us your headcount and how often, and we'll come back with a plan.</p>${faqHtml(officeFaq)}`,
        locs
      ),
    };
  }

  const STATIC: Record<string, { title: string; description: string; h1: string; p: string; crumb: string }> = {
    "/plan": {
      title: "Plan Your Event Catering — Kelly's Deli",
      description: "Tell Kelly's Deli your headcount and occasion and we'll suggest the boards and platters to match.",
      h1: "Plan your event",
      p: "Tell us how many people and what the occasion is, and we'll suggest the boards and add-ons to feed them.",
      crumb: "Plan an event",
    },
    "/privacy": { title: "Privacy — Kelly's Deli", description: "How Kelly's Deli handles your personal data.", h1: "Privacy", p: "How we collect and use your details when you order.", crumb: "Privacy" },
    "/terms": { title: "Terms — Kelly's Deli", description: "Ordering terms for Kelly's Deli.", h1: "Terms", p: "Ordering, deposits, collection and cancellations.", crumb: "Terms" },
  };
  if (STATIC[path]) {
    const s = STATIC[path];
    return { status: 200, title: s.title, description: s.description, path, jsonLd: [breadcrumb([[s.crumb, path]])], body: frame(s.h1, `<p>${esc(s.p)}</p>`, locs) };
  }

  if (path === "/our-story") {
    const s = await settings(["missionTagline", "aboutText", "founderNote"]);
    return {
      status: 200,
      title: "Our Story — Kelly's Deli, Bentley Heath & Stratford-upon-Avon",
      description: "Kelly's Deli is a family-run delicatessen in Bentley Heath, Solihull and Stratford-upon-Avon. Meet the deli behind the boards.",
      path,
      jsonLd: [
        { "@context": "https://schema.org", "@type": "AboutPage", name: "Our story — Kelly's Deli", url: SITE + path, about: { "@id": `${SITE}/#organization` } },
        breadcrumb([["Our story", path]]),
      ],
      body: frame(
        "Our story",
        `<h2>${esc(content.family.h)}</h2><p>${esc(content.family.p)}</p>` +
          [s.missionTagline, s.founderNote, s.aboutText].filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join("") +
          whyUsHtml(),
        locs
      ),
    };
  }

  return notFound(locs);
}

// ---------------------------------------------------------------- HTML injection

// Every replacement below passes a FUNCTION, never a string: in a replacement string
// `$'`, `` $` `` and `$&` are special, so admin text containing them would splice the
// page into itself.
const setTag = (html: string, re: RegExp, value: string) => html.replace(re, () => value);

/** Pure: puts a SeoPage into the built index.html. Exported for tests. */
export function injectSeo(template: string, page: SeoPage): string {
  const url = SITE + (page.path === "/404" ? "/" : page.canonical ?? page.path);
  let html = template;
  // The template's static JSON-LD is only the fallback for a failed render; the page's
  // own structured data replaces it so nothing appears twice.
  html = html.replace(/[ \t]*<!--[^>]*?(?:Structured data|FAQ structured data)[\s\S]*?-->\s*/g, () => "");
  html = html.replace(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, () => "");
  html = setTag(html, /<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`);
  if (page.description) {
    html = setTag(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(page.description)}" />`);
    html = setTag(html, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(page.description)}" />`);
    html = setTag(html, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${esc(page.description)}" />`);
  }
  html = setTag(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(page.title)}" />`);
  html = setTag(html, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${esc(page.title)}" />`);
  html = setTag(html, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${esc(url)}" />`);
  html = setTag(html, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${esc(url)}" />`);
  if (page.noindex) html = setTag(html, /<meta name="robots" content="[^"]*"\s*\/?>/, `<meta name="robots" content="noindex, follow" />`);
  // "<" is escaped so a product description can never close the script tag.
  const ld = page.jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n    ");
  if (ld) html = html.replace("</head>", () => `    ${ld}\n  </head>`);
  html = html.replace('<div id="root"></div>', () => `<div id="root">${page.body}</div>`);
  return html;
}

// ---------------------------------------------------------------- cache + handler

// Short cache so a crawler sweeping the sitemap doesn't mean a DB round trip per page.
// Only known (200) pages are cached, so random 404 URLs can't grow it.
const cache = new Map<string, { at: number; page: SeoPage }>();
const TTL_MS = 60_000;

export async function seoPageCached(path: string): Promise<SeoPage> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.page;
  const page = await buildSeoPage(path);
  if (page.status === 200) {
    if (cache.size > 500) cache.clear();
    cache.set(path, { at: Date.now(), page });
  }
  return page;
}

/** Paths whose case matters (order refs) or that only the app handles. */
const CASE_SENSITIVE = /^\/(confirm|admin|order)(\/|$)/i;
export const RENDER_TIMEOUT_MS = 800;

/**
 * Express handler for every non-API GET. Lowercases URLs with a 301 (React Router
 * matches case-insensitively, so /Bentley-Heath would otherwise render the page with a
 * 404 status), renders the SEO page, and falls back to the plain shell if rendering
 * fails or takes longer than RENDER_TIMEOUT_MS — a slow DB must never hold up the shop.
 */
export function seoHtmlHandler(indexHtml: string, build: (path: string) => Promise<SeoPage> = seoPageCached, timeoutMs = RENDER_TIMEOUT_MS) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
    if (req.path !== req.path.toLowerCase() && !CASE_SENSITIVE.test(req.path)) {
      const q = req.originalUrl.indexOf("?");
      // Collapse leading slashes/backslashes: "//Evil.com" must never become a
      // protocol-relative Location that sends people off-site (open redirect).
      const target = "/" + req.path.toLowerCase().replace(/^[/\\]+/, "");
      return res.redirect(301, target + (q >= 0 ? req.originalUrl.slice(q) : ""));
    }
    let timer: NodeJS.Timeout | undefined;
    try {
      const page = await Promise.race([
        build(req.path),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`render exceeded ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
      res.status(page.status).type("html").send(injectSeo(indexHtml, page));
    } catch (e) {
      console.error("[seo] render failed, serving plain shell:", e instanceof Error ? e.message : e);
      res.type("html").send(indexHtml);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
