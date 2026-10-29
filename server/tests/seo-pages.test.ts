import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createApp } from "../src/app";
import { buildSeoPage, injectSeo, esc, cleanDesc, parseRange, seoHtmlHandler, type SeoPage } from "../src/lib/seo-pages";

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const TEMPLATE = `<!doctype html><html><head>
<title>Old title</title>
<meta name="description" content="old" />
<link rel="canonical" href="https://www.kellysdeli.co.uk/" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta property="og:title" content="old" />
<meta property="og:description" content="old" />
<meta property="og:url" content="https://www.kellysdeli.co.uk/" />
    <!-- Structured data: local business. -->
    <script type="application/ld+json">{"@type":"Static"}</script>
    <!-- FAQ structured data: static. -->
    <script type="application/ld+json">{"@type":"FAQPage","static":true}</script>
</head><body><div id="root"></div></body></html>`;

const page = (over: Partial<SeoPage> = {}): SeoPage => ({
  status: 200,
  title: "Bread — Kelly's Deli",
  description: "Fresh bread",
  path: "/bread",
  body: "<h1>Bread</h1>",
  jsonLd: [{ "@type": "Thing", name: "</script><script>alert(1)</script>" }],
  ...over,
});

describe("injectSeo", () => {
  it("swaps title, description, canonical and og tags for the route", () => {
    const html = injectSeo(TEMPLATE, page());
    expect(html).toContain("<title>Bread — Kelly&#39;s Deli</title>");
    expect(html).toContain('<meta name="description" content="Fresh bread" />');
    expect(html).toContain('<link rel="canonical" href="https://www.kellysdeli.co.uk/bread" />');
    expect(html).toContain('<meta property="og:url" content="https://www.kellysdeli.co.uk/bread" />');
    expect(html).not.toContain("Old title");
  });

  it("puts the page body inside #root so crawlers without JS read it", () => {
    expect(injectSeo(TEMPLATE, page())).toContain('<div id="root"><h1>Bread</h1></div>');
  });

  it("replaces the template's static JSON-LD so nothing appears twice", () => {
    const html = injectSeo(TEMPLATE, page());
    expect(html).not.toContain('"Static"');
    expect(html).not.toContain('"static":true');
    expect(html.match(/application\/ld\+json/g)).toHaveLength(1);
  });

  it("can't be broken out of a JSON-LD script by product text", () => {
    const html = injectSeo(TEMPLATE, page());
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
  });

  it("treats $ patterns in admin text literally", () => {
    const body = "<p>Board for £20 $' and $` and $& and $1</p>";
    const html = injectSeo(TEMPLATE, page({ title: "Deal $' $&", body, jsonLd: [{ name: "$'" }] }));
    expect(html).toContain(`<div id="root">${body}</div>`);
    expect(html.match(/id="root"/g)).toHaveLength(1);
    expect(html).toContain("<title>Deal $&#39; $&amp;</title>");
  });

  it("uses the canonical override for other sizes of a board", () => {
    const html = injectSeo(TEMPLATE, page({ path: "/platter/b", canonical: "/platter/a" }));
    expect(html).toContain('<link rel="canonical" href="https://www.kellysdeli.co.uk/platter/a" />');
  });

  it("marks private and missing pages noindex", () => {
    expect(injectSeo(TEMPLATE, page({ noindex: true }))).toContain('<meta name="robots" content="noindex, follow" />');
  });

  it("escapes HTML in text", () => {
    expect(esc(`<b>"Kelly's" & co</b>`)).toBe("&lt;b&gt;&quot;Kelly&#39;s&quot; &amp; co&lt;/b&gt;");
  });
});

describe("cleanDesc / parseRange", () => {
  it("strips the seed's owner-review marker", () => {
    expect(cleanDesc("Lovely board. [CHECK PRICE & DETAILS]")).toBe("Lovely board.");
    expect(cleanDesc(null)).toBe("");
  });

  it("reads the hours formats an owner actually types", () => {
    expect(parseRange("08:00-16:00")).toEqual(["08:00", "16:00"]);
    expect(parseRange("8am – 4pm")).toEqual(["08:00", "16:00"]);
    expect(parseRange("9:30 to 4.30pm")).toEqual(["09:30", "16:30"]);
    expect(parseRange("Closed")).toBeNull();
    expect(parseRange("by appointment")).toBeNull();
  });
});

