// Server-side <head> rewriting for the SPA's money pages.
//
// The client sets per-page titles/meta with JS, but link-preview bots (WhatsApp, Facebook,
// iMessage, LinkedIn) never run JS and Google indexes the first HTML it gets before
// rendering. Without this every URL previews as the homepage. These helpers are pure
// (string in, string out) so they're unit-tested without a DB or a built client.

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  /** Absolute image URL. Omitted/null = keep index.html's default og:image. */
  image?: string | null;
  /** Alt text for og:image:alt — only used when `image` is set (the default alt describes the default photo). */
  imageAlt?: string | null;
  /** og:type, e.g. "product". Omitted = keep index.html's ("website"). */
  type?: string;
  /** Extra structured data appended as a <script type="application/ld+json"> in <head>. */
  jsonLd?: object | null;
}

/** Escape text for an HTML attribute value or text node. */
export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Value of `attr` on a single tag string (any quoting, any attribute order), or null. */
function readAttr(tag: string, attr: string): string | null {
  const m = new RegExp(`\\s${escapeRe(attr)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}

/**
 * On the first <tagName> whose `keyAttrs` (any one of them) equals `keyValue`, set
 * `targetAttr` to `value`. Attribute-order tolerant; no-op if the tag (or its target
 * attribute) isn't there, so a reworded index.html degrades to "generic meta", not a crash.
 */
function setTagAttr(html: string, tagName: string, keyAttrs: string[], keyValue: string, targetAttr: string, value: string): string {
  let done = false;
  const target = new RegExp(`(\\s${escapeRe(targetAttr)}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s"'>]+)`, "i");
  return html.replace(new RegExp(`<${tagName}\\b[^>]*>`, "gi"), (tag) => {
    if (done) return tag;
    const isKey = keyAttrs.some((a) => (readAttr(tag, a) ?? "").toLowerCase() === keyValue.toLowerCase());
    if (!isKey || !target.test(tag)) return tag;
    done = true;
    // Function replacer so a "$" in the value is never treated as a back-reference.
    return tag.replace(target, (_m, pre: string) => `${pre}"${escapeHtml(value)}"`);
  });
}

// og:* use property=, twitter:* and description use name= — but accept either, since
// both appear in the wild and a template edit shouldn't silently break previews.
const setMeta = (html: string, key: string, content: string) =>
  setTagAttr(html, "meta", ["property", "name"], key, "content", content);

/**
 * Rewrite index.html's <head> for one page. Only the head is touched (an inline SVG
 * <title> in the body must never be rewritten). Missing tags are skipped, never thrown.
 */
export function injectMeta(html: string, meta: PageMeta): string {
  const headEnd = html.search(/<\/head\s*>/i);
  if (headEnd === -1) return html; // not a document we understand — serve it as-is
  let head = html.slice(0, headEnd);
  const rest = html.slice(headEnd);

  head = head.replace(/(<title\b[^>]*>)[\s\S]*?(<\/title\s*>)/i, (_m, open: string, close: string) => `${open}${escapeHtml(meta.title)}${close}`);
  head = setMeta(head, "description", meta.description);
  head = setTagAttr(head, "link", ["rel"], "canonical", "href", meta.canonical);

  head = setMeta(head, "og:title", meta.title);
  head = setMeta(head, "og:description", meta.description);
  head = setMeta(head, "og:url", meta.canonical);
  head = setMeta(head, "twitter:title", meta.title);
  head = setMeta(head, "twitter:description", meta.description);
  if (meta.type) head = setMeta(head, "og:type", meta.type);
  if (meta.image) {
    head = setMeta(head, "og:image", meta.image);
    head = setMeta(head, "og:image:alt", meta.imageAlt || meta.title);
    head = setMeta(head, "twitter:image", meta.image);
  }

  if (meta.jsonLd) {
    // "</" inside the JSON would close the <script> early (e.g. a description containing
    // "</script>") — "<\/" is the same string to a JSON parser but inert to the HTML one.
    const json = JSON.stringify(meta.jsonLd).replace(/<\//g, "<\\/");
    head += `  <script type="application/ld+json">${json}</script>\n  `;
  }
  return head + rest;
}

/** Trim to ~`max` chars on a word boundary, for meta descriptions (Google shows ~155). */
export function clip(text: string, max = 155): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const atWord = cut.lastIndexOf(" ") > max * 0.6 ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
  return `${atWord.replace(/[\s,.;:!?—–-]+$/, "")}…`;
}

/**
 * Make an image URL absolute — bots fetch og:image out of context, so "/uploads/x.webp"
 * is useless to them. Returns null for anything we can't turn into an https(s) URL.
 */
export function absoluteUrl(url: string | null | undefined, origin: string): string | null {
  const u = (url ?? "").trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return `${origin}${u}`;
  return null;
}

/** The trailing "[CHECK PRICE …]" note is an owner-facing reminder — the client strips it too. */
export const cleanDescription = (s: string): string => s.replace(/\s*\[CHECK PRICE.*?\]\s*$/i, "");

export interface PlatterForMeta {
  id: string;
  name: string;
  description: string;
  fixedPrice: number | null;
  imageUrl: string | null;
  kind: string;
}

/** Meta + Product structured data for a /platter/:id page. */
export function platterMeta(p: PlatterForMeta, site: string): PageMeta {
  const canonical = `${site}/platter/${encodeURIComponent(p.id)}`;
  const description = cleanDescription(p.description);
  const image = absoluteUrl(p.imageUrl, site);
  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description,
    url: canonical,
    brand: { "@type": "Brand", name: "Kelly's Deli" },
  };
  if (image) product.image = image;
  // Per-head platters have no single price — an Offer without one is invalid for Google,
  // so it's only emitted for fixed-price lines.
  if (p.fixedPrice != null) {
    product.offers = {
      "@type": "Offer",
      priceCurrency: "GBP",
      price: p.fixedPrice.toFixed(2),
      availability: p.kind === "product" ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
      url: canonical,
      seller: { "@type": "Organization", name: "Kelly's Deli" },
    };
  }
  return {
    title: `${p.name} | Kelly's Deli`,
    description: clip(description || p.name),
    canonical,
    image,
    imageAlt: p.name,
    type: "product",
    jsonLd: product,
  };
}
