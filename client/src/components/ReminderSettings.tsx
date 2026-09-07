import { useEffect, useState } from "react";
import { adminApi } from "../lib/admin";

export function ReminderSettings() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { adminApi.settings().then((s) => setEnabled(s.remindersEnabled === "on")).catch(() => setMessage("Could not load reminder settings.")); }, []);
  async function save() {
    setSaving(true);
    try { await adminApi.setSetting("remindersEnabled", enabled ? "on" : "off"); setMessage("Saved. The form appears only when delivery services are configured on the server."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not save."); }
    finally { setSaving(false); }
  }
  return <section className="card" style={{ padding: 24, marginBlock: 24 }}><h2>Birthday &amp; occasion reminders</h2><p>Customers choose email, text or both, and 7, 14 or 30 days’ notice. Each signup is for one upcoming date. Existing legacy email enquiries are not automatically enrolled.</p><label className="deli-check"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable occasion reminders</label><p className="muted">Delivery needs REMINDERS_ENABLED=on plus Resend email / Twilio Messaging Service credentials on the server. The worker checks every 15 minutes. Accepted means the provider accepted the message, not confirmed delivery. Failed or uncertain attempts need staff review.</p><button type="button" className="btn" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save reminder settings"}</button>{message && <p role="status">{message}</p>}</section>;
}
