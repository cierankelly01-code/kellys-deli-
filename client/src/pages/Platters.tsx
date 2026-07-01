import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, type Platter, type BoardType, type BoardSize } from "../lib/api";
import { gbp } from "../lib/format";
import { Header } from "../components/Header";

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
const SIZE_ORDER: BoardSize[] = ["small", "medium", "large"];
const SIZE_LABEL: Record<BoardSize, string> = { small: "Small", medium: "Medium", large: "Large" };

function BoardFeature({ boardType, sizes, onAdd, configureHref }: { boardType: BoardType; sizes: Platter[]; onAdd: (platterId: string, qty: number) => void; configureHref?: string }) {
  const [size, setSize] = useState<BoardSize>(sizes.find((p) => p.size === "medium")?.size ?? (sizes[0].size as BoardSize));
  const [qty, setQty] = useState(1);
  const platter = sizes.find((p) => p.size === size) ?? sizes[0];

  return (
    <section className="board-feature">
      <div className="board-feature-img" style={{ backgroundImage: platter.imageUrl ? `url(${platter.imageUrl})` : undefined }}>
        <span className="badge dark board-feature-badge">{BOARD_BADGE[boardType]}</span>
        {boardType === "charcuterie" && <span className="badge gold board-feature-badge badge-2">Customisable</span>}
      </div>
      <div className="board-feature-body">
        <h2 className="board-feature-h">{BOARD_TITLES[boardType]}</h2>
        <p className="muted board-feature-desc">{platter.description}</p>

        <div className="size-select" role="group" aria-label="Board size">
          {SIZE_ORDER.filter((s) => sizes.some((p) => p.size === s)).map((s) => {
            const p = sizes.find((x) => x.size === s)!;
            return (
              <button key={s} className={`chip ${size === s ? "selected" : ""}`} onClick={() => setSize(s)}>
                {SIZE_LABEL[s]} <span className="chip-price">{gbp(p.fixedPrice!)}</span>
              </button>
            );
          })}
        </div>
        <p className="muted board-feature-serves">Serves {platter.serves}</p>

        <div className="buy-bar">
          <div className="buy-bar-qty">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="fewer">−</button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} aria-label="more">＋</button>
          </div>
          <button className="btn buy-bar-add" onClick={() => onAdd(platter.id, qty)}>
            Add · {gbp(platter.fixedPrice! * qty)}
          </button>
        </div>

        {configureHref && (
          <Link to={configureHref} className="configure-cta">
            Or configure your own board →
          </Link>
        )}
      </div>
    </section>
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
    <div className="app platters-page">
      <Header />
      <Link to={src ? `/?src=${src}` : "/"} className="btn-ghost back">← Back</Link>
      <section className="hero platters-hero">
        <h1>Platters</h1>
        <p className="muted">Grazing boards for delivery — pick a size, or build your own charcuterie board.</p>
      </section>

      {error && <div className="notice danger">{error}</div>}
      {!platters && !error && <p className="muted center">Loading…</p>}

      {platters && BOARD_ORDER.map((boardType) => {
        const sizes = SIZE_ORDER
          .map((size) => platters.find((p) => p.boardType === boardType && p.size === size && !p.name.includes("Build Your Own")))
          .filter((p): p is Platter => !!p);
        if (sizes.length === 0) return null;
        const hasCustom = boardType === "charcuterie" && platters.some((p) => p.boardType === boardType && p.name.includes("Build Your Own"));

        return (
          <BoardFeature
            key={boardType}
            boardType={boardType}
            sizes={sizes}
            onAdd={addToOrder}
            configureHref={hasCustom ? `/configure${src ? `?src=${src}` : ""}` : undefined}
          />
        );
      })}
    </div>
  );
}
