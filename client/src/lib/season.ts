// The seasonal storefront skin (Site Settings → "season"). One shared fetch of the public
// site content, cached for the page's lifetime, so every component that needs the season
// or the banner text reads the same answer without its own request.
import { useEffect, useState } from "react";
import { api, type CategoryCounts } from "./api";

export type Season = "christmas" | "classic";

let content: Promise<CategoryCounts | null> | null = null;
export function loadSiteContent(): Promise<CategoryCounts | null> {
  content ??= api.categories().catch(() => null);
  return content;
}

export const DEFAULT_SEASON_BANNER =
  "Christmas pre-orders are open — hams, turkey, party food & hampers. Collect any day in December.";

/** Current season + banner. Defaults to Christmas while loading, so there's no flash. */
export function useSeason(): { season: Season; banner: string } {
  const [state, setState] = useState<{ season: Season; banner: string }>({ season: "christmas", banner: DEFAULT_SEASON_BANNER });
  useEffect(() => {
    let live = true;
    loadSiteContent().then((c) => {
      if (!live || !c) return;
      setState({ season: c.season ?? "christmas", banner: c.seasonBanner?.trim() || DEFAULT_SEASON_BANNER });
    });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.season = state.season;
  }, [state.season]);
  return state;
}
