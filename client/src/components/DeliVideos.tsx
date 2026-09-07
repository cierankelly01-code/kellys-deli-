import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trackShoppingEvent } from "../lib/consent";

export type DeliVideo = { title: string; url: string; poster: string; productId: string; captions: string };
export function DeliVideos({ productId, compact = false, onProductNavigate }: { productId?: string; compact?: boolean; onProductNavigate?: () => void }) {
  const [videos, setVideos] = useState<DeliVideo[]>([]);
  useEffect(() => {
    let current = true;
    fetch("/api/deli-videos").then((r) => r.ok ? r.json() : []).then((v) => { if (current && Array.isArray(v)) setVideos(v); }).catch(() => {});
    return () => { current = false; };
  }, []);
  const visible = videos.filter((v) => !productId || v.productId === productId).slice(0, compact ? 2 : 6);
  if (!visible.length) return null;
  return <section className={`deli-videos${compact ? " compact" : ""}`} aria-label="From the deli kitchen">
    <p className="deli-eyebrow">A taste of Kelly’s</p>
    <h2 className="section-h">See what’s on the table.</h2>
    <div className="deli-video-grid">{visible.map((v) => <article key={v.url}>
      <video controls playsInline preload="none" crossOrigin={v.captions ? "anonymous" : undefined} poster={v.poster || undefined} aria-label={v.title} onPlay={() => trackShoppingEvent("product_video_play", { item_id: v.productId || undefined })}>
        <source src={v.url} />
        {v.captions && <track kind="captions" src={v.captions} srcLang="en" label="English" default />}
        Your browser cannot play this video.
      </video>
      <h3>{v.title}</h3>
      {v.productId && <Link className="deli-text-link" onClick={onProductNavigate} to={`/platter/${encodeURIComponent(v.productId)}`}>Shop this board ↗</Link>}
    </article>)}</div>
  </section>;
}
