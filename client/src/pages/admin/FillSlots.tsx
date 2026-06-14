import { useEffect, useState } from "react";
import { adminApi, type FillSlot } from "../../lib/admin";

export default function FillSlots() {
  const [slots, setSlots] = useState<FillSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    adminApi.fillSlots(7).then((r) => setSlots(r.slots)).catch((e) => setError(e.message));
  }, []);

  async function copy(slot: FillSlot) {
    const key = `${slot.locationId}|${slot.date}`;
    try {
      await navigator.clipboard.writeText(slot.promo);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div>
      <h1>Fill these slots</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        Open capacity over the next 7 days. Copy a promo and post it to Instagram or email to
        drum up last-minute orders.
      </p>

      {error && <div className="notice danger">{error}</div>}
      {!slots && !error && <p className="muted">Loading…</p>}
      {slots && slots.length === 0 && (
        <div className="notice good">Nicely booked up — no open slots in the next 7 days. 🎉</div>
      )}

      <div className="stack">
        {slots?.map((s) => {
          const key = `${s.locationId}|${s.date}`;
          return (
            <div className="card slot-card" key={key}>
              <div className="spread">
                <div>
                  <strong>{s.locationName}</strong>
                  <div className="muted">{s.humanDate}</div>
                </div>
                <div className="right">
                  <span className="pill warn">{s.remaining} of {s.capacity} open</span>
                  {s.withinNotice && <div className="muted tiny">within 48h — take by phone</div>}
                </div>
              </div>
              <p className="promo-text">{s.promo}</p>
              <button className="btn btn-secondary" onClick={() => copy(s)}>
                {copiedKey === key ? "Copied!" : "Copy promo"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
