// The SPA fallback rewrites index.html's <head> per page so link previews and Google's
// first pass see the right board/category. A regex slip here either leaks the homepage
// meta onto every page or, worse, lets DB text break out of an attribute — so both the
// happy path and the escaping are pinned down.
import { describe, it, expect } from "vitest";
import { injectMeta, platterMeta, clip, absoluteUrl } from "../src/lib/seo";

// Same tag shapes (attribute order, self-closing, &amp;) as client/index.html.
const HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>Kelly's Deli Bentley Heath — Grazing Boards &amp; Platters, Solihull</title>
    <meta name="description" content="Family-run deli in Bentley Heath." />
    <link rel="canonical" href="https://www.kellysdeli.co.uk/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Kelly's Deli" />
    <meta property="og:title" content="Kelly's Deli — Grazing Boards &amp; Platters, Bentley Heath" />
    <meta property="og:description" content="Family-run deli in Bentley Heath, Solihull." />
    <meta property="og:url" content="https://www.kellysdeli.co.uk/" />
    <meta property="og:image" content="https://images.unsplash.com/photo-1?auto=format&fit=crop" />
    <meta property="og:image:alt" content="A Kelly's Deli grazing board" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Kelly's Deli — Grazing Boards &amp; Platters, Bentley Heath" />
    <meta name="twitter:description" content="Family-run deli in Bentley Heath, Solihull." />
    <meta name="twitter:image" content="https://images.unsplash.com/photo-1?auto=format&fit=crop" />
  </head>
  <body>
    <svg><title>Logo</title></svg>
    <div id="root"></div>
  </body>
</html>`;

const META = {
  title: "Christmas Ham | Kelly's Deli",
  description: "A glazed ham for Christmas.",
  canonical: "https://www.kellysdeli.co.uk/christmas",
};

/** content="" of the meta whose name/property is `key`. */
const metaContent = (html: string, key: string): string | undefined =>
  new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`).exec(html)?.[1];

describe("injectMeta", () => {
  it("replaces the title, description, canonical, og and twitter tags", () => {
    const out = injectMeta(HTML, META);
    expect(out).toContain("<title>Christmas Ham | Kelly&#39;s Deli</title>");
    expect(metaContent(out, "description")).toBe("A glazed ham for Christmas.");
    expect(out).toContain('<link rel="canonical" href="https://www.kellysdeli.co.uk/christmas" />');
    expect(metaContent(out, "og:title")).toBe("Christmas Ham | Kelly&#39;s Deli");
    expect(metaContent(out, "og:description")).toBe("A glazed ham for Christmas.");
    expect(metaContent(out, "og:url")).toBe("https://www.kellysdeli.co.uk/christmas");
    expect(metaContent(out, "twitter:title")).toBe("Christmas Ham | Kelly&#39;s Deli");
    expect(metaContent(out, "twitter:description")).toBe("A glazed ham for Christmas.");
  });

  it("keeps the default image, type and unrelated tags unless asked", () => {
    const out = injectMeta(HTML, META);
    expect(metaContent(out, "og:type")).toBe("website");
    expect(metaContent(out, "og:image")).toBe("https://images.unsplash.com/photo-1?auto=format&fit=crop");
    expect(metaContent(out, "og:site_name")).toBe("Kelly's Deli");
    expect(metaContent(out, "twitter:card")).toBe("summary_large_image");
    expect(out).toContain("<svg><title>Logo</title></svg>"); // body untouched
  });

  it("sets og:type, og:image (+alt) and twitter:image when given", () => {
    const out = injectMeta(HTML, { ...META, type: "product", image: "https://cdn.example/ham.webp?w=1&h=2", imageAlt: "Ham" });
    expect(metaContent(out, "og:type")).toBe("product");
    expect(metaContent(out, "og:image")).toBe("https://cdn.example/ham.webp?w=1&amp;h=2");
    expect(metaContent(out, "og:image:alt")).toBe("Ham");
    expect(metaContent(out, "twitter:image")).toBe("https://cdn.example/ham.webp?w=1&amp;h=2");
  });

  it("escapes markup and quotes so DB text can't break out of a tag", () => {
    const out = injectMeta(HTML, { ...META, title: `</title><script>alert(1)</script>`, description: `Say "hi" & 'bye' $1 $&` });
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("<title>&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>");
    expect(metaContent(out, "description")).toBe("Say &quot;hi&quot; &amp; &#39;bye&#39; $1 $&amp;");
  });

  it("matches attributes in any order and either quote style", () => {
    const html = `<html><head><meta content='old' name='description'><link href="/" rel="canonical"></head><body></body></html>`;
    const out = injectMeta(html, META);
    expect(out).toContain(`<meta content="A glazed ham for Christmas." name='description'>`);
    expect(out).toContain(`<link href="https://www.kellysdeli.co.uk/christmas" rel="canonical">`);
  });

  it("leaves the html untouched when the tags are missing", () => {
    const bare = `<html><head><meta charset="UTF-8" /></head><body><title>x</title></body></html>`;
    expect(injectMeta(bare, META)).toBe(bare);
    expect(injectMeta("not html at all", META)).toBe("not html at all");
  });

  it("appends JSON-LD in <head> with </script> neutralised", () => {
    const out = injectMeta(HTML, { ...META, jsonLd: { "@type": "Product", description: "Yum </script><script>alert(1)</script>" } });
    const head = out.slice(0, out.indexOf("</head>"));
    const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(head);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain("</");
    expect(m![1]).toContain("<\\/script>");
    // Still the same data to a JSON parser.
    expect(JSON.parse(m![1]).description).toBe("Yum </script><script>alert(1)</script>");
  });
});

