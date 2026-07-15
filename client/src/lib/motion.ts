import { flushSync } from "react-dom";
import type { NavigateFunction } from "react-router-dom";

/* Sitewide reveal system: elements marked data-reveal rise in when scrolled into
 * view. A MutationObserver picks up nodes React renders after data loads, so
 * pages never need to re-register. Hidden state is gated on html.js (set below),
 * so content is always visible without JavaScript. */

let started = false;

export function startMotion() {
  if (started || typeof window === "undefined") return;
  started = true;
  document.documentElement.classList.add("js");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) {
    // CSS reduced-motion rules keep everything visible; nothing to animate.
    document.documentElement.classList.remove("js");
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          (e.target as HTMLElement).classList.add("is-in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
  );

  const observe = (el: Element) => {
    const node = el as HTMLElement;
    node.style.setProperty("--d", node.dataset.revealDelay || "0");
    io.observe(node);
  };

  document.querySelectorAll("[data-reveal]").forEach(observe);

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.hasAttribute("data-reveal")) observe(n);
        n.querySelectorAll?.("[data-reveal]").forEach(observe);
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

/* Card → detail morph via the View Transitions API. The clicked element is
 * tagged with the shared view-transition-name just before navigating; the
 * destination page carries the same name on its hero (.vt-hero). Browsers
 * without the API just navigate instantly. */
export function morphNavigate(navigate: NavigateFunction, path: string, fromEl?: HTMLElement | null) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
  if (!doc.startViewTransition) {
    navigate(path);
    return;
  }
  if (fromEl) fromEl.style.viewTransitionName = "platter-hero";
  doc.startViewTransition(() => {
    flushSync(() => navigate(path));
    if (fromEl) fromEl.style.viewTransitionName = "";
  });
}
