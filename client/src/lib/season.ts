// The seasonal storefront skin (Site Settings → "season"). One shared fetch of the public
// site content, cached for the page's lifetime, so every component that needs the season
// or the banner text reads the same answer without its own request.
import { useEffect, useLayoutEffect, useState } from "react";
import { api, type CategoryCounts } from "./api";

export type Season = "christmas" | "classic";

let content: Promise<CategoryCounts | null> | null = null;
export function loadSiteContent(): Promise<CategoryCounts | null> {
  content ??= api.categories().catch(() => {
    content = null; // a failed fetch isn't cached — the next caller retries
    return null;
  });
  return content;
}

export const DEFAULT_SEASON_BANNER =
  "Christmas pre-orders are open — hams, turkey, party food & hampers. Collect any day in December.";

const STORE_KEY = "kd-season";
type SeasonState = { season: Season; banner: string };

// Remember the last answer (in memory, and across visits) so pages render in the right
// skin straight away — no Christmas banner flashing up after the owner switches to Classic.
let resolved: SeasonState | null = null;
function initialSeason(): SeasonState {
  if (resolved) return resolved;
  try {
    const s = localStorage.getItem(STORE_KEY);
    if (s === "classic" || s === "christmas") return { season: s, banner: DEFAULT_SEASON_BANNER };
  } catch {
    /* storage blocked — fall through */
  }
  return { season: "christmas", banner: DEFAULT_SEASON_BANNER };
}

/** Current season + banner, from the last known value until the live one arrives. */
export function useSeason(): SeasonState {
  const [state, setState] = useState<SeasonState>(initialSeason);
  useEffect(() => {
    let live = true;
    loadSiteContent().then((c) => {
      if (!c) return;
      const next: SeasonState = { season: c.season ?? "christmas", banner: c.seasonBanner?.trim() || DEFAULT_SEASON_BANNER };
      resolved = next;
      try {
        localStorage.setItem(STORE_KEY, next.season);
      } catch {
        /* ignore */
      }
      if (live) setState((prev) => (prev.season === next.season && prev.banner === next.banner ? prev : next));
    });
    return () => { live = false; };
  }, []);
  // Before paint, so the colours are right on the first frame.
  useLayoutEffect(() => {
    document.documentElement.dataset.season = state.season;
  }, [state.season]);
  return state;
}