describe("seoHtmlHandler", () => {
  const SHELL = '<html><head><title>Shell</title></head><body><div id="root"></div></body></html>';
  const appWith = (build: (p: string) => Promise<SeoPage>, timeoutMs = 800) => {
    const a = express();
    a.get("*", seoHtmlHandler(SHELL, build, timeoutMs));
    a.use((_req, res) => res.status(418).send("next"));
    return a;
  };

  it("sends the rendered page with its status", async () => {
    const res = await request(appWith(async () => page({ status: 404, title: "Nope" }))).get("/missing");
    expect(res.status).toBe(404);
    expect(res.text).toContain("<title>Nope</title>");
  });

  it("serves the plain shell when rendering throws (a DB error never takes the shop down)", async () => {
    const res = await request(appWith(async () => { throw new Error("db down"); })).get("/platters");
    expect(res.status).toBe(200);
    expect(res.text).toBe(SHELL);
  });

  it("serves the plain shell when rendering is too slow", async () => {
    const slow = () => new Promise<SeoPage>((r) => setTimeout(() => r(page()), 500));
    const res = await request(appWith(slow, 50)).get("/bread");
    expect(res.status).toBe(200);
    expect(res.text).toBe(SHELL);
  });

  it("301s capitalised URLs to lowercase, keeping the query", async () => {
    const res = await request(appWith(async () => page())).get("/Bentley-Heath?src=gbp");
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("/bentley-heath?src=gbp");
  });

  it("never redirects off-site (no open redirect via // or \\)", async () => {
    for (const evil of ["//Evil.com/A", "/\\Evil.com", "///Evil.com"]) {
      const res = await request(appWith(async () => page())).get(evil);
      if (res.status === 301) {
        expect(res.headers.location).toMatch(/^\/[^/\\]/);
        expect(res.headers.location).not.toMatch(/^\/\//);
      }
    }
  });

  it("leaves order references' case alone", async () => {
    const res = await request(appWith(async () => page())).get("/confirm/KD-ABC123");
    expect(res.status).toBe(200);
  });

  it("passes API paths through", async () => {
    expect((await request(appWith(async () => page())).get("/api/whatever")).status).toBe(418);
  });
});

describe("buildSeoPage without a DB", () => {
  it("answers file probes with a 404 before touching the DB", async () => {
    for (const p of ["/wp-login.php", "/favicon.ico", "/.env"]) {
      const res = await buildSeoPage(p);
      expect(res.status).toBe(404);
    }
  });
});

d("buildSeoPage (DB)", () => {
  const ldTypes = (p: SeoPage) => JSON.stringify(p.jsonLd);

  it("renders the homepage with links into the site and one FAQ", async () => {
    const p = await buildSeoPage("/");
    expect(p.status).toBe(200);
    expect(p.body).toContain('href="/platters"');
    expect(p.body).toContain('href="/party-food-solihull"');
    expect(ldTypes(p).match(/"FAQPage"/g)).toHaveLength(1);
  });

  it("emits each shop's LocalBusiness node exactly once, at the shop's own URL", async () => {
    const p = await buildSeoPage("/bentley-heath");
    expect(p.status).toBe(200);
    expect(p.body).toContain("Slater Road");
    const json = ldTypes(p);
    // One full node (with a name); the Organization's `department` only references it.
    expect(json.match(/"@id":"https:\/\/www\.kellysdeli\.co\.uk\/#bentley-heath","name"/g)).toHaveLength(1);
    expect(json).toContain('"url":"https://www.kellysdeli.co.uk/bentley-heath"');
  });

  it("gives the party guide its own FAQ and not the site FAQ", async () => {
    const p = await buildSeoPage("/party-food-solihull");
    expect(p.status).toBe(200);
    expect(ldTypes(p).match(/"FAQPage"/g)).toHaveLength(1);
    expect(ldTypes(p)).toContain("How much party food do I need?");
  });

  it("never shows the owner-review marker", async () => {
    for (const path of ["/", "/platters", "/party-food-solihull"]) {
      const p = await buildSeoPage(path);
      expect(p.body + JSON.stringify(p.jsonLd)).not.toMatch(/CHECK PRICE/i);
    }
  });

  it("returns a real 404 for unknown paths and unknown boards", async () => {
    expect((await buildSeoPage("/no-such-page")).status).toBe(404);
    expect((await buildSeoPage("/platter/does-not-exist")).status).toBe(404);
    expect((await buildSeoPage("/shop/does-not-exist")).status).toBe(404);
  });

  it("keeps checkout and admin out of the index", async () => {
    for (const path of ["/order", "/confirm/KD-ABC123", "/admin", "/admin/orders"]) {
      const p = await buildSeoPage(path);
      expect(p.noindex).toBe(true);
      expect(p.body).toBe("");
    }
  });

  it("lists the new pages in the sitemap", async () => {
    const res = await request(createApp()).get("/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.text).toContain("/party-food-solihull");
    expect(res.text).toContain("/bentley-heath");
    expect(res.text).toContain("/stratford-upon-avon");
  });
});
