import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, type Platter, type LocationT, type DayAvailability, type CreateOrderInput, type Category, type BoardGroup } from "../lib/api";
import { extrasForSelection } from "../lib/boardPricing";
import { gbp, formatDate } from "../lib/format";
import { Header } from "../components/Header";
import { CapacityCalendar } from "../components/CapacityCalendar";

type StepKey = "platter" | "headcount" | "fulfilment" | "location" | "date" | "delivery" | "contact" | "review";
const CATERING_STEPS: StepKey[] = ["platter", "headcount", "fulfilment", "location", "date", "contact", "review"];
// Board configurator orders: single shop, delivery-only (click & collect isn't live yet), so
// "location" is skipped (auto-selected), and delivery address + date are combined onto one
// screen — cuts the flow to 5 steps instead of 7, since checkout length is the single biggest
// evidence-backed cause of drop-off (Baymard Institute checkout research).
const BOARD_STEPS: StepKey[] = ["platter", "headcount", "delivery", "contact", "review"];

const BOARD_DEPOSIT = 25;

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Mobile browsers routinely reload the tab when the customer switches apps
// mid-checkout (WhatsApp, calendar…). Draft the form to sessionStorage so they
// come back to exactly where they were instead of an empty form.
const DRAFT_KEY = "kd-order-draft";

interface OrderDraft {
  platterId: string;
  headcount: number;
  isGift: boolean;
  sendAsGift: boolean;
  recipientName: string;
  deliveryAddress: string;
  giftMessage: string;
  locationId: string;
  date: string;
  customerName: string;
  phone: string;
  email: string;
  notes: string;
  stepIdx: number;
}

