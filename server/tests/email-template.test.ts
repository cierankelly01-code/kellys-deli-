// The confirmation email is the first thing a customer receives after paying
// attention to us. These lock the things that quietly break it: unescaped names,
// relative image paths that render as broken squares, and a missing text part.
import { describe, it, expect } from "vitest";
import { orderReceivedHtml, orderReceivedText, absoluteUrl, esc, type OrderEmailData } from "../src/lib/emailTemplate";

const data: OrderEmailData = {
  customerName: "Hannah",
  ref: "KD-AB12CD",
  collectionDate: "2026-08-14",
  locationName: "Bentley Heath",
  boards: [
    { name: "Large Platter", qty: 1, lineTotal: 100, imageUrl: "/uploads/board.jpg", meta: "Feeds 12-15" },
    { name: "Cheese Board", qty: 2, lineTotal: 110, imageUrl: "https://cdn.example.com/cheese.jpg" },
  ],
  addOns: [{ name: "Cutlery & napkins", qty: 15, lineTotal: 7.5 }],
  total: 217.5,
  deposit: 54.4,
  balance: 163.1,
};

describe("absoluteUrl", () => {
  it("makes an upload path absolute so email clients can load it", () => {
    expect(absoluteUrl("/uploads/x.jpg")).toBe("https://www.kellysdeli.co.uk/uploads/x.jpg");
  });
  it("leaves an already-absolute URL alone", () => {
    expect(absoluteUrl("https://cdn.example.com/x.jpg")).toBe("https://cdn.example.com/x.jpg");
  });
  it("returns null for a missing image", () => {
    expect(absoluteUrl(null)).toBeNull();
  });
});

describe("esc", () => {
  it("neutralises markup in customer-supplied text", () => {
    expect(esc('<script>"x"&y</script>')).toBe("&lt;script&gt;&quot;x&quot;&amp;y&lt;/script&gt;");
  });
});

describe("orderReceivedHtml", () => {
  const html = orderReceivedHtml(data);

  it("shows the reference, the totals and the collection details", () => {
    expect(html).toContain("KD-AB12CD");
    expect(html).toContain("£217.50");
    expect(html).toContain("£54.40");
    expect(html).toContain("£163.10");
    expect(html).toContain("Bentley Heath");
    expect(html).toContain("2026-08-14");
  });

  it("lists every line, boards and add-ons alike", () => {
    expect(html).toContain("Large Platter");
    expect(html).toContain("Cheese Board");
    expect(html).toContain("Cutlery &amp; napkins");
  });

  it("renders board photos with absolute URLs", () => {
    expect(html).toContain("https://www.kellysdeli.co.uk/uploads/board.jpg");
    expect(html).toContain("https://cdn.example.com/cheese.jpg");
    expect(html).not.toMatch(/src="\/uploads/);
  });

  it("escapes a customer name containing markup", () => {
    const evil = orderReceivedHtml({ ...data, customerName: '<img src=x onerror=alert(1)>' });
    expect(evil).not.toContain("<img src=x");
    expect(evil).toContain("&lt;img src=x");
  });

  it("survives an order with no photos at all", () => {
    const noPics = orderReceivedHtml({
      ...data,
      boards: [{ name: "Small Platter", qty: 1, lineTotal: 45, imageUrl: null }],
    });
    expect(noPics).toContain("Small Platter");
    expect(noPics).not.toContain("<img src=\"\"");
  });

  it("uses table layout and inline styles, not modern CSS that mail clients drop", () => {
    expect(html).toContain("<table");
    expect(html).not.toMatch(/display:\s*flex/);
    expect(html).not.toMatch(/display:\s*grid/);
    expect(html).not.toContain("var(--");
  });

  it("carries a preheader for the inbox preview line", () => {
    expect(html).toContain("KD-AB12CD");
    expect(html).toMatch(/max-height:0/);
  });
});

describe("orderReceivedText", () => {
  const text = orderReceivedText(data);
  it("stands on its own for plain-text clients", () => {
    expect(text).toContain("KD-AB12CD");
    expect(text).toContain("Large Platter");
    expect(text).toContain("£217.50");
    expect(text).toContain("Bentley Heath");
    expect(text).not.toContain("<");
  });
});
