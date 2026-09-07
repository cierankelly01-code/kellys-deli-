import { useEffect, useState } from "react";
import { adminApi, type AdminPlatter } from "../lib/admin";
import type { DeliVideo } from "./DeliVideos";

export function VideoSettings() {
  const [videos, setVideos] = useState<DeliVideo[]>([]);
  const [products, setProducts] = useState<AdminPlatter[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    adminApi.settings().then((s) => { try { setVideos(JSON.parse(s.deliVideos || "[]")); } catch { setMessage("Saved video configuration is invalid."); } }).catch(() => setMessage("Could not load videos."));
    adminApi.platters().then(setProducts).catch(() => {});
  }, []);
  const update = (i: number, patch: Partial<DeliVideo>) => setVideos((v) => v.map((x, j) => i === j ? { ...x, ...patch } : x));
  async function save() {
    setSaving(true); setMessage("");
    try { await adminApi.setSetting("deliVideos", JSON.stringify(videos)); setMessage("Videos saved. An empty list hides the section."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not save."); }
    finally { setSaving(false); }
  }
  return <section className="card" style={{ padding: 24, marginBlock: 24 }}>
    <h2>Shoppable food videos</h2>
    <p className="muted">Add up to six short videos you own. Use a direct HTTPS MP4/WebM file URL, a poster image and optional English VTT captions. TikTok page links are not video files. Videos load only when the customer presses play.</p>
    {videos.map((v, i) => <fieldset key={i} style={{ marginBlock: 20 }}><legend>Video {i + 1}</legend>
      {([['title', 'Title'], ['url', 'Video file URL'], ['poster', 'Poster image URL'], ['captions', 'Captions file URL (optional)']] as const).map(([key, label]) => <div className="field" key={key}><label htmlFor={`video-${i}-${key}`}>{label}</label><input id={`video-${i}-${key}`} className="input" value={v[key]} onChange={(e) => update(i, { [key]: e.target.value })} /></div>)}
      <div className="field"><label htmlFor={`video-product-${i}`}>Featured product</label><select id={`video-product-${i}`} className="input" value={v.productId} onChange={(e) => update(i, { productId: e.target.value })}><option value="">General deli video</option>{products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></div>
      <button type="button" className="btn-ghost" onClick={() => setVideos((all) => all.filter((_, j) => j !== i))}>Remove video {i + 1}</button>
    </fieldset>)}
    <div className="row"><button type="button" className="btn-ghost" disabled={videos.length >= 6} onClick={() => setVideos([...videos, { title: "", url: "", poster: "", productId: "", captions: "" }])}>Add video</button><button type="button" className="btn" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save videos"}</button></div>
    {message && <p role="status">{message}</p>}
  </section>;
}
