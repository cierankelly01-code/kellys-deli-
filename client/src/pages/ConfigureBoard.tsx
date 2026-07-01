import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, type Platter } from "../lib/api";
import { Header } from "../components/Header";
import { BoardConfigurator } from "../components/BoardConfigurator";

export default function ConfigureBoard() {
  const [platters, setPlatters] = useState<Platter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const src = params.get("src");

  useEffect(() => {
    api.platters("platters" as any).then(setPlatters).catch((e) => setError(e.message));
  }, []);

  function addToOrder(platterId: string, qty: number, customItems: string[]) {
    const q = new URLSearchParams({ platter: platterId, category: "platters", quantity: String(qty) });
    if (src) q.set("src", src);
    if (customItems.length) q.set("customItems", customItems.join(","));
    navigate(`/order?${q.toString()}`);
  }

  const customPlatters = (platters ?? []).filter(
    (p) => p.boardType === "charcuterie" && p.name.includes("Build Your Own"),
  );

  return (
    <div className="app">
      <Header />
      <Link to="/platters" className="btn-ghost back">← Back to platters</Link>
      <section className="hero platters-hero">
        <h1>Configure your board</h1>
        <p className="muted">Pick a size, then choose your cheeses and extras — same charcuterie board, made your way.</p>
      </section>

      {error && <div className="notice danger">{error}</div>}
      {!platters && !error && <p className="muted center">Loading…</p>}

      {platters && customPlatters.length > 0 && (
        <BoardConfigurator customPlatters={customPlatters} onAdd={addToOrder} />
      )}
    </div>
  );
}
