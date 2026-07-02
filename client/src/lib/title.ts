import { useEffect } from "react";

const DEFAULT = "Kelly's Deli Bentley Heath — Grazing Boards & Platters, Solihull";

/** Sets the browser-tab / search-result title for a page; restores the default on unmount. */
export function usePageTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} — Kelly's Deli Bentley Heath` : DEFAULT;
    return () => {
      document.title = DEFAULT;
    };
  }, [title]);
}
