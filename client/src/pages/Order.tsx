import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, type Platter, type LocationT, type DayAvailability, type CreateOrderInput, type Category } from "../lib/api";
import { gbp, formatDate } from "../lib/format";
import { Header } from "../components/Header";
import { CapacityCalendar } from "../components/CapacityCalendar";

type StepKey = "platter" | "headcount" | "fulfilment" | "location" | "date" | "contact" | "review";
const STEPS: StepKey[] = ["platter", "headcount", "fulfilment", "location", "date", "contact", "review"];

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default function Order() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [platters, setPlatters] = useState<Platter[]>([]);
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [loaded, setLoaded] = useState(false);

  const referralCode = params.get("referral") || undefined;
  const src = referralCode ? "referral" : params.get("src") || "direct";
  const category = (params.get("category") as Category | null) || null;

  const [platterId, setPlatterId] = useState<string>(params.get("platter") || "");
  const [headcount, setHeadcount] = useState<number>(10);
  const [isGift, setIsGift] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [customerName, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [reorderContact, setReorderContact] = useState("");
  const [reorderBusy, setReorderBusy] = useState(false);
  const [reorderInfo, setReorderInfo] = useState<string | null>(null);

  const [availability, setAvailability] = useState<DayAvailability[] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platter = platters.find((p) => p.id === platterId) || null;
  const shownPlatters = category ? platters.filter((p) => p.category === category) : platters;

  useEffect(() => {
    Promise.all([api.platters(), api.locations()])
      .then(([ps, ls]) => {
        setPlatters(ps);
        setLocations(ls);
        setLoaded(true);
        const pre = ps.find((p) => p.id === params.get("platter"));
        if (pre) {
          setHeadcount(pre.minHeadcount > 1 ? pre.minHeadcount : pre.isFixed ? 2 : 10);
          setStepIdx(1);
        }
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!locationId) return;
    setAvailability(null);
    api.availability(locationId).then((r) => setAvailability(r.days)).catch((e) => setError(e.message));
  }, [locationId]);

  const pricing = useMemo(() => {
    if (!platter) return null;
    const base = platter.isFixed ? platter.fixedPrice! : platter.pricePerHead! * headcount;
    const discount = referralCode ? Math.min(15, base) : 0;
    const total = round2(Math.max(0, base - discount));
    return { base: round2(base), discount: round2(discount), total, deposit: round2(total * 0.25) };
  }, [platter, headcount, referralCode]);

  const step = STEPS[stepIdx];

  function canAdvance(): boolean {
    switch (step) {
      case "platter": return !!platterId;
      case "headcount": return !!platter && headcount >= platter.minHeadcount;
      case "fulfilment": return !isGift || (recipientName.trim().length > 0 && deliveryAddress.trim().length > 5);
      case "location": return !!locationId;
      case "date": return !!date;
      case "contact": return customerName.trim().length > 0 && phone.trim().length >= 5 && /\S+@\S+\.\S+/.test(email);
      default: return true;
    }
  }

  const next = () => { setError(null); setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)); };
  const back = () => { setError(null); setStepIdx((i) => Math.max(i - 1, 0)); };

  async function doReorder() {
    if (!reorderContact.trim()) return;
    setReorderBusy(true);
    setError(null);
    try {
      const r = await api.reorder(reorderContact.trim());
      setPlatterId(r.platterId);
      setHeadcount(r.headcount);
      setLocationId(r.locationId);
      setNotes(r.notes ?? "");
      setReorderInfo(`Re-ordering your usual — ${r.platterName} for ${r.headcount} at ${r.locationName}. Just pick your date and pop your details in.`);
      setStepIdx(STEPS.indexOf("date"));
    } catch (e: any) {
      setError(e.message || "Couldn't find a previous order");
    } finally {
      setReorderBusy(false);
    }
  }

  async function submit() {
    if (!platter) return;
    setSubmitting(true);
    setError(null);
    const body: CreateOrderInput = {
      platterId,
      headcount,
      collectionOrDeliveryDate: date,
      locationId,
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim() || undefined,
      src,
      referralCodeUsed: referralCode,
      isGift,
      recipientName: isGift ? recipientName.trim() : undefined,
      deliveryAddress: isGift ? deliveryAddress.trim() : undefined,
      giftMessage: isGift && giftMessage.trim() ? giftMessage.trim() : undefined,
    };
    try {
      const { order } = await api.createOrder(body);
      navigate(`/confirm/${order.ref}`);
    } catch (e: any) {
      setError(e.message || "Could not place order");
      setSubmitting(false);
    }
  }

  if (!loaded && !error) {
    return <div className="app"><Header /><p className="muted center">Loading…</p></div>;
  }

  const progress = Math.round(((stepIdx + 1) / STEPS.length) * 100);
  const locName = locations.find((l) => l.id === locationId)?.name;
  const dateLabel = isGift ? "Delivery" : "Collection";

  return (
    <div className="app">
      <Header />
      <Link to={category ? `/menu/${category}` : "/"} className="btn-ghost back">← Back to menu</Link>
      <div className="progress"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>

      {referralCode && <div className="notice good">£15 referral discount will be applied 🎉</div>}
      {reorderInfo && <div className="notice good">{reorderInfo}</div>}
      {error && <div className="notice danger">{error}</div>}

      {/* STEP: platter */}
      {step === "platter" && (
        <section>
          <h1>Choose your platter</h1>
          <div className="reorder-box">
            <strong>Ordered before? Re-order your usual</strong>
            <div className="row" style={{ marginTop: 8 }}>
              <input className="input" placeholder="Phone or email" value={reorderContact} onChange={(e) => setReorderContact(e.target.value)} />
              <button className="btn btn-secondary" style={{ width: "auto" }} onClick={doReorder} disabled={reorderBusy || !reorderContact.trim()}>
                {reorderBusy ? "…" : "Find it"}
              </button>
            </div>
          </div>
          <div className="stack">
            {shownPlatters.map((p) => (
              <button key={p.id} className={`select-card ${platterId === p.id ? "selected" : ""}`}
                onClick={() => { setPlatterId(p.id); setHeadcount(p.minHeadcount > 1 ? p.minHeadcount : p.isFixed ? 2 : 10); }}>
                <span className="spread"><strong>{p.name}</strong><span>{p.isFixed ? gbp(p.fixedPrice!) : `${gbp(p.pricePerHead!)}/head`}</span></span>
                <span className="muted">{p.serves ? `Serves ${p.serves}` : ""}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* STEP: headcount */}
      {step === "headcount" && platter && (
        <section>
          <h1>{platter.isFixed ? "How many guests?" : "How many people?"}</h1>
          <p className="muted">
            {platter.name}{platter.isFixed ? ` is a fixed platter (${gbp(platter.fixedPrice!)}), serving ${platter.serves}.` : ` is ${gbp(platter.pricePerHead!)} per head, minimum ${platter.minHeadcount}.`}
          </p>
          <div className="stepper-input">
            <button className="round" onClick={() => setHeadcount((h) => Math.max(platter.minHeadcount, h - 1))} aria-label="fewer">−</button>
            <input className="input headcount" type="number" min={platter.minHeadcount} value={headcount} onChange={(e) => setHeadcount(Math.max(1, Number(e.target.value) || 0))} />
            <button className="round" onClick={() => setHeadcount((h) => h + 1)} aria-label="more">＋</button>
          </div>
          {!platter.isFixed && pricing && <p className="center estimate">Estimated total <strong>{gbp(pricing.base)}</strong></p>}
          {headcount < platter.minHeadcount && <p className="center danger">Minimum {platter.minHeadcount} for this platter.</p>}
        </section>
      )}

      {/* STEP: fulfilment (collection or gift) */}
      {step === "fulfilment" && (
        <section>
          <h1>Collection or a gift?</h1>
          <div className="stack">
            <button className={`select-card ${!isGift ? "selected" : ""}`} onClick={() => setIsGift(false)}>
              <strong>🏪 I&apos;ll collect it</strong>
              <span className="muted">Pick up from your chosen shop</span>
            </button>
            <button className={`select-card ${isGift ? "selected" : ""}`} onClick={() => setIsGift(true)}>
              <strong>🎁 Send it as a gift</strong>
              <span className="muted">We&apos;ll deliver to them with your message</span>
            </button>
          </div>
          {isGift && (
            <div style={{ marginTop: 16 }}>
              <div className="field"><label>Recipient name</label><input className="input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></div>
              <div className="field"><label>Delivery address</label><textarea className="input" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="House, street, town, postcode" /></div>
              <div className="field"><label>Gift card message (optional)</label><textarea className="input" value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder="Happy birthday! Enjoy x" /></div>
            </div>
          )}
        </section>
      )}

      {/* STEP: location */}
      {step === "location" && (
        <section>
          <h1>Which shop?</h1>
          <p className="muted">{isGift ? "Which shop prepares & sends it." : "Collect from your nearest Kelly's Deli."}</p>
          <div className="stack">
            {locations.map((l) => (
              <button key={l.id} className={`select-card ${locationId === l.id ? "selected" : ""}`} onClick={() => setLocationId(l.id)}>
                <strong>{l.name}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* STEP: date */}
      {step === "date" && (
        <section>
          <h1>Pick a {dateLabel.toLowerCase()} date</h1>
          <p className="muted">{locName} · 48 hours&apos; notice needed. Grab a slot before it fills.</p>
          {!availability && <p className="muted center">Checking availability…</p>}
          {availability && <CapacityCalendar days={availability} selected={date} onSelect={setDate} />}
        </section>
      )}

      {/* STEP: contact */}
      {step === "contact" && (
        <section>
          <h1>Your details</h1>
          <div className="field"><label htmlFor="name">Your name</label><input id="name" className="input" value={customerName} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="phone">Phone</label><input id="phone" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" className="input" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="notes">Allergies / dietary notes (optional)</label><textarea id="notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </section>
      )}

      {/* STEP: review */}
      {step === "review" && platter && pricing && (
        <section>
          <h1>Confirm your order</h1>
          <div className="card review">
            <Row label="Platter" value={platter.name} />
            <Row label={platter.isFixed ? "Guests" : "People"} value={String(headcount)} />
            <Row label={dateLabel} value={date ? formatDate(date) : "—"} />
            {isGift && <Row label="Send to" value={recipientName} />}
            {isGift && <Row label="Address" value={deliveryAddress} />}
            {isGift && giftMessage && <Row label="Message" value={giftMessage} />}
            <Row label="Shop" value={locName ?? "—"} />
            <Row label="You" value={`${customerName} · ${phone}`} />
            {notes && <Row label="Notes" value={notes} />}
            <hr />
            {pricing.discount > 0 && (<><Row label="Subtotal" value={gbp(pricing.base)} /><Row label="Referral discount" value={`− ${gbp(pricing.discount)}`} /></>)}
            <Row label="Total" value={gbp(pricing.total)} strong />
            <Row label="Deposit due now (25%)" value={gbp(pricing.deposit)} strong accent />
          </div>
          <p className="muted center footnote">Your {gbp(pricing.deposit)} deposit secures the date. Balance on {isGift ? "delivery" : "collection"}. No card is charged in this demo — the deposit is captured as pending.</p>
        </section>
      )}

      <div className="nav-row">
        {stepIdx > 0 && <button className="btn btn-secondary" onClick={back} disabled={submitting}>Back</button>}
        {step !== "review"
          ? <button className="btn" onClick={next} disabled={!canAdvance()}>Continue</button>
          : <button className="btn" onClick={submit} disabled={submitting}>{submitting ? "Placing order…" : `Pay ${pricing ? gbp(pricing.deposit) : ""} deposit & confirm`}</button>}
      </div>
    </div>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={`review-row${accent ? " accent" : ""}`}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  );
}
