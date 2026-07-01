import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type CategoryCounts, type OpeningHours, type Platter, type BoardType } from "../lib/api";
import { gbp } from "../lib/format";
import { Ticker } from "../components/Header";

const DAY_LABELS: Array<{ key: keyof OpeningHours; label: string }> = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const BOARD_ORDER: BoardType[] = ["charcuterie", "savoury", "cheese", "salmon"];
const BOARD_TITLES: Record<BoardType, string> = {
  charcuterie: "Charcuterie Board",
  savoury: "Savoury Board",
  cheese: "Cheese Board",
  salmon: "Smoked Salmon Board",
};
const BOARD_BADGE: Record<BoardType, string> = {
  charcuterie: "Bestseller",
  savoury: "Crowd favourite",
  cheese: "Simple & fresh",
  salmon: "Light & elegant",
};

const DEFAULT_HERO_IMG = "https://images.unsplash.com/photo-1695606392727-d8b959879721?auto=format&fit=crop&w=1400&q=70";
const DEFAULT_MISSION = "The deli your grandparents would recognise — local produce, no shortcuts, boards built the same way every time.";
const DEFAULT_FOUNDER_NOTE = "We've been doing this the same way for years — proper local produce, boards built by hand, nothing rushed. Every order that goes out the door is one we'd be happy to serve our own family.";

function parseHours(raw: string | null): OpeningHours | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OpeningHours;
  } catch {
    return null;
  }
}

function toMinutes(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}
function parseRange(str: string | undefined): [number, number] | null {
  if (!str || /closed/i.test(str)) return null;
  const [a, b] = str.split("-").map((s) => s.trim());
  const start = a ? toMinutes(a) : null;
  const end = b ? toMinutes(b) : null;
  return start != null && end != null ? [start, end] : null;
}
function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function computeOpenStatus(hours: OpeningHours): { open: boolean; text: string } {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dayIdx = (now.getDay() + 6) % 7;
  const todayRange = parseRange(hours[DAY_LABELS[dayIdx].key]);
  if (todayRange && nowMin >= todayRange[0] && nowMin < todayRange[1]) {
    return { open: true, text: `Open now · closes ${fmtMinutes(todayRange[1])}` };
  }
  for (let i = 0; i <= 7; i++) {
    const idx = (dayIdx + i) % 7;
    const range = parseRange(hours[DAY_LABELS[idx].key]);
    if (!range) continue;
    if (i === 0 && nowMin < range[0]) return { open: false, text: `Closed · opens today ${fmtMinutes(range[0])}` };
    if (i > 0) return { open: false, text: `Closed · opens ${DAY_LABELS[idx].label} ${fmtMinutes(range[0])}` };
  }
  return { open: false, text: "Closed" };
}

