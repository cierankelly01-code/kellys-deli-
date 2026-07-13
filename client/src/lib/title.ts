import { useEffect } from "react";

const DEFAULT = "Kelly's Deli Bentley Heath — Grazing Boards & Platters, Solihull";
const DEFAULT_DESC =
  "Family-run deli in Bentley Heath, Solihull. Order charcuterie, cheese and grazing boards for delivery or collection, plus catering platters for home and work.";
const SITE = "https://www.kellysdeli.com";

function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Sets the browser-tab / search-result title for a page, and (optionally) the
 * meta description. Also keeps the canonical URL in step with the current route.
 * Restores the site defaults on unmount.
 */
export function usePageTitle(title?: string, description?: string): void {
  useEffect(() => {
    document.title = title ? `${title} — Kelly's Deli Bentley Heath` : DEFAULT;
    setMeta("description", description || DEFAULT_DESC);
    // pathname only (no query/hash) so /order?x=1 doesn't fragment the canonical.
    setCanonical(SITE + window.location.pathname);
    return () => {
      document.title = DEFAULT;
      setMeta("description", DEFAULT_DESC);
      setCanonical(SITE + "/");
    };
  }, [title, description]);
}
