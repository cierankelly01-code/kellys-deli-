import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type CategoryCounts } from "../lib/api";

export default function Choice() {
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const src = params.get("src");
  const suffix = src ? `?src=${encodeURIComponent(src)}` : "";

  useEffect(() => {
    api.categories().then(setCounts).catch(() => setCounts({ home: 1, events: 1, seasonal: 0, experiences: 1, tastingsComingSoon: true }));
  }, []);

  const go = (path: string) => navigate(`${path}${suffix}`);
  const tastingsComingSoon = counts ? counts.tastingsComingSoon : true;

  return (
    <div className="app choice">
      <header className="landing-hero">
        <p className="lh-eyebrow">Bentley Heath · Henley-in-Arden · Stratford-upon-Avon</p>
        <h1 className="lh-mark">Kelly&apos;s Deli</h1>
        <span className="lh-rule" />
        <p className="lh-tag">
          Proper food from the people you know — platters for home and work, gifts sent to the
          door, and tastings worth turning up for.
        </p>
      </header>

      <h2 className="choice-h">How can we help?</h2>
      <div className="choice-grid">
        {(!counts || counts.home > 0) && (
          <button className="choice-card" onClick={() => go("/menu/home")}>
            <span className="choice-emoji">🏠</span>
            <span className="choice-title">At Home</span>
            <span className="choice-sub">Dinner, date night, family &amp; friends</span>
            <span className="choice-go">Browse platters →</span>
          </button>
        )}
        {(!counts || counts.events > 0) && (
          <button className="choice-card" onClick={() => go("/menu/events")}>
            <span className="choice-emoji">🏢</span>
            <span className="choice-title">Events &amp; Office</span>
            <span className="choice-sub">Work lunches, parties, larger groups</span>
            <span className="choice-go">Browse platters →</span>
          </button>
        )}
      </div>

      {counts && counts.seasonal > 0 && (
        <button className="choice-strip seasonal" onClick={() => go("/menu/seasonal")}>
          <span>🎄 Seasonal spreads — limited time</span>
          <span className="arrow">→</span>
        </button>
      )}
      {(!counts || counts.experiences > 0) && (
        tastingsComingSoon ? (
          <div className="choice-strip coming-soon" aria-disabled="true">
            <span>🧀 Tastings &amp; Experiences</span>
            <span className="cs-badge">Coming soon</span>
          </div>
        ) : (
          <button className="choice-strip" onClick={() => go("/tastings")}>
            <span>🧀 Tastings &amp; Experiences — book a cheese tasting &amp; more</span>
            <span className="arrow">→</span>
          </button>
        )
      )}

      <p className="center muted footnote">
        Order in under a minute · 25% deposit secures your date · we confirm by text &amp; email
      </p>
    </div>
  );
}
