// "Paste a supplier link": fetch a supplier's product page and pull out the name,
// description, photo, price and SKU so the owner doesn't retype them. Reads the
// schema.org Product data most shop platforms publish (JSON-LD), falling back to the
// Open Graph tags every page has for social sharing.
//
// The server fetches a URL the admin typed, so it's guarded against being pointed at
// internal addresses (SSRF): http(s) only, and the address check runs INSIDE the
// connection's DNS lookup — so the address that was checked is the one connected to (no
// DNS-rebinding gap). Redirects are followed by hand so every hop is checked; size and
// time are capped. Uses node:http(s) rather than fetch, which has no lookup hook.
import dns from "node:dns/promises";
import type { LookupAddress, LookupOptions } from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
const UA = "Mozilla/5.0 (compatible; KellysDeliProductImport/1.0; +https://www.kellysdeli.co.uk)";

export class ImportError extends Error {}

/** The IPv4 address hidden inside an IPv4-mapped/compatible/NAT64 IPv6 address, if any. */
function embeddedV4(v6: string): string | null {
  const m = v6.match(/^(?:::(?:ffff:)?|64:ff9b::)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (!m) return null;
  if (m[1]) return m[1];
  const hi = parseInt(m[2], 16);
  const lo = parseInt(m[3], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

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
  const v4 = embeddedV4(v6);
  if (v4) return isPrivateAddress(v4);
  // ::, ::1, and fc00::/7 (unique local), fe80::/10 (link-local), fec0::/10, ff00::/8 (multicast).
  return v6 === "::" || v6 === "::1" || /^f[c-f]/.test(v6);
}

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImportError("That doesn't look like a web link");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ImportError("Only http(s) links can be imported");
  if (url.username || url.password) throw new ImportError("Links with logins in them can't be imported");
  // An IP written straight into the link skips DNS (and so the lookup guard): check it here.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isPrivateAddress(host)) throw new ImportError("That address isn't a public website");
  return url;
}

type LookupCallback = (err: Error | null, address?: string | LookupAddress[], family?: number) => void;

/** dns.lookup that refuses to hand the socket any non-public address. */
function guardedLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
  dns.lookup(hostname, { all: true }).then(
    (addrs) => {
      if (addrs.length === 0) return callback(new ImportError("Couldn't find that website"));
      if (addrs.some((a) => isPrivateAddress(a.address))) return callback(new ImportError("That address isn't a public website"));
      if (options?.all) callback(null, addrs);
      else callback(null, addrs[0].address, addrs[0].family);
    },
    () => callback(new ImportError("Couldn't find that website")),
  );
}

interface RawResponse {
  status: number;
  location?: string;
  contentType: string;
  body: Buffer;
}

function getOnce(url: URL, accept: string, maxBytes: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.get(
      url,
      {
        headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "en-GB,en;q=0.9" },
        lookup: guardedLookup as unknown as net.LookupFunction,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, contentType: "", body: Buffer.alloc(0) });
        }
        if (Number(res.headers["content-length"] ?? 0) > maxBytes) {
          res.destroy();
          return reject(new ImportError("That page is too large to import"));
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            res.destroy();
            reject(new ImportError("That page is too large to import"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, contentType: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks) }));
        res.on("error", () => reject(new ImportError("The connection dropped — try again")));
      },
    );
    req.on("timeout", () => req.destroy(new ImportError("That website took too long to answer")));
    req.on("error", (e) => reject(e instanceof ImportError ? e : new ImportError("Couldn't reach that website — check the link")));
  });
}

/** GET a public URL, re-checking every redirect hop. Returns the final response body. */
async function safeFetch(raw: string, maxBytes: number, accept: string): Promise<{ body: Buffer; contentType: string; finalUrl: string }> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = checkUrl(current);
    const res = await getOnce(url, accept, maxBytes);
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new ImportError("That link redirects nowhere");
      current = new URL(res.location, url).toString();
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new ImportError(`The supplier's site answered ${res.status} — is the product page public?`);
    return { body: res.body, contentType: res.contentType, finalUrl: url.toString() };
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
