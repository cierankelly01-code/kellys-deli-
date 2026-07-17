import { useEffect, useState } from "react";
import {
  adminApi,
  type CorporateEnquiryDTO,
  type SubscriptionDTO,
  type AdminReminder,
} from "../../lib/admin";
import { formatDate } from "../../lib/format";

export default function Enquiries() {
  return (
    <div>
      <h1>Enquiries &amp; Subscriptions</h1>
      <EnquiriesSection />
      <SubscriptionsSection />
      <RemindersSection />
    </div>
  );
}

function EnquiriesSection() {
  const [rows, setRows] = useState<CorporateEnquiryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    adminApi.corporateEnquiries().then(setRows).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function setStatus(id: string, status: CorporateEnquiryDTO["status"]) {
    try {
      await adminApi.setEnquiryStatus(id, status);
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? prev);
    } catch (e: any) { setError(e.message); }
  }

  return (
    <section>
      <h2>Corporate enquiries</h2>
      {error && <div className="notice danger">{error}</div>}
      {!rows && !error && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="muted">No enquiries yet.</p>}
      <div className="stack">
        {rows?.map((r) => (
          <div className="card loc-row" key={r.id}>
            <div className="spread">
              <div>
                <strong>{r.company}</strong>
                <div className="muted">
                  {r.contactName} · <a href={`mailto:${r.email}`}>{r.email}</a>
                  {r.phone ? ` · ${r.phone}` : ""}
                </div>
                <div className="muted">
                  {r.headcount != null ? `${r.headcount} ppl` : "headcount —"}
                  {r.frequency ? ` · ${r.frequency}` : ""} · {formatDate(r.createdAt)}
                </div>
                {r.message && <div className="order-meta"><span className="notes">📝 {truncate(r.message, 200)}</span></div>}
              </div>
              <div className="right">
                <select className="input status-select" value={r.status} onChange={(e) => setStatus(r.id, e.target.value as CorporateEnquiryDTO["status"])}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SubscriptionsSection() {
  const [rows, setRows] = useState<SubscriptionDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    adminApi.subscriptions().then(setRows).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function setStatus(id: string, status: SubscriptionDTO["status"]) {
    try {
      await adminApi.setSubscriptionStatus(id, status);
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? prev);
    } catch (e: any) { setError(e.message); }
  }

  return (
    <section>
      <h2>Subscriptions</h2>
      <p className="muted">
        These are Subscribe &amp; Save sign-ups. No card has been taken — contact the customer to
        set up each schedule.
      </p>
      {error && <div className="notice danger">{error}</div>}
      {!rows && !error && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="muted">No subscriptions yet.</p>}
      <div className="stack">
        {rows?.map((r) => (
          <div className="card loc-row" key={r.id}>
            <div className="spread">
              <div>
                <strong>{r.customerName}</strong>
                <div className="muted">
                  <a href={`mailto:${r.email}`}>{r.email}</a>
                  {r.phone ? ` · ${r.phone}` : ""}
                </div>
                <div className="muted">
                  {r.frequency} · {r.discountPct}% off
                  {r.invoiced ? " · Invoiced monthly" : ""} · {r.orderCount} order{r.orderCount === 1 ? "" : "s"} · {formatDate(r.createdAt)}
                </div>
                {r.notes && <div className="order-meta"><span className="notes">📝 {truncate(r.notes, 200)}</span></div>}
              </div>
              <div className="right">
                <select className="input status-select" value={r.status} onChange={(e) => setStatus(r.id, e.target.value as SubscriptionDTO["status"])}>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RemindersSection() {
  const [rows, setRows] = useState<AdminReminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.reminders().then(setRows).catch((e) => setError(e.message));
  }, []);

  return (
    <section>
      <h2>Reminders</h2>
      <p className="muted">Customers who asked to be reminded before an occasion.</p>
      {error && <div className="notice danger">{error}</div>}
      {!rows && !error && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="muted">No reminders yet.</p>}
      {rows && rows.length > 0 && (
        <div className="card table">
          <div className="trow thead">
            <span>Email</span><span>Occasion</span><span>Reminder date</span><span>Created</span>
          </div>
          {rows.map((r) => (
            <div className="trow" key={r.id}>
              <span><a href={`mailto:${r.email}`}>{r.email}</a></span>
              <span>{r.occasion}</span>
              <span>{r.reminderDate ? formatDate(r.reminderDate) : "—"}</span>
              <span>{formatDate(r.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}
