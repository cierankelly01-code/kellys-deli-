// "Paste a supplier link": fetch a supplier's product page and pull out the name,
// description, photo, price and SKU so the owner doesn't retype them. Reads the
// schema.org Product data most shop platforms publish (JSON-LD), falling back to the
// Open Graph tags every page has for social sharing.
//
// The server fetches a URL the admin typed, so it's guarded against being pointed at
// internal addresses (SSRF): http(s) only, every hop's address must be public, redirects
// are followed by hand so each one is re-checked, and size/time are capped.
import dns from "node:dns/promises";
import net from "node:net";

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
const UA = "Mozilla/5.0 (compatible; KellysDeliProductImport/1.0; +https://www.kellysdeli.co.uk)";

export class ImportError extends Error {}

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("ff");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImportError("That doesn't look like a web link");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ImportError("Only http(s) links can be imported");
  if (url.username || url.password) throw new ImportError("Links with logins in them can't be imported");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addrs.length === 0) throw new ImportError("Couldn't find that website");
  if (addrs.some(isPrivateAddress)) throw new ImportError("That address isn't a public website");
  return url;
}

/** GET a public URL, re-validating every redirect hop. Returns the final response body. */
async function safeFetch(raw: string, maxBytes: number, accept: string): Promise<{ body: Buffer; contentType: string; finalUrl: string }> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "en-GB,en;q=0.9" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => {
      throw new ImportError("Couldn't reach that website — check the link");
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new ImportError("That link redirects nowhere");
      current = new URL(loc, url).toString();
      continue;
    }
    if (!res.ok) throw new ImportError(`The supplier's site answered ${res.status} — is the product page public?`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > maxBytes) throw new ImportError("That page is too large to import");
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new ImportError("That page is too large to import");
        }
        chunks.push(value);
      }
    }
    return { body: Buffer.concat(chunks), contentType: res.headers.get("content-type") ?? "", finalUrl: url.toString() };
  }
  throw new ImportError("Too many redirects");
}

export interface ImportedProduct {
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  price: number | null; // the supplier's listed price — a starting point for the cost
  sku: string | null;
  brand: string | null;
  supplierName: string | null; // the site's own name, e.g. "Booker"
  sourceUrl: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", pound: "£" };
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const clean = (s: unknown, max = 2000): string | null => {
  if (typeof s !== "string") return null;
  const t = decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

function toPrice(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.round(v * 100) / 100;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  }
  return null;
}

function firstImage(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return firstImage(v[0]);
  if (v && typeof v === "object") return firstImage((v as { url?: unknown; contentUrl?: unknown }).url ?? (v as { contentUrl?: unknown }).contentUrl);
  return null;
}

function findProduct(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findProduct(n);
      if (hit) return hit;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  const type = o["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return o;
  if (o["@graph"]) return findProduct(o["@graph"]);
  if (o.mainEntity) return findProduct(o.mainEntity);
  return null;
}

function meta(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
}

/** Pull product details out of a page's HTML. Pure — exported for tests. */
export function parseProductHtml(html: string, pageUrl: string): ImportedProduct {
  let product: Record<string, unknown> | null = null;
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      product = findProduct(JSON.parse(m[1].trim()));
    } catch {
      /* malformed JSON-LD is common — keep looking */
    }
    if (product) break;
  }
  const offers = product?.offers;
  const offer = (Array.isArray(offers) ? offers[0] : offers) as Record<string, unknown> | undefined;
  const brand = product?.brand;
  const abs = (u: string | null) => {
    if (!u) return null;
    try {
      return new URL(decodeEntities(u), pageUrl).toString();
    } catch {
      return null;
    }
  };
  return {
    name: clean(product?.name, 120) ?? clean(meta(html, "og:title"), 120) ?? clean(html.match(/<title>([^<]*)<\/title>/i)?.[1], 120),
    description: clean(product?.description) ?? clean(meta(html, "og:description")) ?? clean(meta(html, "description")),
    imageUrl: abs(firstImage(product?.image) ?? meta(html, "og:image")),
    price:
      toPrice(offer?.price) ??
      toPrice(offer?.lowPrice) ??
      toPrice((offer?.priceSpecification as { price?: unknown } | undefined)?.price) ??
      toPrice(meta(html, "product:price:amount")) ??
      toPrice(meta(html, "og:price:amount")),
    sku: clean(product?.sku, 80) ?? clean(product?.gtin13, 80) ?? clean(product?.mpn, 80),
    brand: clean(typeof brand === "object" && brand ? (brand as { name?: unknown }).name : brand, 80),
    supplierName: clean(meta(html, "og:site_name"), 80),
    sourceUrl: pageUrl,
  };
}

/** Fetch a supplier product page and extract its details. */
export async function importProductFromUrl(url: string): Promise<ImportedProduct> {
  const { body, contentType, finalUrl } = await safeFetch(url, MAX_HTML_BYTES, "text/html,application/xhtml+xml");
  if (contentType && !/html|xml/i.test(contentType)) throw new ImportError("That link isn't a web page");
  const parsed = parseProductHtml(body.toString("utf8"), finalUrl);
  if (!parsed.name && !parsed.imageUrl) {
    throw new ImportError("Couldn't find a product on that page — some supplier sites need you to log in. Enter it by hand instead.");
  }
  return parsed;
}

/** Download an image from a public URL (for saving a supplier photo to our own storage). */
export async function fetchImage(url: string): Promise<Buffer> {
  const { body, contentType } = await safeFetch(url, MAX_IMAGE_BYTES, "image/*");
  if (contentType && !/^image\//i.test(contentType)) throw new ImportError("That link isn't an image");
  return body;
}
