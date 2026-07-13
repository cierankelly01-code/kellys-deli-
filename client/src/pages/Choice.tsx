import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type CategoryCounts, type OpeningHours, type Platter } from "../lib/api";
import { saveCart } from "../lib/cart";
import { gbp } from "../lib/format";
import { Ticker } from "../components/Header";
import { StickyCta } from "../components/StickyCta";

const DAY_LABELS: Array<{ key: keyof OpeningHours; label: string }> = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];

const DEFAULT_HERO_IMG = "https://images.unsplash.com/photo-1695606392727-d8b959879721?auto=format&fit=crop&w=1400&q=70";
const DEFAULT_MISSION = "The deli your grandparents would recognise — local produce, no shortcuts, boards built the same way every time.";
const DEFAULT_FOUNDER_NOTE = "We've been doing this the same way for years — proper local produce, boards built by hand, nothing rushed. Every order that goes out the door is one we'd be happy to serve our own family.";

function parseHours(raw: string | null): OpeningHours | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as OpeningHours; } catch { return null; }
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
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
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

function priceFeeds(p: Platter): string {
  const price = gbp(p.fixedPrice ?? p.fromPrice ?? 0);
  return p.serves ? `${price} · feeds ${p.serves}` : price;
}

export default function Choice() {
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [boards, setBoards] = useState<Platter[] | null>(null);
  const [showHours, setShowHours] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const src = params.get("src");
  const suffix = src ? `?src=${encodeURIComponent(src)}` : "";

  useEffect(() => {
    api.categories().then(setCounts).catch(() => setCounts(null));
    api.boards("signature").then(setBoards).catch(() => setBoards([]));
  }, []);

  const go = (path: string) => navigate(`${path}${suffix}`);
  const startOrder = (p: Platter) => {
    saveCart({ boards: [{ platterId: p.id, quantity: 1 }], addOns: [], headcount: 0, origin: "direct" });
    go("/order");
  };

  const hours = parseHours(counts?.openingHours ?? null);
  const today = DAY_LABELS[(new Date().getDay() + 6) % 7];
  const signature = boards ?? [];

  return (
    <div className="choice">
      <Ticker />
      <header className="landing-hero" style={{ backgroundImage: `url(${counts?.heroImageUrl || DEFAULT_HERO_IMG})` }}>
        <div className="lh-scrim">
          <p className="lh-eyebrow">Independent · family-run</p>
          <h1 className="lh-mark">Kelly&apos;s Deli</h1>
          <p className="lh-tag">
            {counts?.aboutText ?? "Proper food from the people you know — grazing boards for collection, made fresh."}
          </p>
          <div className="hero-ctas">
            <button className="btn hero-cta" onClick={() => go("/platters")}>Order a board</button>
            <button className="btn-ghost hero-cta-2" onClick={() => go("/plan")}>Plan my event</button>
          </div>
          {counts?.reviewRating && (
            <div className="lh-trust">
              <span className="stars" aria-hidden="true">★</span>
              <span>{counts.reviewRating} {counts.reviewCount ? `· ${counts.reviewCount} Google reviews` : ""}</span>
            </div>
          )}
        </div>
      </header>

      <div className="mission-band"><p>{counts?.missionTagline || DEFAULT_MISSION}</p></div>

      {/* Trust strip (build spec §5.3) */}
      <div className="trust-strip">
        <span>Family-run</span>
        <span aria-hidden="true">·</span>
        <span>Three local shops</span>
        <span aria-hidden="true">·</span>
        <span>Collect from your chosen shop</span>
      </div>

      <div className="app">
        <section className="board-section">
          <div className="spread shelf-head">
            <h2 className="section-h" style={{ margin: 0 }}>Signature boards</h2>
            <button className="btn-ghost" onClick={() => go("/platters")}>See all →</button>
          </div>
          {signature.length === 0 ? (
            <p className="muted">Loading boards…</p>
          ) : (
            <div className="board-grid">
              {signature.map((p) => (
                <article key={p.id} className="board-card card">
                  <div className="board-card-img" style={{ backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : undefined }} role="img" aria-label={p.name} />
                  <div className="board-card-body">
                    <h3 className="board-card-name">{p.name}</h3>
                    <p className="board-card-price">{priceFeeds(p)}</p>
                    <div className="board-card-actions">
                      <button className="btn" onClick={() => startOrder(p)}>Order · {gbp(p.fixedPrice ?? 0)}</button>
                      <button className="btn-ghost" onClick={() => go(`/platter/${p.id}`)}>Details</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <button className="plan-banner" onClick={() => go("/plan")}>
          <span className="pb-title">Catering for a group?</span>
          <span className="pb-sub">Plan my event — tell us your numbers and we&apos;ll suggest the spread →</span>
        </button>

        <section className="founder-note">
          <p className="founder-eyebrow">A note from the deli counter</p>
          <p className="founder-copy">{counts?.founderNote || DEFAULT_FOUNDER_NOTE}</p>
          <p className="founder-sign">— Kelly</p>
        </section>

        {hours && (
          <div className="info-row">
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
          </div>
        )}

        <div className="referral-teaser">
          <span className="referral-teaser-title">Refer a friend, you both get £15 off</span>
          <span className="muted">Every order gives you a code to share — turns up on your confirmation page.</span>
        </div>

        <p className="center muted footnote">
          Order in under a minute · a 25% deposit confirms your order · we confirm by text &amp; email
        </p>
      </div>
      <StickyCta label="Order a board" to={`/platters${suffix}`} />
    </div>
  );
}
