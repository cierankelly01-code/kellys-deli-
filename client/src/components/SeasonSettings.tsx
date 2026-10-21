import { useEffect, useState } from "react";
import { adminApi } from "../lib/admin";
import { DEFAULT_SEASON_BANNER } from "../lib/season";

/** Admin: the seasonal look, the banner line, and the optional pre-order daily cap. */
export function SeasonSettings() {
  const [season, setSeason] = useState<"christmas" | "classic">("christmas");
  const [banner, setBanner] = useState("");
  const [cap, setCap] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.settings().then((s) => {
      setSeason(s.season === "classic" ? "classic" : "christmas");
      setBanner(s.seasonBanner ?? "");
      setCap(s.preorderDailyCap && s.preorderDailyCap !== "0" ? s.preorderDailyCap : "");
    }).catch((e) => setError(e.message));
  }, []);

  async function save() {
    setSaving(true); setMsg(null); setError(null);
    try {
      await adminApi.setSetting("season", season);
      await adminApi.setSetting("seasonBanner", banner.trim());
      await adminApi.setSetting("preorderDailyCap", String(Math.max(0, parseInt(cap, 10) || 0)));
      setMsg("Saved — live on the site now.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card editor">
      <h2 style={{ marginTop: 0 }}>Seasonal look &amp; Christmas orders</h2>
      <div className="field">
        <label>Website look</label>
        <div className="seg wide">
          <button type="button" aria-pressed={season === "christmas"} className={season === "christmas" ? "active" : ""} onClick={() => setSeason("christmas")}>Christmas</button>
          <button type="button" aria-pressed={season === "classic"} className={season === "classic" ? "active" : ""} onClick={() => setSeason("classic")}>Classic (all year)</button>
        </div>
        <p className="muted hint">Switch back to Classic in January — no website changes needed.</p>
      </div>
      <div className="field">
        <label>Banner along the top (Christmas look)</label>
        <input className="input" value={banner} onChange={(e) => setBanner(e.target.value)} placeholder={DEFAULT_SEASON_BANNER} maxLength={160} />
      </div>
      <div className="field">
        <label>Most pre-order collections per shop per day</label>
        <input className="input" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="No limit" />
        <p className="muted hint">Leave blank for no limit. If a day gets too busy (say the 23rd), set a number and that day closes once it&apos;s full.</p>
      </div>
      {msg && <div className="notice good">{msg}</div>}
      {error && <div className="notice danger">{error}</div>}
      <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
    </section>
  );
}
