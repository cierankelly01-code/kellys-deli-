import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type CategoryCounts, type OpeningHours } from "../lib/api";

const DAY_LABELS: Array<{ key: keyof OpeningHours; label: string }> = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function parseHours(raw: string | null): OpeningHours | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OpeningHours;
  } catch {
    return null;
  }
}

export default function Choice() {
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const src = params.get("src");
  const suffix = src ? `?src=${encodeURIComponent(src)}` : "";

  useEffect(() => {
    api
      .categories()
      .then(setCounts)
      .catch(() =>
        setCounts({
          home: 1, events: 1, seasonal: 0, platters: 1, experiences: 1,
          tastingsComingSoon: true, clickCollectComingSoon: true, openingHours: null, aboutText: null,
        }),
      );
  }, []);

  const go = (path: string) => navigate(`${path}${suffix}`);
  const tastingsComingSoon = counts ? counts.tastingsComingSoon : true;
  const clickCollectComingSoon = counts ? counts.clickCollectComingSoon : true;
  const hours = parseHours(counts?.openingHours ?? null);

  return (
    <div className="app choice">
      <header className="landing-hero">
        <p className="lh-eyebrow">Kelly&apos;s Deli</p>
        <h1 className="lh-mark">Kelly&apos;s Deli</h1>
        <span className="lh-rule" />
        <p className="lh-tag">
          {counts?.aboutText ??
            "Proper food from the people you know — grazing boards for delivery, platters for home and work, and gifts sent to the door."}
        </p>
      </header>

      <button className="platters-cta" onClick={() => go("/platters")}>
        <span className="pc-eyebrow">Grazing boards, delivered</span>
        <span className="pc-title">Order Platters →</span>
        <span className="pc-sub">Charcuterie, savoury, cheese &amp; smoked salmon boards — small, medium or large</span>
      </button>

      {hours && (
        <div className="card hours-card">
          <h2 className="hours-h">Opening hours</h2>
          <div className="hours-grid">
            {DAY_LABELS.map((d) => (
              <div key={d.key} className="hours-row">
                <span className="hours-day">{d.label}</span>
                <span className="hours-time">{hours[d.key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="choice-strip coming-soon" aria-disabled="true">
        <span>🛍️ Click &amp; Collect</span>
        <span className="cs-badge">{clickCollectComingSoon ? "Coming soon" : ""}</span>
      </div>

      <h2 className="choice-h">Catering &amp; events</h2>
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
        Order in under a minute · £25 deposit secures a platter order · we confirm by text &amp; email
      </p>
    </div>
  );
}
