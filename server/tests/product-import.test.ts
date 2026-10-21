import { describe, expect, it } from "vitest";
import { isPrivateAddress, parseProductHtml } from "../src/lib/product-import";

describe("supplier page parsing", () => {
  it("reads schema.org Product JSON-LD (inside @graph)", () => {
    const html = `<html><head>
      <meta property="og:site_name" content="Brakes">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"Wiltshire Ham &amp; Glaze","description":"<p>Cured ham</p>","image":["/img/ham.jpg"],"sku":"W123","offers":{"@type":"Offer","price":"21.50","priceCurrency":"GBP"}}]}</script>
    </head></html>`;
    const p = parseProductHtml(html, "https://supplier.example/products/ham");
    expect(p.name).toBe("Wiltshire Ham & Glaze");
    expect(p.description).toBe("Cured ham");
    expect(p.imageUrl).toBe("https://supplier.example/img/ham.jpg");
    expect(p.price).toBe(21.5);
    expect(p.sku).toBe("W123");
    expect(p.supplierName).toBe("Brakes");
  });
  it("falls back to Open Graph tags", () => {
    const html = `<meta property="og:title" content="Pork Pie 1lb"><meta property="og:image" content="https://cdn.example/pie.png"><meta property="product:price:amount" content="6.99">`;
    const p = parseProductHtml(html, "https://supplier.example/pie");
    expect(p.name).toBe("Pork Pie 1lb");
    expect(p.imageUrl).toBe("https://cdn.example/pie.png");
    expect(p.price).toBe(6.99);
  });
  it("survives malformed JSON-LD", () => {
    const p = parseProductHtml(`<script type="application/ld+json">{oops</script><title>Stilton</title>`, "https://x.example/");
    expect(p.name).toBe("Stilton");
  });
});

describe("SSRF guard", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "192.168.0.10", "172.20.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1",
    "::ffff:127.0.0.1",
    // IPv4 hidden in IPv6 the way the URL parser rewrites it ([::ffff:127.0.0.1] -> ::ffff:7f00:1)
    "::ffff:7f00:1", "::7f00:1", "64:ff9b::7f00:1", "::ffff:a9fe:a9fe", "fec0::1", "febf::1", "fe80::1",
  ])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "151.101.1.1", "2606:4700::1111", "::ffff:808:808"])("allows public %s", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});
