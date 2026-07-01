import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, type Platter, type BoardType } from "../lib/api";
import { gbp } from "../lib/format";
import { Header } from "../components/Header";
import { BoardConfigurator } from "../components/BoardConfigurator";

const BOARD_ORDER: BoardType[] = ["charcuterie", "savoury", "cheese", "salmon"];
const BOARD_TITLES: Record<BoardType, string> = {
  charcuterie: "Charcuterie Board",
  savoury: "Savoury Board",
  cheese: "Cheese Board",
  salmon: "Smoked Salmon Board",
};
const SIZE_ORDER = ["small", "medium", "large"] as const;
const SIZE_LABEL: Record<string, string> = { small: "Small", medium: "Medium", large: "Large" };

function BoardTile({ platter, onAdd }: { platter: Platter; onAdd: (qty: number) => void }) {
  const [qty, setQty] = useState(1);
  return (
    <div className="board-tile">
      {platter.imageUrl && <div className="board-tile-img" style={{ backgroundImage: `url(${platter.imageUrl})` }} />}
      <div className="board-tile-body">
        <span className="board-tile-size">{SIZE_LABEL[platter.size ?? ""] ?? platter.size}</span>
        <span className="board-tile-price">{gbp(platter.fixedPrice!)}</span>
        <span className="muted board-tile-serves">Serves {platter.serves}</span>
        <div className="stepper-input compact">
          <button className="round" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="fewer">−</button>
          <span className="qty-value">{qty}</span>
          <button className="round" onClick={() => setQty((q) => q + 1)} aria-label="more">＋</button>
        </div>
        <button className="btn" onClick={() => onAdd(qty)}>Add to order</button>
      </div>
    </div>
  );
}

export default function Platters() {
  const [platters, setPlatters] = useState<Platter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const src = params.get("src");

  useEffect(() => {
    api.platters("platters" as any).then(setPlatters).catch((e) => setError(e.message));
  }, []);

  function addToOrder(platterId: string, qty: number, customItems?: string[]) {
    const q = new URLSearchParams({ platter: platterId, category: "platters", quantity: String(qty) });
    if (src) q.set("src", src);
    if (customItems && customItems.length) q.set("customItems", customItems.join(","));
    navigate(`/order?${q.toString()}`);
  }

  return (
    <div className="app">
      <Header />
      <Link to={src ? `/?src=${src}` : "/"} className="btn-ghost back">← Back</Link>
      <section className="hero">
        <h1>Platters</h1>
        <p className="muted">Grazing boards for delivery — pick a size, or build your own charcuterie board.</p>
      </section>

      {error && <div className="notice danger">{error}</div>}
      {!platters && !error && <p className="muted center">Loading…</p>}

      {platters && BOARD_ORDER.map((boardType) => {
        const presets = SIZE_ORDER
          .map((size) => platters.find((p) => p.boardType === boardType && p.size === size && !p.name.includes("Build Your Own")))
          .filter((p): p is Platter => !!p);
        if (presets.length === 0) return null;
        const customPlatters = SIZE_ORDER
          .map((size) => platters.find((p) => p.boardType === boardType && p.size === size && p.name.includes("Build Your Own")))
          .filter((p): p is Platter => !!p);

        return (
          <section key={boardType} className="board-section">
            <h2 className="board-section-h">{BOARD_TITLES[boardType]}</h2>
            <p className="muted clamp-2">{presets[0].description}</p>
            <div className="board-tile-grid">
              {presets.map((p) => (
                <BoardTile key={p.id} platter={p} onAdd={(qty) => addToOrder(p.id, qty)} />
              ))}
            </div>

            {customPlatters.length > 0 && (
              <BoardConfigurator
                customPlatters={customPlatters}
                onAdd={(platterId, qty, customItems) => addToOrder(platterId, qty, customItems)}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
