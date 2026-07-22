import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CategoryCounts, type Platter, type RecommendResponse } from "../lib/api";
import { feedsCapacity, feedsRange, roundTo5p } from "../lib/addOnPricing";
import { saveCart } from "../lib/cart";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { Header } from "../components/Header";

/** Headcounts people actually type, with the occasion each one usually is. */
const CHIPS: Array<{ n: number; label: string }> = [
  { n: 10, label: "Get-together" },
  { n: 15, label: "Birthday do" },
  { n: 20, label: "Big party" },
  { n: 30, label: "Office floor" },
  { n: 40, label: "Full function" },
];

/**
 * Board photo over a monogram tile. The letter is always painted underneath rather
 * than swapped in by an onError handler — a 404 or a slow image then degrades to the
 * monogram on its own, with no JS involved. (Uploaded photos have gone missing in
 * production before; an empty grey square is the one outcome worth engineering out.)
 */
function BoardThumb({ board, size = 64, eager = false }: { board: Platter; size?: number; eager?: boolean }) {
  // onError additionally removes the failed <img>, because Chromium paints its own
  // broken-image glyph over the monogram otherwise. The monogram is what makes this
  // correct even when onError never fires (slow load, blocked request).
  const [failed, setFailed] = useState(false);
  return (
    <span className="pl-thumb" style={{ width: size, height: size, fontSize: size / 2.6 }} aria-hidden="true">
      {board.name.slice(0, 1)}
      {board.imageUrl && !failed && (
        <img
          src={board.imageUrl}
          alt=""
          // The hero is the LCP element — lazy-loading it costs a whole round trip.
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function feedsLabel(b: Platter): string {
  if (b.feedsMin && b.feedsMax) return `feeds ${b.feedsMin}–${b.feedsMax}`;
  if (b.serves) return `feeds ${b.serves}`;
  return "";
}

export default function PlanEvent() {
  usePageTitle(
    "Plan my event",
    "Catering for a party, office or celebration in Solihull? Tell Kelly's Deli your headcount and occasion and we'll recommend the right grazing boards, platters and add-ons.",
  );
  const navigate = useNavigate();

  const [step, setStep] = useState<"count" | "combo">("count");
  // Held as a string: coercing on every keystroke snapped an emptied field back to
  // "1", so the number could not be backspaced and retyped.
  const [headcountText, setHeadcountText] = useState("15");
  const headcount = Math.min(500, Math.max(1, parseInt(headcountText, 10) || 1));
  const setHeadcount = (n: number) => setHeadcountText(String(n));
  const [boards, setBoards] = useState<Platter[]>([]);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [rec, setRec] = useState<RecommendResponse | null>(null);
  const [combo, setCombo] = useState<Map<string, number>>(new Map());
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boardsFailed, setBoardsFailed] = useState(false);
  // Focused when the spread appears, so a keyboard/screen-reader user knows the
  // step changed instead of pressing a button and hearing nothing.
  const spreadHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // A silent [] here used to produce a "£0.00, feeds 0" dead end with no way
    // forward. If the boards can't load, say so and give people the phone.
    api.boards()
      .then((b) => { setBoards(b); setBoardsFailed(b.length === 0); })
      .catch(() => setBoardsFailed(true));
    api.categories().then(setCounts).catch(() => setCounts(null));
  }, []);

  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);

  // The server recommends against its own feeds data; this page judges coverage by
  // the top of each board's printed range. If the server under-fills by that measure,
  // top it up before showing it, so the suggestion never trips our own shortfall
  // warning. User edits after this point are left alone — the warning is then real.
  useEffect(() => {
    if (!rec || boards.length === 0) return;
    setCombo((prev) => {
      const next = new Map(prev);
      let feeds = [...next.entries()].reduce((s, [id, q]) => {
        const b = boardById.get(id);
        return b ? s + feedsCapacity(b) * q : s;
      }, 0);
      if (feeds >= headcount) return prev;
      const bySize = boards.filter((b) => feedsCapacity(b) > 0).sort((a, b) => feedsCapacity(a) - feedsCapacity(b));
      let guard = 0;
      while (feeds < headcount && bySize.length > 0 && guard++ < 50) {
        const gap = headcount - feeds;
        const pick = bySize.find((b) => feedsCapacity(b) >= gap) ?? bySize[bySize.length - 1];
        next.set(pick.id, (next.get(pick.id) ?? 0) + 1);
        feeds += feedsCapacity(pick);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, boards]);

  async function getRecommendation(n: number) {
    setLoading(true);
    setError(null);
    try {
      const r = await api.recommend(n);
      setRec(r);
      setCombo(new Map(r.items.map((i) => [i.boardId, i.qty])));
      setStep("combo");
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
      window.requestAnimationFrame(() => spreadHeadingRef.current?.focus());
    } catch {
      setError("Couldn't build a recommendation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const comboLines = useMemo(
    () =>
      [...combo.entries()]
        .map(([id, qty]) => {
          const b = boardById.get(id);
          return b && qty > 0 ? { board: b, qty } : null;
        })
        .filter((x): x is { board: Platter; qty: number } => !!x),
    [combo, boardById],
  );

  const feeds = feedsRange(comboLines);
  const totalPrice = comboLines.reduce((s, l) => s + (l.board.fixedPrice ?? 0) * l.qty, 0);
  // Judged against the top of the printed range — the same number on the board card.
  const undercatered = feeds.max < headcount;
  const perHead = headcount > 0 ? totalPrice / headcount : 0;
  const deposit = roundTo5p(totalPrice * 0.25);
  const balance = Math.round((totalPrice - deposit) * 100) / 100;

  const setQty = (id: string, qty: number) => {
    const next = new Map(combo);
    if (qty <= 0) next.delete(id);
    else next.set(id, qty);
    setCombo(next);
  };

  const addBoard = (id: string) => {
    setQty(id, (combo.get(id) ?? 0) + 1);
    setPicking(false);
  };

  /** One tap out of the under-catering warning: add the board that closes the gap. */
  const fixShortfall = () => {
    const gap = headcount - feeds.max;
    const bySize = boards.filter((b) => feedsCapacity(b) > 0).sort((a, b) => feedsCapacity(a) - feedsCapacity(b));
    const pick = bySize.find((b) => feedsCapacity(b) >= gap) ?? bySize[bySize.length - 1];
    if (pick) setQty(pick.id, (combo.get(pick.id) ?? 0) + 1);
  };

  const proceed = () => {
    saveCart({
      boards: comboLines.map((l) => ({ platterId: l.board.id, quantity: l.qty })),
      addOns: [],
      headcount,
      origin: "event",
    });
    navigate("/order");
  };

  const otherBoards = boards.filter((b) => !combo.has(b.id));
  const rating = counts?.reviewRating;
  const reviews = counts?.reviewCount;
  // Biggest signature board with a photo — the most appetising thing we can show.
  const hero = useMemo(
    () =>
      boards
        .filter((b) => b.imageUrl && b.tier === "signature")
        .sort((a, b) => feedsCapacity(b) - feedsCapacity(a))[0]
      ?? boards.find((b) => b.imageUrl),
    [boards],
  );

  return (
    <div className="app app-wide plan-event">
      <Header />
      <button className="link-back" onClick={() => (step === "combo" ? setStep("count") : navigate("/"))}>← Back</button>

      {step === "count" && (
        <section className="plan-count pl-grid">
          <div className="pl-intro">
          <p className="pl-eyebrow">Event planning · free · takes 20 seconds</p>
          <h1 className="pl-h1">How many are you feeding?</h1>
          <p className="pl-lede">
            Give us a headcount and we&apos;ll put together a spread that actually stretches —
            so you&apos;re not doing sums the night before.
          </p>

          {boardsFailed && (
            <div className="notice danger" role="alert">
              We can&apos;t load the boards right now. Please refresh, or call the deli on{" "}
              <a href="tel:01564703441">01564 703441</a> and we&apos;ll sort your event over the phone.
            </div>
          )}

          </div>

          {/* Shown at every width: a page selling food that shows no food is why this
              one used to read as a form. Decorative letter is hidden from AT; the
              caption below is real, readable product information. */}
          {hero && (
            <aside className="pl-aside">
              <div className="pl-aside-photo">
                <BoardThumb board={hero} size={520} eager />
              </div>
              <p className="pl-aside-cap">
                <strong>{hero.name}</strong>
                <span>{gbp(hero.fixedPrice ?? 0)} · {feedsLabel(hero)}</span>
              </p>
            </aside>
          )}

          <div className="pl-controls">
          <div className="pl-chips">
            {CHIPS.map(({ n, label }) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} people — ${label}`}
                aria-pressed={headcount === n}
                className={`pl-chip${headcount === n ? " selected" : ""}`}
                onClick={() => setHeadcount(n)}
              >
                <span className="pl-chip-n">{n}{n === 40 ? "+" : ""}</span>
                <span className="pl-chip-label">{label}</span>
              </button>
            ))}
          </div>

          <label className="pl-exact">
            <span>Or an exact number</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={headcountText}
              onChange={(e) => setHeadcountText(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              onBlur={() => setHeadcountText(String(headcount))}
              aria-label="Headcount"
            />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn pl-cta" disabled={loading} onClick={() => getRecommendation(headcount)}>
            {loading ? "Working…" : "Show me a spread"}
          </button>
          <p className="pl-micro">Nothing&apos;s ordered yet — you&apos;ll see every price first.</p>

          <ul className="pl-trust">
            <li><strong>48 hours&apos;</strong> notice is all we need</li>
            <li><strong>25% deposit</strong> confirms it — balance on collection</li>
            {rating && reviews
              ? <li><strong>{rating}★</strong> from {reviews} Google reviews</li>
              : <li><strong>Independent</strong> and family-run since day one</li>}
          </ul>
          </div>
        </section>
      )}

      {step === "combo" && rec && (
        <section className="plan-combo">
          <h1 className="pl-h1 pl-h1-sm" ref={spreadHeadingRef} tabIndex={-1}>Our suggestion for {headcount} people</h1>
          <p className="pl-lede">Swap anything you like — remove a board, add another. Totals update as you go.</p>

          {comboLines.length === 0 && (
            <p className="pl-empty">
              You&apos;ve taken everything out. Add a board below, or{" "}
              <button type="button" className="u-link" onClick={() => setStep("count")}>start again</button>.
            </p>
          )}

          <ul className="combo-list">
            {comboLines.map((l) => (
              <li key={l.board.id} className="combo-row card">
                <BoardThumb board={l.board} />
                <div className="combo-info">
                  <span className="combo-name">{l.board.name}</span>
                  <span className="muted">{gbp(l.board.fixedPrice ?? 0)} · {feedsLabel(l.board)}</span>
                </div>
                <div className="stepper" role="group" aria-label={`${l.board.name} quantity`}>
                  <button type="button" onClick={() => setQty(l.board.id, l.qty - 1)} aria-label="Decrease">−</button>
                  <span className="stepper-val">{l.qty}</span>
                  <button type="button" onClick={() => setQty(l.board.id, l.qty + 1)} aria-label="Increase">+</button>
                </div>
              </li>
            ))}
          </ul>

          {otherBoards.length > 0 && (
            <div className="combo-add">
              {!picking ? (
                <button type="button" className="pl-add-toggle" onClick={() => setPicking(true)}>
                  + Add another board
                </button>
              ) : (
                <div className="pl-picker">
                  <div className="pl-picker-head">
                    <strong>Add a board</strong>
                    <button type="button" className="btn-ghost" onClick={() => setPicking(false)}>Close</button>
                  </div>
                  <ul className="pl-picker-list">
                    {otherBoards.map((b) => (
                      <li key={b.id}>
                        <button type="button" className="pl-picker-item" onClick={() => addBoard(b.id)}>
                          <BoardThumb board={b} size={48} />
                          <span className="pl-picker-info">
                            <span className="combo-name">{b.name}</span>
                            <span className="muted">{gbp(b.fixedPrice ?? 0)} · {feedsLabel(b)}</span>
                          </span>
                          <span className="pl-picker-add" aria-hidden="true">+</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {undercatered && (
            <div className="pl-shortfall" role="status">
              <p>This mix feeds up to {feeds.max} — it won&apos;t stretch to {headcount}.</p>
              <button type="button" className="btn-ghost" onClick={fixShortfall}>Add a board to cover it</button>
            </div>
          )}

          <div className="pl-summary">
            <div className="pl-summary-nums">
              <span className="pl-summary-feeds">
                Feeds <strong>{feeds.min === feeds.max ? feeds.max : `${feeds.min}–${feeds.max}`}</strong>
                {perHead > 0 && <em>{gbp(perHead)} a head</em>}
              </span>
              <span className="pl-summary-total">{gbp(totalPrice)}</span>
            </div>
            <button className="btn" disabled={comboLines.length === 0} onClick={proceed}>
              Continue with these boards
            </button>
            {totalPrice > 0 && (
              <p className="pl-micro">
                <strong>{gbp(deposit)}</strong> confirms it — {gbp(balance)} on collection.
                Nothing charged yet.
              </p>
            )}

            {/* Proof belongs on the screen where the money decision is made, not only
                on the one before it. Rating falls back to plain policy if unavailable. */}
            <ul className="pl-trust pl-trust-compact">
              <li><strong>48 hours&apos;</strong> notice is all we need</li>
              <li><strong>Made by hand</strong> in Solihull, collected from the deli</li>
              {rating && reviews
                ? <li><strong>{rating}★</strong> from {reviews} Google reviews</li>
                : <li><strong>Independent</strong> and family-run since day one</li>}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
