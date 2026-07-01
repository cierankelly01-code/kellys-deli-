import { useEffect, useState } from "react";
import { adminApi } from "../../lib/admin";
import { type OpeningHours } from "../../lib/api";

const DAYS: Array<{ key: keyof OpeningHours; label: string }> = [
  { key: "mon", label: "Monday" }, { key: "tue", label: "Tuesday" }, { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" }, { key: "fri", label: "Friday" }, { key: "sat", label: "Saturday" }, { key: "sun", label: "Sunday" },
];
const DEFAULT_HOURS: OpeningHours = { mon: "9:00 - 17:00", tue: "9:00 - 17:00", wed: "9:00 - 17:00", thu: "9:00 - 17:00", fri: "9:00 - 17:00", sat: "9:00 - 16:00", sun: "Closed" };

export default function SiteSettings() {
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS);
  const [about, setAbout] = useState("");
  const [clickCollectOpen, setClickCollectOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    adminApi.settings().then((s) => {
      try { setHours(s.openingHours ? JSON.parse(s.openingHours) : DEFAULT_HOURS); } catch { setHours(DEFAULT_HOURS); }
      setAbout(s.aboutText ?? "");
      setClickCollectOpen(s.clickCollectComingSoon === "off");
    }).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function saveHoursAndAbout() {
    setSaving(true); setError(null); setMsg(null);
    try {
      await adminApi.setSetting("openingHours", JSON.stringify(hours));
      await adminApi.setSetting("aboutText", about.trim());
      setMsg("Saved — live on the homepage now.");
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleClickCollect(open: boolean) {
    setSaving(true); setError(null);
    try {
      await adminApi.setSetting("clickCollectComingSoon", open ? "off" : "on");
      refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Site Settings</h1>
      {msg && <div className="notice good">{msg}</div>}
      {error && <div className="notice danger">{error}</div>}

      <h2>Click &amp; Collect</h2>
      <div className="card loc-row" style={{ marginBottom: 18 }}>
        <label className="toggle inline">
          <input type="checkbox" checked={clickCollectOpen} disabled={saving} onChange={(e) => toggleClickCollect(e.target.checked)} />
          <span>
            <strong>Open Click &amp; Collect</strong> — {clickCollectOpen ? "live on the homepage" : "currently showing “Coming soon”"}
          </span>
        </label>
      </div>

      <h2>About text</h2>
      <div className="field">
        <textarea className="input" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="A line or two about the business, shown on the homepage." />
      </div>

      <h2>Opening hours</h2>
      {DAYS.map((d) => (
        <div className="field" key={d.key}>
          <label>{d.label}</label>
          <input className="input" value={hours[d.key]} onChange={(e) => setHours((h) => ({ ...h, [d.key]: e.target.value }))} placeholder="e.g. 9:00 - 17:00 or Closed" />
        </div>
      ))}

      <div className="nav-row">
        <button className="btn" onClick={saveHoursAndAbout} disabled={saving}>{saving ? "Saving…" : "Save hours & about"}</button>
      </div>
    </div>
  );
}
