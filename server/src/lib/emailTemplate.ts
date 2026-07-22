// Branded HTML for customer email.
//
// Email HTML is not web HTML. Outlook renders with Word's engine, Gmail strips
// <style> blocks in some clients, and flexbox/grid are unusable. So: tables for
// layout, styles inlined on every element, absolute image URLs, explicit widths,
// and a plain-text alternative that stands on its own. Colours are the site tokens
// (client/src/styles/theme.css) written out literally — no CSS variables, which
// most mail clients don't support.

const SITE = process.env.PUBLIC_SITE_URL || "https://www.kellysdeli.co.uk";

const C = {
  cream: "#f8f4ea",
  card: "#fffdf8",
  ink: "#241f1a",
  inkSoft: "#6b6255",
  line: "#e6ded0",
  green: "#1f2e23",
  gold: "#8a6220",
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Escape anything customer- or admin-supplied before it goes near the markup. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Board photos are stored as "/uploads/..." — email clients need a full URL. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE}${url.startsWith("/") ? "" : "/"}${url}`;
}

const money = (n: number) => `£${n.toFixed(2)}`;

export interface OrderEmailLine {
  name: string;
  qty: number;
  lineTotal: number;
  imageUrl?: string | null;
  meta?: string | null;
}

export interface OrderEmailData {
  customerName: string;
  ref: string;
  collectionDate: string;
  locationName: string;
  boards: OrderEmailLine[];
  addOns: OrderEmailLine[];
  total: number;
  deposit: number;
  balance: number;
}

/** Outer shell: background, 600px card, wordmark, footer. */
function layout(inner: string, preheader: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>Kelly's Deli</title>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
<!-- Preheader: the grey line of text shown next to the subject in the inbox. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">

      <tr><td align="center" style="padding:0 0 20px;">
        <a href="${SITE}" style="text-decoration:none;">
          <span style="font-family:${SERIF};font-size:26px;color:${C.ink};letter-spacing:-0.5px;">Kelly&#39;s Deli</span>
          <span style="font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${C.gold};font-weight:bold;">&nbsp;Family Deli</span>
        </a>
      </td></tr>

      <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
        ${inner}
      </td></tr>

      <tr><td style="padding:22px 8px 6px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.inkSoft};" align="center">
        Kelly&#39;s Deli — 1 Slater Road, Bentley Heath, Solihull B93 8AQ<br>
        <a href="${SITE}" style="color:${C.gold};text-decoration:none;">kellysdeli.co.uk</a>
        &nbsp;·&nbsp;
        <a href="mailto:hello@kellysdeli.co.uk" style="color:${C.gold};text-decoration:none;">hello@kellysdeli.co.uk</a>
      </td></tr>
      <tr><td style="padding:0 8px 8px;font-family:${SANS};font-size:11px;color:${C.inkSoft};" align="center">
        Boards built by hand, same as always.
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

/** One product row: photo, name, quantity, line total. */
function lineRow(l: OrderEmailLine): string {
  const img = absoluteUrl(l.imageUrl);
  // No photo (add-ons never have one) falls back to a monogram tile rather than an
  // empty square — same treatment as the site, so it reads as designed not broken.
  const photo = img
    ? `<img src="${esc(img)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid ${C.line};">`
    : `<table role="presentation" width="64" height="64" cellpadding="0" cellspacing="0" border="0" style="width:64px;height:64px;border-radius:8px;border:1px solid ${C.line};background:${C.cream};">
         <tr><td align="center" valign="middle" style="font-family:${SERIF};font-size:24px;color:${C.gold};">${esc(l.name.slice(0, 1).toUpperCase())}</td></tr>
       </table>`;
  return `
  <tr>
    <td width="64" style="padding:10px 12px 10px 0;vertical-align:top;">${photo}</td>
    <td style="padding:10px 0;vertical-align:top;font-family:${SANS};font-size:15px;color:${C.ink};">
      <strong style="font-weight:600;">${esc(l.name)}</strong>
      ${l.meta ? `<br><span style="font-size:13px;color:${C.inkSoft};">${esc(l.meta)}</span>` : ""}
      ${l.qty > 1 ? `<br><span style="font-size:13px;color:${C.inkSoft};">Quantity: ${l.qty}</span>` : ""}
    </td>
    <td align="right" style="padding:10px 0;vertical-align:top;font-family:${SANS};font-size:15px;color:${C.ink};white-space:nowrap;">
      ${money(l.lineTotal)}
    </td>
  </tr>`;
}

function totalsRow(label: string, value: string, opts: { strong?: boolean; note?: string } = {}): string {
  const weight = opts.strong ? "600" : "400";
  const size = opts.strong ? "17px" : "15px";
  return `
  <tr>
    <td style="padding:6px 0;font-family:${SANS};font-size:${size};font-weight:${weight};color:${C.ink};">
      ${esc(label)}${opts.note ? `<br><span style="font-size:12px;font-weight:400;color:${C.inkSoft};">${esc(opts.note)}</span>` : ""}
    </td>
    <td align="right" style="padding:6px 0;font-family:${SANS};font-size:${size};font-weight:${weight};color:${C.ink};white-space:nowrap;">${esc(value)}</td>
  </tr>`;
}

/** The order-received confirmation. */
export function orderReceivedHtml(d: OrderEmailData): string {
  // Lead with the biggest board photo — the product is the reason they ordered.
  const hero = absoluteUrl(d.boards.find((b) => b.imageUrl)?.imageUrl ?? null);
  const lines = [...d.boards, ...d.addOns].map(lineRow).join("");

  const inner = `
  ${hero ? `<img src="${esc(hero)}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;">` : ""}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:28px 28px 0;">
      <h1 style="margin:0 0 6px;font-family:${SERIF};font-size:26px;line-height:1.2;font-weight:normal;color:${C.ink};">
        Thanks ${esc(d.customerName)} — that&#39;s with us.
      </h1>
      <p style="margin:0 0 18px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.inkSoft};">
        We&#39;ve got your order request and we&#39;re on it. Here&#39;s everything, so you can check it over.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
        <tr><td style="border:2px dashed ${C.gold};border-radius:10px;padding:12px 22px;font-family:${SANS};text-align:center;">
          <span style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${C.inkSoft};">Your reference</span><br>
          <strong style="font-family:${SERIF};font-size:24px;letter-spacing:1px;color:${C.green};">${esc(d.ref)}</strong>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:0 28px;">
      <div style="border-top:1px solid ${C.line};padding-top:8px;"></div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lines}</table>
    </td></tr>

    <tr><td style="padding:14px 28px 0;">
      <div style="border-top:1px solid ${C.line};padding-top:10px;"></div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${totalsRow("Order total", money(d.total), { strong: true })}
        ${totalsRow("Deposit to confirm", money(d.deposit), { note: "25% — we'll send a secure payment link" })}
        ${totalsRow("Balance on collection", money(d.balance))}
      </table>
    </td></tr>

    <tr><td style="padding:22px 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};border-radius:10px;">
        <tr><td style="padding:16px 18px;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.ink};">
          <strong style="font-weight:600;">Collection</strong><br>
          ${esc(d.collectionDate)} — ${esc(d.locationName)}
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:22px 28px 4px;">
      <p style="margin:0 0 8px;font-family:${SANS};font-size:15px;font-weight:600;color:${C.ink};">What happens next</p>
      <p style="margin:0 0 6px;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.inkSoft};">
        We&#39;ll be in touch shortly with a secure link for the ${money(d.deposit)} deposit. Once that&#39;s paid your date is confirmed and locked in.
      </p>
      <p style="margin:0 0 22px;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.inkSoft};">
        Anything to change — more people, fewer, a dietary need — just reply to this email or ring us. We&#39;d rather sort it now than on the day.
      </p>
    </td></tr>

    <tr><td align="center" style="padding:0 28px 30px;">
      <a href="${SITE}/confirm/${encodeURIComponent(d.ref)}"
         style="display:inline-block;background:${C.green};color:#ffffff;font-family:${SANS};font-size:15px;font-weight:600;text-decoration:none;padding:14px 30px;border-radius:10px;">
        View your order
      </a>
    </td></tr>
  </table>`;

  return layout(inner, `Order ${d.ref} — ${money(d.total)}, collection ${d.collectionDate}`);
}

/** Plain-text alternative. Must be readable on its own — some people only see this. */
export function orderReceivedText(d: OrderEmailData): string {
  const lines = [...d.boards, ...d.addOns]
    .map((l) => `  - ${l.name}${l.qty > 1 ? ` x${l.qty}` : ""}  ${money(l.lineTotal)}`)
    .join("\n");
  return [
    `Thanks ${d.customerName} — that's with us.`,
    ``,
    `Your reference: ${d.ref}`,
    ``,
    `Your order:`,
    lines,
    ``,
    `Order total: ${money(d.total)}`,
    `Deposit to confirm (25%): ${money(d.deposit)}`,
    `Balance on collection: ${money(d.balance)}`,
    ``,
    `Collection: ${d.collectionDate} — ${d.locationName}`,
    ``,
    `What happens next: we'll be in touch shortly with a secure link for the`,
    `${money(d.deposit)} deposit. Once that's paid your date is confirmed.`,
    ``,
    `Anything to change — more people, fewer, a dietary need — just reply to`,
    `this email or ring us.`,
    ``,
    `View your order: ${SITE}/confirm/${encodeURIComponent(d.ref)}`,
    ``,
    `Kelly's Deli — 1 Slater Road, Bentley Heath, Solihull B93 8AQ`,
    `kellysdeli.co.uk · hello@kellysdeli.co.uk`,
  ].join("\n");
}
