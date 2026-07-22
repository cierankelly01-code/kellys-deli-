import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CategoryCounts, type Platter, type RecommendResponse } from "../lib/api";
import { feedsMid } from "../lib/addOnPricing";
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
function BoardThumb({ board, size = 64 }: { board: Platter; size?: number }) {
  // onError additionally removes the failed <img>, because Chromium paints its own
  // broken-image glyph over the monogram otherwise. The monogram is what makes this
  // correct even when onError never fires (slow load, blocked request).
  const [failed, setFailed] = useState(false);
  return (
    <span className="pl-thumb" style={{ width: size, height: size, fontSize: size / 2.6 }} aria-hidden="true">
      {board.name.slice(0, 1)}
      {board.imageUrl && !failed && (
        <img src={board.imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
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
  const [headcount, setHeadcount] = useState<number>(15);
  const [boards, setBoards] = useState<Platter[]>([]);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [rec, setRec] = useState<RecommendResponse | null>(null);
  const [combo, setCombo] = useState<Map<string, number>>(new Map());
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.boards().then(setBoards).catch(() => setBoards([]));
    api.categories().then(setCounts).catch(() => setCounts(null));
  }, []);

  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);

  // The server fills against its own feeds data; this page judges the combo with
  // feedsMid(). If the two disagree, the fresh suggestion could trip our own
  // under-catering warning — so top the suggestion up by OUR metric before showing
  // it. User edits after this point are deliberately left alone (the warning is
  // then genuinely useful).
  useEffect(() => {
    if (!rec || boards.length === 0) return;
    setCombo((prev) => {
      const next = new Map(prev);
      let feeds = [...next.entries()].reduce((s, [id, q]) => {
        const b = boardById.get(id);
        return b ? s + feedsMid(b) * q : s;
      }, 0);
      if (feeds >= headcount) return prev;
      const bySize = boards.filter((b) => feedsMid(b) > 0).sort((a, b) => feedsMid(a) - feedsMid(b));
      let guard = 0;
      while (feeds < headcount && bySize.length > 0 && guard++ < 50) {
        const gap = headcount - feeds;
        const pick = bySize.find((b) => feedsMid(b) >= gap) ?? bySize[bySize.length - 1];
        next.set(pick.id, (next.get(pick.id) ?? 0) + 1);
        feeds += feedsMid(pick);
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
      window.scrollTo({ top: 0, behavior: "smooth" });
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

  const totalFeeds = comboLines.reduce((s, l) => s + feedsMid(l.board) * l.qty, 0);
  const totalPrice = comboLines.reduce((s, l) => s + (l.board.fixedPrice ?? 0) * l.qty, 0);
  const undercatered = totalFeeds < headcount;

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
    const gap = headcount - totalFeeds;
    const bySize = boards.filter((b) => feedsMid(b) > 0).sort((a, b) => feedsMid(a) - feedsMid(b));
    const pick = bySize.find((b) => feedsMid(b) >= gap) ?? bySize[bySize.length - 1];
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

  return (
    <div className="app plan-event">
      <Header />
      <button className="link-back" onClick={() => (step === "combo" ? setStep("count") : navigate("/"))}>← Back</button>

      {step === "count" && (
        <section className="plan-count">
          <p className="pl-eyebrow">Event planning · free · takes 20 seconds</p>
          <h1 className="pl-h1">How many are you feeding?</h1>
          <p className="pl-lede">
            Give us a headcount and we&apos;ll put together a spread that actually stretches —
            so you&apos;re not doing sums the night before.
          </p>

          <div className="pl-chips">
            {CHIPS.map(({ n, label }) => (
              <button
                key={n}
                type="button"
                aria-label={String(n)}
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
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(Math.max(1, parseInt(e.target.value || "1", 10)))}
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
            {rating && reviews && <li><strong>{rating}★</strong> from {reviews} Google reviews</li>}
          </ul>
        </section>
      )}

      {step === "combo" && rec && (
        <section className="plan-combo">
          <h1 className="pl-h1 pl-h1-sm">Our suggestion for {headcount} people</h1>
          <p className="pl-lede">Swap anything you like — remove a board, add another. Totals update as you go.</p>

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
            <div className="pl-shortfall" role="alert">
              <p>
                This mix feeds about {Math.round(totalFeeds)} — it may not stretch to {headcount}.
              </p>
              <button type="button" className="btn-ghost" onClick={fixShortfall}>Add a board to cover it</button>
            </div>
          )}

          <div className="pl-summary">
            <div className="pl-summary-nums">
              <span>Feeds about <strong>{Math.round(totalFeeds)}</strong></span>
              <span className="pl-summary-total">{gbp(totalPrice)}</span>
            </div>
            <button className="btn" disabled={comboLines.length === 0} onClick={proceed}>
              Continue with these boards
            </button>
            <p className="pl-micro">Next: pick your collection day. Still nothing charged.</p>
          </div>
        </section>
      )}
    </div>
  );
}
