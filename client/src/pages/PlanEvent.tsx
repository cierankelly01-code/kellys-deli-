import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Platter, type RecommendResponse } from "../lib/api";
import { feedsMid } from "../lib/addOnPricing";
import { saveCart } from "../lib/cart";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { Header } from "../components/Header";

const CHIPS = [10, 15, 20, 30, 40];

export default function PlanEvent() {
  usePageTitle(
    "Plan my event",
    "Catering for a party, office or celebration in Solihull? Tell Kelly's Deli your headcount and occasion and we'll recommend the right grazing boards, platters and add-ons.",
  );
  const navigate = useNavigate();

  const [step, setStep] = useState<"count" | "combo">("count");
  const [headcount, setHeadcount] = useState<number>(15);
  const [boards, setBoards] = useState<Platter[]>([]);
  const [rec, setRec] = useState<RecommendResponse | null>(null);
  const [combo, setCombo] = useState<Map<string, number>>(new Map());
  const [addBoardId, setAddBoardId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.boards().then(setBoards).catch(() => setBoards([]));
  }, []);

  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);

  async function getRecommendation(n: number) {
    setLoading(true);
    setError(null);
    try {
      const r = await api.recommend(n);
      setRec(r);
      setCombo(new Map(r.items.map((i) => [i.boardId, i.qty])));
      setStep("combo");
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

  const addBoard = () => {
    if (!addBoardId) return;
    setQty(addBoardId, (combo.get(addBoardId) ?? 0) + 1);
    setAddBoardId("");
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

  return (
    <div className="app plan-event">
      <Header />
      <button className="link-back" onClick={() => (step === "combo" ? setStep("count") : navigate("/"))}>← Back</button>
      <h1 className="page-h">Plan my event</h1>

      {step === "count" && (
        <section className="plan-count">
          <h2 className="step-h">How many people are you feeding?</h2>
          <div className="chip-row">
            {CHIPS.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip${headcount === n ? " selected" : ""}`}
                onClick={() => setHeadcount(n)}
              >
                {n}{n === 40 ? "+" : ""}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Or enter a number</span>
            <input
              type="number"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(Math.max(1, parseInt(e.target.value || "1", 10)))}
              aria-label="Headcount"
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn" disabled={loading} onClick={() => getRecommendation(headcount)}>
            {loading ? "Working…" : "Show me a spread"}
          </button>
        </section>
      )}

      {step === "combo" && rec && (
        <section className="plan-combo">
          <h2 className="step-h">Our suggestion for {headcount} people</h2>
          <p className="muted">Swap anything you like — remove a board or add another. The totals update as you go.</p>

          <ul className="combo-list">
            {comboLines.map((l) => (
              <li key={l.board.id} className="combo-row card">
                <div className="combo-info">
                  <span className="combo-name">{l.board.name}</span>
                  <span className="muted">{gbp(l.board.fixedPrice ?? 0)} · feeds {l.board.serves}</span>
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
              <select value={addBoardId} onChange={(e) => setAddBoardId(e.target.value)} aria-label="Add a board">
                <option value="">Add another board…</option>
                {otherBoards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} — {gbp(b.fixedPrice ?? 0)} · feeds {b.serves}</option>
                ))}
              </select>
              <button type="button" className="btn-ghost" onClick={addBoard} disabled={!addBoardId}>Add</button>
            </div>
          )}

          <div className="combo-totals card">
            <div className="review-row"><span>Feeds about</span><span>{Math.round(totalFeeds)} people</span></div>
            <div className="review-row total"><span>Combination total</span><span>{gbp(totalPrice)}</span></div>
          </div>

          {undercatered && (
            <p className="undercater-warning" role="alert">
              ⚠ This mix may not stretch to {headcount} people. Add another board to be safe.
            </p>
          )}

          <button className="btn" disabled={comboLines.length === 0} onClick={proceed}>
            Continue with these boards
          </button>
        </section>
      )}
    </div>
  );
}