describe("platterMeta", () => {
  const ham = {
    id: "ham1",
    name: "Glazed Ham",
    description: "Honey-glazed gammon, carved to order. [CHECK PRICE with supplier]",
    fixedPrice: 45,
    imageUrl: "/uploads/ham.webp",
    kind: "product",
  };

  it("builds product meta with a cleaned description and an absolute image", () => {
    const m = platterMeta(ham, "https://www.kellysdeli.co.uk");
    expect(m.title).toBe("Glazed Ham | Kelly's Deli");
    expect(m.description).toBe("Honey-glazed gammon, carved to order.");
    expect(m.canonical).toBe("https://www.kellysdeli.co.uk/platter/ham1");
    expect(m.image).toBe("https://www.kellysdeli.co.uk/uploads/ham.webp");
    expect(m.type).toBe("product");
    const ld = m.jsonLd as { offers: { price: string; priceCurrency: string; availability: string } };
    expect(ld.offers).toMatchObject({ price: "45.00", priceCurrency: "GBP", availability: "https://schema.org/PreOrder" });
  });

  it("marks catering InStock and omits the offer without a fixed price", () => {
    expect((platterMeta({ ...ham, kind: "catering" }, "https://x").jsonLd as { offers: { availability: string } }).offers.availability).toBe(
      "https://schema.org/InStock"
    );
    const perHead = platterMeta({ ...ham, fixedPrice: null, imageUrl: null }, "https://x");
    expect((perHead.jsonLd as Record<string, unknown>).offers).toBeUndefined();
    expect(perHead.image).toBeNull();
  });
});

describe("clip / absoluteUrl", () => {
  it("clips long text on a word boundary", () => {
    const long = "word ".repeat(60);
    const out = clip(long, 155);
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith("word…")).toBe(true);
    expect(clip("short")).toBe("short");
  });

  it("only returns usable absolute URLs", () => {
    expect(absoluteUrl("https://a.b/c.jpg", "https://s")).toBe("https://a.b/c.jpg");
    expect(absoluteUrl("/img/x.webp", "https://s")).toBe("https://s/img/x.webp");
    expect(absoluteUrl("//cdn/x.webp", "https://s")).toBe("https://cdn/x.webp");
    expect(absoluteUrl("x.webp", "https://s")).toBeNull();
    expect(absoluteUrl(null, "https://s")).toBeNull();
  });
});