export default function Choice() {
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [boards, setBoards] = useState<Platter[] | null>(null);
  const [catering, setCatering] = useState<Platter[] | null>(null);
  const [showHours, setShowHours] = useState(false);
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
          heroImageUrl: null, missionTagline: null, founderNote: null,
        }),
      );
    api.platters("platters" as any).then(setBoards).catch(() => setBoards([]));
    Promise.all([api.platters("home"), api.platters("events")])
      .then(([h, e]) => setCatering([...h.slice(0, 1), ...e.slice(0, 1)]))
      .catch(() => setCatering([]));
  }, []);

  const go = (path: string) => navigate(`${path}${suffix}`);
  const tastingsComingSoon = counts ? counts.tastingsComingSoon : true;
  const clickCollectComingSoon = counts ? counts.clickCollectComingSoon : true;
  const hours = parseHours(counts?.openingHours ?? null);
  const today = DAY_LABELS[(new Date().getDay() + 6) % 7];

  const boardCards = BOARD_ORDER.map((boardType) => {
    const p = boards?.find((x) => x.boardType === boardType && x.size === "medium" && !x.name.includes("Build Your Own"));
    return p ? { boardType, platter: p } : null;
  }).filter((x): x is { boardType: BoardType; platter: Platter } => !!x);

  return (
    <div className="choice">
      <Ticker />
      <header className="landing-hero" style={{ backgroundImage: `url(${counts?.heroImageUrl || DEFAULT_HERO_IMG})` }}>
        <div className="lh-scrim">
          <p className="lh-eyebrow">Independent · family-run</p>
          <h1 className="lh-mark">Kelly&apos;s Deli</h1>
          <p className="lh-tag">
            {counts?.aboutText ??
              "Proper food from the people you know — grazing boards for delivery, platters for home and work."}
          </p>
          <button className="btn hero-cta" onClick={() => go("/platters")}>Order platters</button>
          <div className="lh-trust">
            <span className="stars" aria-hidden="true">★★★★★</span>
            <span>Trusted by local families for years</span>
          </div>
        </div>
      </header>

      <div className="mission-band">
        <p>{counts?.missionTagline || DEFAULT_MISSION}</p>
      </div>

      <div className="app">
        {boardCards.length > 0 && (
          <section className="shelf">
            <div className="spread shelf-head">
              <h2 className="choice-h" style={{ margin: 0 }}>Shop by board</h2>
              <button className="btn-ghost" onClick={() => go("/platters")}>See all →</button>
            </div>
            <div className="shelf-scroll">
              {boardCards.map(({ boardType, platter }) => (
                <button key={boardType} className="shelf-card" onClick={() => go("/platters")}>
                  <div className="shelf-card-img" style={{ backgroundImage: platter.imageUrl ? `url(${platter.imageUrl})` : undefined }}>
                    <span className="badge dark shelf-card-badge">{BOARD_BADGE[boardType]}</span>
                  </div>
                  <span className="shelf-card-title">{BOARD_TITLES[boardType]}</span>
                  <span className="shelf-card-price">From {gbp(platter.fixedPrice!)}</span>
                </button>
              ))}
              {boardCards.some((b) => b.boardType === "charcuterie") && (
                <button className="shelf-card" onClick={() => go("/configure")}>
                  <div
                    className="shelf-card-img"
                    style={{ backgroundImage: boardCards.find((b) => b.boardType === "charcuterie")?.platter.imageUrl ? `url(${boardCards.find((b) => b.boardType === "charcuterie")!.platter.imageUrl})` : undefined }}
                  >
                    <span className="badge gold shelf-card-badge">Build your own</span>
                  </div>
                  <span className="shelf-card-title">Configure your own</span>
                  <span className="shelf-card-price">Pick your own extras</span>
                </button>
              )}
            </div>
          </section>
        )}

        <section className="founder-note">
          <p className="founder-eyebrow">A note from the deli counter</p>
          <p className="founder-copy">{counts?.founderNote || DEFAULT_FOUNDER_NOTE}</p>
          <p className="founder-sign">— Kelly</p>
        </section>

        <div className="info-row">
          {hours && (
            <div className="card hours-card">
              <button className="hours-status" onClick={() => setShowHours((s) => !s)}>
                <span className={`status-dot ${computeOpenStatus(hours).open ? "open" : "closed"}`} aria-hidden="true" />
                <span className="hours-status-text">{computeOpenStatus(hours).text}</span>
                <span className="hours-toggle">{showHours ? "Hide hours ▲" : "Full hours ▼"}</span>
              </button>
              {showHours && (
                <div className="hours-grid">
                  {DAY_LABELS.map((d) => (
                    <div key={d.key} className={`hours-row${d.key === today.key ? " is-today" : ""}`}>
                      <span className="hours-day">{d.label}</span>
                      <span className="hours-time">{hours[d.key]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="choice-strip coming-soon" aria-disabled="true">
            <span>Click &amp; Collect</span>
            <span className="cs-badge">{clickCollectComingSoon ? "Coming soon" : ""}</span>
          </div>
        </div>

        {catering && catering.length > 0 && (
          <section className="shelf">
            <h2 className="choice-h">Catering &amp; events</h2>
            <div className="choice-grid">
              {catering[0] && (
                <button className="choice-card photo" onClick={() => go("/menu/home")}>
                  {catering[0].imageUrl && <div className="choice-card-img" style={{ backgroundImage: `url(${catering[0].imageUrl})` }} />}
                  <span className="choice-title">At Home</span>
                  <span className="choice-sub">Dinner, date night, family &amp; friends</span>
                  <span className="choice-go">Browse platters →</span>
                </button>
              )}
              {catering[1] && (
                <button className="choice-card photo" onClick={() => go("/menu/events")}>
                  {catering[1].imageUrl && <div className="choice-card-img" style={{ backgroundImage: `url(${catering[1].imageUrl})` }} />}
                  <span className="choice-title">Events &amp; Office</span>
                  <span className="choice-sub">Work lunches, parties, larger groups</span>
                  <span className="choice-go">Browse platters →</span>
                </button>
              )}
            </div>
          </section>
        )}

        {counts && counts.seasonal > 0 && (
          <button className="choice-strip seasonal" onClick={() => go("/menu/seasonal")}>
            <span>Seasonal spreads — limited time</span>
            <span className="arrow">→</span>
          </button>
        )}
        {(!counts || counts.experiences > 0) && (
          tastingsComingSoon ? (
            <div className="choice-strip coming-soon" aria-disabled="true">
              <span>Tastings &amp; Experiences</span>
              <span className="cs-badge">Coming soon</span>
            </div>
          ) : (
            <button className="choice-strip" onClick={() => go("/tastings")}>
              <span>Tastings &amp; Experiences — book a cheese tasting &amp; more</span>
              <span className="arrow">→</span>
            </button>
          )
        )}

        <p className="center muted footnote">
          Order in under a minute · £25 deposit secures a platter order · we confirm by text &amp; email
        </p>
      </div>
    </div>
  );
}