function loadDraft(): OrderDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as OrderDraft) : null;
  } catch {
    return null;
  }
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
  const isBoard = category === "platters";
  const STEPS = isBoard ? BOARD_STEPS : CATERING_STEPS;

  // Build-your-own selections, chosen on the /platters configurator and carried via the URL.
  const [customItems] = useState<string[]>(() => {
    const raw = params.get("customItems");
    return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  });

  // A saved draft only resumes the full order (incl. step) when it's for the same
  // platter the URL asks for; otherwise just the customer's own details carry over.
  const urlPlatter = params.get("platter") || "";
  const draft = useState(() => loadDraft())[0];
  const resume = !!draft && (!urlPlatter || draft.platterId === urlPlatter);

  const [platterId, setPlatterId] = useState<string>(urlPlatter || (resume ? draft.platterId : ""));
  const [headcount, setHeadcount] = useState<number>(() => {
    if (resume) return draft.headcount;
    const qty = params.get("quantity");
    return qty ? Math.max(1, parseInt(qty, 10) || 1) : 10;
  });
  const [isGift, setIsGift] = useState(resume ? draft.isGift : false);
  const [sendAsGift, setSendAsGift] = useState(resume ? draft.sendAsGift : false); // board orders only: "gift for someone else"
  const [recipientName, setRecipientName] = useState(resume ? draft.recipientName : "");
  const [deliveryAddress, setDeliveryAddress] = useState(draft?.deliveryAddress ?? "");
  const [giftMessage, setGiftMessage] = useState(resume ? draft.giftMessage : "");
  const [locationId, setLocationId] = useState<string>(resume ? draft.locationId : "");
  const [date, setDate] = useState<string>(resume ? draft.date : "");
  const [customerName, setName] = useState(draft?.customerName ?? "");
  const [phone, setPhone] = useState(draft?.phone ?? "");
  const [email, setEmail] = useState(draft?.email ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");

  const [reorderContact, setReorderContact] = useState("");
  const [reorderBusy, setReorderBusy] = useState(false);
  const [reorderInfo, setReorderInfo] = useState<string | null>(null);

  // Group rules/prices, for the extras price preview only — the server reprices on submit.
  const [boardGroups, setBoardGroups] = useState<BoardGroup[]>([]);
  // If these rules fail to load for a board with paid extras, the preview would
  // undercount the total (extras → £0) while the server still charges them. Track
  // the failure so we can block submit rather than show a price we can't honour.
  const [boardRulesFailed, setBoardRulesFailed] = useState(false);
  useEffect(() => {
    if (!isBoard || customItems.length === 0) return;
    api.boardConfig()
      .then((c) => { setBoardGroups(c.groups); setBoardRulesFailed(false); })
      .catch(() => { setBoardGroups([]); setBoardRulesFailed(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [availability, setAvailability] = useState<DayAvailability[] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only apply the £15 referral discount once the server confirms the code is real
  // and not a self-referral — otherwise the review total wouldn't match the charge.
  const [referralValid, setReferralValid] = useState(false);
  const currentStep = STEPS[stepIdx];
  useEffect(() => {
    if (currentStep !== "review" || !referralCode || phone.length < 5 || !email.includes("@")) {
      setReferralValid(false);
      return;
    }
    let cancelled = false;
    api.checkReferral(referralCode, phone, email)
      .then((r) => { if (!cancelled) setReferralValid(r.valid); })
      .catch(() => { if (!cancelled) setReferralValid(false); });
    return () => { cancelled = true; };
  }, [currentStep, referralCode, phone, email]);

  const platter = platters.find((p) => p.id === platterId) || null;
  const shownPlatters = category ? platters.filter((p) => p.category === category) : platters;

  useEffect(() => {
    Promise.all([api.platters(), api.locations()])
      .then(([ps, ls]) => {
        setPlatters(ps);
        setLocations(ls);
        setLoaded(true);
        if (isBoard && ls.length && !locationId) setLocationId(ls[0].id); // single shop — no picker needed
        if (resume && draft.stepIdx > 0) {
          setStepIdx(Math.min(draft.stepIdx, STEPS.length - 1)); // pick up where they left off
          return;
        }
        const pre = ps.find((p) => p.id === params.get("platter"));
        if (pre) {
          if (!isBoard) setHeadcount(pre.minHeadcount > 1 ? pre.minHeadcount : pre.isFixed ? 2 : 10);
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

  // Keep the draft current so an app-switch/reload never loses the customer's progress.
  useEffect(() => {
    if (!loaded) return;
    const d: OrderDraft = { platterId, headcount, isGift, sendAsGift, recipientName, deliveryAddress, giftMessage, locationId, date, customerName, phone, email, notes, stepIdx };
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage full/blocked — not worth breaking checkout */ }
  }, [loaded, platterId, headcount, isGift, sendAsGift, recipientName, deliveryAddress, giftMessage, locationId, date, customerName, phone, email, notes, stepIdx]);

  // Each step is a new "screen" to the customer — start it at the top, not wherever
  // the last step's Continue button happened to leave the scroll position.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stepIdx]);

  // Board orders reuse `headcount` as the board quantity; priced extras apply per board.
  const extrasPerBoard = useMemo(
    () => (isBoard && customItems.length ? extrasForSelection(boardGroups, new Set(customItems)) : 0),
    [isBoard, customItems, boardGroups],
  );

  const pricing = useMemo(() => {
    if (!platter) return null;
    const base = platter.isFixed
      ? (platter.fixedPrice! + extrasPerBoard) * (isBoard ? headcount : 1)
      : platter.pricePerHead! * headcount;
    const discount = referralCode && referralValid ? Math.min(15, base) : 0;
    const total = round2(Math.max(0, base - discount));
    const deposit = isBoard ? round2(Math.min(BOARD_DEPOSIT, total)) : round2(total * 0.25);
    return { base: round2(base), discount: round2(discount), total, deposit };
  }, [platter, headcount, referralCode, referralValid, isBoard, extrasPerBoard]);

  const step = STEPS[stepIdx];

  function canAdvance(): boolean {
    switch (step) {
      case "platter": return !!platterId;
      case "headcount": return !!platter && headcount >= platter.minHeadcount;
      case "fulfilment":
        return !isGift || (recipientName.trim().length > 0 && deliveryAddress.trim().length > 5);
      case "location": return !!locationId;
      case "date": return !!date;
      case "delivery":
        return deliveryAddress.trim().length > 5 && (!sendAsGift || recipientName.trim().length > 0) && !!date;
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
      setStepIdx(STEPS.indexOf(isBoard ? "delivery" : "date"));
    } catch (e: any) {
      setError(e.message || "Couldn't find a previous order");
    } finally {
      setReorderBusy(false);
    }
  }

  async function submit() {
    if (!platter) return;
    // Don't submit a board with paid extras if we couldn't load its pricing rules —
    // the shown total may be wrong. Ask the customer to retry rather than surprise
    // them with a higher charge.
    if (isBoard && customItems.length > 0 && boardRulesFailed) {
      setError("We couldn't load the latest board pricing. Please refresh and try again.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const effectiveIsGift = isBoard ? true : isGift;
    const effectiveRecipientName = isBoard ? (sendAsGift ? recipientName.trim() : customerName.trim()) : recipientName.trim();
    const effectiveGiftMessage = isBoard ? (sendAsGift ? giftMessage.trim() : "") : giftMessage.trim();

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
      isGift: effectiveIsGift,
      recipientName: effectiveIsGift ? effectiveRecipientName : undefined,
      deliveryAddress: effectiveIsGift ? deliveryAddress.trim() : undefined,
      giftMessage: effectiveIsGift && effectiveGiftMessage ? effectiveGiftMessage : undefined,
      quantity: isBoard ? headcount : undefined,
      customItems: isBoard && customItems.length ? customItems : undefined,
    };
    try {
      const { order } = await api.createOrder(body);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      navigate(`/confirm/${order.ref}`);
    } catch (e: any) {
      setError(e.message || "Could not place order");
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: "smooth" }); // the error notice renders at the top
    }
  }

  if (!loaded && !error) {
    return <div className="app"><Header /><p className="muted center">Loading…</p></div>;
  }

  const progress = Math.round(((stepIdx + 1) / STEPS.length) * 100);
  const locName = locations.find((l) => l.id === locationId)?.name;
  const dateLabel = isBoard || isGift ? "Delivery" : "Collection";
  const backHref = category === "platters" ? `/platters${src ? `?src=${src}` : ""}` : category ? `/menu/${category}` : "/";

  return (
    <div className="app">
      <Header />
      <Link to={backHref} className="btn-ghost back">← Back</Link>
      <div className="progress"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>

      {referralCode && (
        <div className="notice good">
          {referralValid ? "£15 referral discount applied 🎉" : "£15 referral discount — applied at checkout once your code is confirmed"}
        </div>
      )}
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
                onClick={() => { setPlatterId(p.id); if (!isBoard) setHeadcount(p.minHeadcount > 1 ? p.minHeadcount : p.isFixed ? 2 : 10); }}>
                <span className="spread"><strong>{p.name}</strong><span>{p.isFixed ? gbp(p.fixedPrice!) : `${gbp(p.pricePerHead!)}/head`}</span></span>
                <span className="muted">{p.serves ? `Serves ${p.serves}` : ""}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* STEP: headcount (boards: "how many?") */}
      {step === "headcount" && platter && (
        <section>
          <h1>{isBoard ? "How many boards?" : platter.isFixed ? "How many guests?" : "How many people?"}</h1>
          <p className="muted">
            {isBoard
              ? `${platter.name} — ${gbp(platter.fixedPrice!)} each, serving ${platter.serves}.`
              : platter.isFixed ? `${platter.name} is a fixed platter (${gbp(platter.fixedPrice!)}), serving ${platter.serves}.` : `${platter.name} is ${gbp(platter.pricePerHead!)} per head, minimum ${platter.minHeadcount}.`}
          </p>
          <div className="stepper-input">
            <button className="round" onClick={() => setHeadcount((h) => Math.max(platter.minHeadcount, h - 1))} aria-label="fewer">−</button>
            <input className="input headcount" type="number" min={platter.minHeadcount} value={headcount} onChange={(e) => setHeadcount(Math.max(1, Number(e.target.value) || 0))} />
            <button className="round" onClick={() => setHeadcount((h) => h + 1)} aria-label="more">＋</button>
          </div>
          {((isBoard && platter.isFixed) || !platter.isFixed) && pricing && <p className="center estimate">Estimated total <strong>{gbp(pricing.base)}</strong></p>}
          {headcount < platter.minHeadcount && <p className="center danger">Minimum {platter.minHeadcount} for this platter.</p>}
        </section>
      )}

      {/* STEP: delivery — board orders only. Address + gift + date combined onto one screen
          instead of two separate steps, to cut checkout length (see BOARD_STEPS comment). */}
      {step === "delivery" && (
        <section>
          <h1>Delivery details</h1>
          <p className="muted">Click &amp; Collect isn&apos;t live yet, so every board is delivered.</p>
          <div className="field">
            <label>Delivery address</label>
            <textarea className="input" autoComplete="street-address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="House, street, town, postcode" />
            <p className="field-hint muted-hint">Delivered fresh from our Bentley Heath deli.</p>
          </div>
          <label className="toggle inline" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={sendAsGift} onChange={(e) => setSendAsGift(e.target.checked)} />
            <span>This is a gift for someone else</span>
          </label>
          {sendAsGift && (
            <div style={{ marginTop: 16 }}>
              <div className="field"><label>Recipient name</label><input className="input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></div>
              <div className="field"><label>Gift message (optional)</label><textarea className="input" value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder="Happy birthday! Enjoy x" /></div>
            </div>
          )}
          <h2 style={{ marginTop: 28 }}>Pick a delivery date</h2>
          <p className="muted">{locName} · 48 hours&apos; notice needed. Grab a slot before it fills.</p>
          {!availability && <p className="muted center">Checking availability…</p>}
          {availability && <CapacityCalendar days={availability} selected={date} onSelect={setDate} />}
        </section>
      )}

      {/* STEP: fulfilment — catering only (board orders use the combined "delivery" step above) */}
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

      {/* STEP: location (catering only — board orders auto-select the one shop) */}
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
          <div className="field"><label htmlFor="name">Your name</label><input id="name" className="input" autoComplete="name" value={customerName} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {phone.trim().length > 0 && phone.trim().length < 5 && <p className="field-hint">That phone number looks too short.</p>}
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {email.trim().length > 3 && !/\S+@\S+\.\S+/.test(email) && <p className="field-hint">That email doesn&apos;t look quite right — is a bit missing?</p>}
          </div>
          <div className="field"><label htmlFor="notes">Allergies / dietary notes (optional)</label><textarea id="notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </section>
      )}

      {/* STEP: review */}
      {step === "review" && platter && pricing && (
        <section>
          <h1>Confirm your order</h1>
          <div className="card review">
            <Row label="Platter" value={platter.name} />
            <Row label={isBoard ? "Boards" : platter.isFixed ? "Guests" : "People"} value={String(headcount)} />
            {isBoard && customItems.length > 0 && (
              <Row
                label="Your selection"
                value={customItems
                  .map((l) => {
                    const opt = boardGroups.flatMap((g) => g.options).find((o) => o.label === l);
                    return opt && opt.price > 0 ? `${l} (+${gbp(opt.price)})` : l;
                  })
                  .join(", ")}
              />
            )}
            {isBoard && extrasPerBoard > 0 && <Row label="Extras" value={`+${gbp(extrasPerBoard)} per board`} />}
            <Row label={dateLabel} value={date ? formatDate(date) : "—"} />
            {isBoard && <Row label="Deliver to" value={sendAsGift ? recipientName : customerName} />}
            {deliveryAddress.trim() && <Row label="Address" value={deliveryAddress} />}
            {((isBoard && sendAsGift) || (!isBoard && isGift)) && giftMessage && <Row label="Message" value={giftMessage} />}
            {!isBoard && <Row label="Shop" value={locName ?? "—"} />}
            <Row label="You" value={`${customerName} · ${phone}`} />
            {notes && <Row label="Notes" value={notes} />}
            <hr />
            {pricing.discount > 0 && (<><Row label="Subtotal" value={gbp(pricing.base)} /><Row label="Referral discount" value={`− ${gbp(pricing.discount)}`} /></>)}
            <Row label="Total" value={gbp(pricing.total)} strong />
            <Row label={isBoard ? "Deposit due now" : "Deposit due now (25%)"} value={gbp(pricing.deposit)} strong accent />
          </div>
          <p className="muted center footnote">Your {gbp(pricing.deposit)} deposit secures the order — we&apos;ll be in touch by text or email to confirm and take payment. Balance due on delivery.</p>
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
