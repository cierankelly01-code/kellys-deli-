import { useEffect, useState } from "react";
import { adminApi, type SmsCustomer } from "../../lib/admin";
import { gbp } from "../../lib/format";

const TEMPLATES = [
  "Cheese tastings now booking — reply to grab your seats 🧀",
  "Platters available this weekend — order by Thursday to secure your date 🥪",
  "New seasonal spreads are in! Treat the family — order online in 60 seconds.",
  "Thanks for being a regular — here's first dibs on our Christmas platters 🎄",
];

export default function SmsList() {
  const [customers, setCustomers] = useState<SmsCustomer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState(TEMPLATES[0]);
  const [audience, setAudience] = useState<"all" | "big_spenders">("all");
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  function load() {
    adminApi.customers().then(setCustomers).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function toggleBig(c: SmsCustomer) {
    const updated = await adminApi.setBigSpender(c.id, !c.isBigSpender);
    setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, isBigSpender: updated.isBigSpender } : x)));
  }

  async function exportCsv() {
    const csv = await adminApi.customersCsv();
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "kellys-deli-sms-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendBlast() {
    if (!message.trim()) return;
    setSending(true);
    setSentMsg(null);
    try {
      const res = await adminApi.blast(message.trim(), audience);
      setSentMsg(`Queued to ${res.sent} ${res.sent === 1 ? "person" : "people"} (${audience === "all" ? "everyone" : "big spenders"}). Payloads logged — wire Twilio to go live.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  const bigCount = customers.filter((c) => c.isBigSpender).length;

  return (
    <div>
      <h1>SMS list</h1>
      <p className="muted" style={{ marginTop: -6 }}>Every order &amp; booking captures a phone number — your most valuable asset.</p>

      {error && <div className="notice danger">{error}</div>}

      {/* Send a blast */}
      <div className="card editor">
        <h2 style={{ marginTop: 0 }}>Send a blast</h2>
        <div className="field">
          <label>Template</label>
          <select className="input" value={message} onChange={(e) => setMessage(e.target.value)}>
            {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Message</label>
          <textarea className="input" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={640} />
        </div>
        <div className="field">
          <label>Audience</label>
          <div className="seg wide">
            <button className={audience === "all" ? "active" : ""} onClick={() => setAudience("all")}>Everyone ({customers.length})</button>
            <button className={audience === "big_spenders" ? "active" : ""} onClick={() => setAudience("big_spenders")}>Big spenders ({bigCount})</button>
          </div>
        </div>
        {sentMsg && <div className="notice good">{sentMsg}</div>}
        <button className="btn" onClick={sendBlast} disabled={sending || !message.trim()}>{sending ? "Sending…" : "Send blast"}</button>
      </div>

      {/* List */}
      <div className="spread" style={{ marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Customers ({customers.length})</h2>
        <button className="btn btn-secondary" style={{ width: "auto" }} onClick={exportCsv}>⬇ Export CSV</button>
      </div>
      <div className="card table" style={{ marginTop: 12 }}>
        <div className="trow thead"><span>Name</span><span>Phone</span><span>Spend</span><span>Big spender</span></div>
        {customers.length === 0 && <div className="trow"><span className="muted">No customers yet.</span></div>}
        {customers.map((c) => (
          <div className="trow" key={c.id}>
            <span>{c.name}<small className="muted"> · {c.orderCount} order{c.orderCount === 1 ? "" : "s"}</small></span>
            <span>{c.phone}</span>
            <span>{gbp(c.lifetimeSpend)}</span>
            <span>
              <button className={`pill ${c.isBigSpender ? "" : "tag-off"}`} onClick={() => toggleBig(c)} style={{ cursor: "pointer", border: "none" }}>
                {c.isBigSpender ? "★ Big spender" : "Tag"}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
