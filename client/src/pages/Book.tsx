import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, type Experience, type LocationT, type DayAvailability } from "../lib/api";
import { gbp, formatDate } from "../lib/format";
import { Header } from "../components/Header";
import { CapacityCalendar } from "../components/CapacityCalendar";

type StepKey = "experience" | "party" | "location" | "date" | "contact" | "review";
const STEPS: StepKey[] = ["experience", "party", "location", "date", "contact", "review"];
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function Book() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const src = params.get("src") || "direct";

  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);

  const [experienceId, setExperienceId] = useState(params.get("experience") || "");
  const [partySize, setPartySize] = useState(2);
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState("");
  const [customerName, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [availability, setAvailability] = useState<DayAvailability[] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const experience = experiences.find((e) => e.id === experienceId) || null;

  useEffect(() => {
    api.categories().then((c) => setComingSoon(c.tastingsComingSoon)).catch(() => setComingSoon(true));
    Promise.all([api.experiences(), api.locations()])
      .then(([es, ls]) => {
        setExperiences(es);
        setLocations(ls);
        setLoaded(true);
        if (es.find((e) => e.id === params.get("experience"))) setStepIdx(1);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!experienceId || !locationId) return;
    setAvailability(null);
    api.experienceAvailability(experienceId, locationId).then((r) => setAvailability(r.days)).catch((e) => setError(e.message));
  }, [experienceId, locationId]);

  const pricing = useMemo(() => {
    if (!experience) return null;
    const total = round2(experience.pricePerHead * partySize);
    return { total, deposit: round2(total * 0.25) };
  }, [experience, partySize]);

  const step = STEPS[stepIdx];
  function canAdvance(): boolean {
    switch (step) {
      case "experience": return !!experienceId;
      case "party": return partySize >= 1;
      case "location": return !!locationId;
      case "date": return !!date;
      case "contact": return customerName.trim().length > 0 && phone.trim().length >= 5 && /\S+@\S+\.\S+/.test(email);
      default: return true;
    }
  }
  const next = () => { setError(null); setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)); };
  const back = () => { setError(null); setStepIdx((i) => Math.max(i - 1, 0)); };

  async function submit() {
    if (!experience) return;
    setSubmitting(true);
    setError(null);
    try {
      const { order } = await api.createBooking({
        experienceId, partySize, date, locationId,
        customerName: customerName.trim(), phone: phone.trim(), email: email.trim(),
        notes: notes.trim() || undefined, src,
      });
      navigate(`/confirm/${order.ref}`);
    } catch (e: any) {
      setError(e.message || "Could not book");
      setSubmitting(false);
    }
  }

  if (comingSoon) {
    return (
      <div className="app">
        <Header />
        <Link to="/tastings" className="btn-ghost back">← Back</Link>
        <div className="comingsoon-banner" style={{ marginTop: 16 }}>
          <strong>Tastings are coming soon 🧀</strong>
          <span>Bookings aren&apos;t open just yet. Browse our platters in the meantime.</span>
          <Link className="btn" to="/menu/home">Browse platters</Link>
        </div>
      </div>
    );
  }
  if (!loaded && !error) return <div className="app"><Header /><p className="muted center">Loading…</p></div>;
  const progress = Math.round(((stepIdx + 1) / STEPS.length) * 100);
  const locName = locations.find((l) => l.id === locationId)?.name;

  return (
    <div className="app">
      <Header />
      <Link to="/tastings" className="btn-ghost back">← Back to experiences</Link>
      <div className="progress"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
      {error && <div className="notice danger">{error}</div>}

      {step === "experience" && (
        <section>
          <h1>Choose an experience</h1>
          <div className="stack">
            {experiences.map((e) => (
              <button key={e.id} className={`select-card ${experienceId === e.id ? "selected" : ""}`} onClick={() => setExperienceId(e.id)}>
                <span className="spread"><strong>{e.name}</strong><span>{gbp(e.pricePerHead)}/head</span></span>
                <span className="muted">Up to {e.capacity} guests</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "party" && experience && (
        <section>
          <h1>How many guests?</h1>
          <p className="muted">{experience.name} · {gbp(experience.pricePerHead)} per head · up to {experience.capacity} per session.</p>
          <div className="stepper-input">
            <button className="round" onClick={() => setPartySize((n) => Math.max(1, n - 1))} aria-label="fewer">−</button>
            <input className="input headcount" type="number" min={1} max={experience.capacity} value={partySize} onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 0))} />
            <button className="round" onClick={() => setPartySize((n) => Math.min(experience.capacity, n + 1))} aria-label="more">＋</button>
          </div>
          {pricing && <p className="center estimate">Estimated total <strong>{gbp(pricing.total)}</strong></p>}
        </section>
      )}

      {step === "location" && (
        <section>
          <h1>Which location?</h1>
          <div className="stack">
            {locations.map((l) => (
              <button key={l.id} className={`select-card ${locationId === l.id ? "selected" : ""}`} onClick={() => setLocationId(l.id)}><strong>{l.name}</strong></button>
            ))}
          </div>
        </section>
      )}

      {step === "date" && (
        <section>
          <h1>Pick a date</h1>
          <p className="muted">{locName} · 48 hours&apos; notice. Seats per session are limited.</p>
          {!availability && <p className="muted center">Checking availability…</p>}
          {availability && <CapacityCalendar days={availability} selected={date} onSelect={setDate} />}
        </section>
      )}

      {step === "contact" && (
        <section>
          <h1>Your details</h1>
          <div className="field"><label>Name</label><input className="input" value={customerName} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Phone</label><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="field"><label>Email</label><input className="input" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label>Dietary notes (optional)</label><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </section>
      )}

      {step === "review" && experience && pricing && (
        <section>
          <h1>Confirm your booking</h1>
          <div className="card review">
            <div className="review-row"><span className="muted">Experience</span><span>{experience.name}</span></div>
            <div className="review-row"><span className="muted">Guests</span><span>{partySize}</span></div>
            <div className="review-row"><span className="muted">Date</span><span>{date ? formatDate(date) : "—"}</span></div>
            <div className="review-row"><span className="muted">Location</span><span>{locName}</span></div>
            <div className="review-row"><span className="muted">You</span><span>{customerName} · {phone}</span></div>
            <hr />
            <div className="review-row"><span className="muted">Total</span><span style={{ fontWeight: 700 }}>{gbp(pricing.total)}</span></div>
            <div className="review-row accent"><span className="muted">Deposit due now (25%)</span><span style={{ fontWeight: 700 }}>{gbp(pricing.deposit)}</span></div>
          </div>
          <p className="muted center footnote">Your {gbp(pricing.deposit)} deposit secures your seats. Balance on the night.</p>
        </section>
      )}

      <div className="nav-row">
        {stepIdx > 0 && <button className="btn btn-secondary" onClick={back} disabled={submitting}>Back</button>}
        {step !== "review"
          ? <button className="btn" onClick={next} disabled={!canAdvance()}>Continue</button>
          : <button className="btn" onClick={submit} disabled={submitting}>{submitting ? "Booking…" : `Pay ${pricing ? gbp(pricing.deposit) : ""} deposit & book`}</button>}
      </div>
    </div>
  );
}
