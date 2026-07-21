// Cookie consent + marketing/analytics loader.
//
// Compliance model (UK GDPR + PECR):
//   • Cookieless Cloudflare analytics may run for everyone (no cookies, exempt).
//   • Meta Pixel, TikTok Pixel and Google Analytics set cookies / share data with third
//     parties, so they load ONLY after the visitor clicks "Accept". No consent → nothing.
//   • Consent is withdrawable at any time (footer "Cookie settings" re-opens the banner).
//   • A Global Privacy Control signal is honoured as an opt-out.
//
// Everything a pixel needs is injected as an EXTERNAL <script src> from bundled ("self")
// code, so the site's Content-Security-Policy stays free of 'unsafe-inline'. The matching
// host allow-list lives in server/src/app.ts — keep the two in sync.

export interface TrackingConfig {
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  ga4Id: string | null;
  cloudflareToken: string | null;
}

const EMPTY_CONFIG: TrackingConfig = { metaPixelId: null, tiktokPixelId: null, ga4Id: null, cloudflareToken: null };

// Bump when the set of trackers or the privacy terms materially change — stored consent
// older than this version is treated as "unanswered" so returning visitors are re-asked.
const CONSENT_VERSION = 1;
// ICO guidance expects consent to be refreshed periodically; re-ask after six months.
const MAX_CONSENT_AGE_MS = 1000 * 60 * 60 * 24 * 182;
const CONSENT_KEY = "kd-consent";
const NOTICE_KEY = "kd-cookie-notice-dismissed";

/** Fired by the footer "Cookie settings" link to re-open the banner. */
export const OPEN_CONSENT_EVENT = "kd-open-consent";

type ConsentStatus = "granted" | "denied";
interface StoredConsent {
  status: ConsentStatus;
  version: number;
  ts: number;
}

// Format guards. IDs come from the (trusted, admin-only) settings API, but validating the
// shape means a typo can never inject anything odd into a script/URL/JSON context — a bad
// value simply doesn't load.
const ID_PATTERNS = {
  meta: /^\d{6,20}$/,
  tiktok: /^[A-Z0-9]{10,40}$/i,
  ga4: /^G-[A-Z0-9]{4,15}$/i,
  cloudflare: /^[a-f0-9]{16,64}$/i,
} as const;

// ---- Third-party globals (loosely typed on purpose — they are vendor stubs) ----
type VendorFn = (...args: unknown[]) => void;
interface Ttq {
  load?: (id: string) => void;
  page?: () => void;
  track?: (event: string, params?: Record<string, unknown>) => void;
  methods?: string[];
  [key: string]: unknown;
}
declare global {
  interface Window {
    fbq?: VendorFn & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: VendorFn };
    _fbq?: unknown;
    ttq?: Ttq;
    TiktokAnalyticsObject?: string;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// ---- Stored consent ----

function readConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== CONSENT_VERSION) return null; // re-ask after a version bump
    if (parsed.status !== "granted" && parsed.status !== "denied") return null;
    if (typeof parsed.ts !== "number" || Date.now() - parsed.ts > MAX_CONSENT_AGE_MS) return null; // expired — re-ask
    return parsed;
  } catch {
    return null;
  }
}

function writeConsent(status: ConsentStatus): void {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ status, version: CONSENT_VERSION, ts: Date.now() }));
  } catch {
    /* private-mode / storage full — non-fatal */
  }
}

/** Browser-level opt-out signal (Global Privacy Control). */
function hasGlobalOptOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true;
}

// ---- Config fetch (cached for the page lifetime) ----

let configPromise: Promise<TrackingConfig> | null = null;
export function fetchTrackingConfig(): Promise<TrackingConfig> {
  if (!configPromise) {
    const base = import.meta.env.VITE_API_URL || "";
    configPromise = fetch(`${base}/api/tracking`)
      .then((r) => (r.ok ? (r.json() as Promise<TrackingConfig>) : EMPTY_CONFIG))
      .then((c) => ({ ...EMPTY_CONFIG, ...c }))
      .catch(() => EMPTY_CONFIG); // never let analytics config break the app
  }
  return configPromise;
}

/** Any tracker that legally requires consent before loading? */
export function needsConsent(cfg: TrackingConfig): boolean {
  return Boolean(
    (cfg.metaPixelId && ID_PATTERNS.meta.test(cfg.metaPixelId)) ||
      (cfg.tiktokPixelId && ID_PATTERNS.tiktok.test(cfg.tiktokPixelId)) ||
      (cfg.ga4Id && ID_PATTERNS.ga4.test(cfg.ga4Id)),
  );
}

/** Shape-check a single tracking ID — used by the admin UI to reject typos before saving. */
export function isValidTrackingId(kind: keyof typeof ID_PATTERNS, value: string): boolean {
  return ID_PATTERNS[kind].test(value.trim());
}

// ---- Injectors (idempotent, CSP-safe: external scripts only, no inline) ----

function appendScript(src: string, attrs: Record<string, string> = {}): HTMLScriptElement {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
  return s;
}

function loadMeta(id: string): void {
  if (window.fbq || !ID_PATTERNS.meta.test(id)) return;
  const fbq = function (this: unknown, ...args: unknown[]) {
    const f = fbq as typeof fbq & { callMethod?: VendorFn; queue: unknown[] };
    f.callMethod ? f.callMethod.apply(f, args) : f.queue.push(args);
  } as VendorFn & { queue: unknown[]; loaded: boolean; version: string; push: VendorFn };
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.push = fbq;
  window.fbq = fbq;
  window._fbq = window._fbq || fbq;
  appendScript("https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", id);
}

function loadTikTok(id: string): void {
  if (window.ttq || !ID_PATTERNS.tiktok.test(id)) return;
  const t = "ttq";
  window.TiktokAnalyticsObject = t;
  const ttq: Ttq & { _i?: Record<string, unknown>; setAndDefer?: (obj: Record<string, unknown>, m: string) => void } =
    (window.ttq = window.ttq || ({} as Ttq));
  ttq.methods = [
    "page", "track", "identify", "instances", "debug", "on", "off", "once", "ready",
    "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent",
  ];
  ttq.setAndDefer = function (obj: Record<string, unknown>, method: string) {
    obj[method] = function (...args: unknown[]) {
      (ttq as unknown as { push: (a: unknown[]) => void }).push([method, ...args]);
    };
  };
  (ttq as unknown as { push?: (a: unknown[]) => void }).push =
    (ttq as unknown as { push?: (a: unknown[]) => void }).push || Array.prototype.push.bind(ttq as unknown as unknown[]);
  for (const m of ttq.methods) ttq.setAndDefer(ttq as unknown as Record<string, unknown>, m);
  ttq.load = function (pixelId: string) {
    appendScript(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(pixelId)}&lib=${t}`);
  };
  ttq.load(id);
}

function loadGA4(id: string): void {
  if (window.gtag || !ID_PATTERNS.ga4.test(id)) return;
  window.dataLayer = window.dataLayer || [];
  const gtag: (...args: unknown[]) => void = function (...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag;
  gtag("js", new Date());
  // Suppress gtag's automatic initial page_view — trackPageView() is our single source of
  // page views, so this avoids double-counting the landing page on the Accept path.
  gtag("config", id, { anonymize_ip: true, send_page_view: false });
  appendScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
}

let cloudflareLoaded = false;
function loadCloudflare(token: string): void {
  if (cloudflareLoaded || !ID_PATTERNS.cloudflare.test(token)) return;
  cloudflareLoaded = true;
  appendScript("https://static.cloudflareinsights.com/beacon.min.js", {
    "data-cf-beacon": JSON.stringify({ token, spa: true }),
  });
}

// True once the visitor has granted consent this session. Event helpers check it so that
// after a withdrawal (before the tear-down reload completes) nothing further is sent.
let consentGranted = false;

let consentedLoaded = false;
function loadConsentedTrackers(cfg: TrackingConfig): void {
  if (consentedLoaded) return;
  consentedLoaded = true;
  if (cfg.metaPixelId) loadMeta(cfg.metaPixelId);
  if (cfg.tiktokPixelId) loadTikTok(cfg.tiktokPixelId);
  if (cfg.ga4Id) loadGA4(cfg.ga4Id);
}

// ---- Public API used by the UI ----

export type BannerMode = "consent" | "notice" | "none";
export interface TrackingState {
  config: TrackingConfig;
  mode: BannerMode;
  /** Whether the banner/notice should be shown to this visitor right now. */
  show: boolean;
}

/**
 * Called once when the app mounts. Loads cookieless analytics for everyone, applies any
 * previously-stored consent, and reports whether a banner should be shown.
 */
export async function initTracking(): Promise<TrackingState> {
  const config = await fetchTrackingConfig();

  if (config.cloudflareToken) loadCloudflare(config.cloudflareToken);

  if (!needsConsent(config)) {
    // Nothing that needs consent — show the honest, one-off "we don't track you" notice.
    const dismissed = safeGet(NOTICE_KEY) === "1";
    return { config, mode: "notice", show: !dismissed };
  }

  // A live Global Privacy Control signal is a standing opt-out — honour it even over a
  // previously-stored "granted".
  if (hasGlobalOptOut()) {
    if (readConsent()?.status !== "denied") writeConsent("denied");
    return { config, mode: "consent", show: false };
  }

  const stored = readConsent();
  if (stored?.status === "granted") {
    consentGranted = true;
    loadConsentedTrackers(config);
    // Record the entry page. The layout's mount effect fired trackPageView before these
    // stubs existed (async fetch), so without this a returning visitor's landing page is
    // uncounted on Meta/TikTok (and on GA4, which has its auto page_view disabled).
    trackPageView(window.location.pathname);
    return { config, mode: "consent", show: false };
  }
  if (stored?.status === "denied") {
    return { config, mode: "consent", show: false };
  }
  return { config, mode: "consent", show: true };
}

/** Visitor accepted — persist and fire up the pixels + a first page view. */
export function acceptConsent(cfg: TrackingConfig): void {
  writeConsent("granted");
  consentGranted = true;
  loadConsentedTrackers(cfg);
  trackPageView(window.location.pathname);
}

/** Visitor declined — persist and stop tracking. */
export function rejectConsent(): void {
  writeConsent("denied");
  consentGranted = false;
  // If pixels already loaded this session, a reload is the only reliable way to fully tear
  // down the vendor SDKs (some, e.g. GA4 enhanced measurement, keep tracking on their own).
  // On the next load, stored "denied" means nothing re-initialises.
  if (consentedLoaded) window.location.reload();
}

/** Dismiss the informational (no-tracking) notice. */
export function dismissNotice(): void {
  safeSet(NOTICE_KEY, "1");
}

function safeGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function safeSet(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* non-fatal */ }
}

// ---- Event helpers (safe no-ops until the relevant tracker is loaded) ----

/** SPA page view. Called on every route change; no-ops until consent is granted. */
export function trackPageView(path?: string): void {
  if (!consentGranted) return;
  window.fbq?.("track", "PageView");
  window.ttq?.page?.();
  window.gtag?.("event", "page_view", path ? { page_path: path } : {});
}

/**
 * The site's key conversion: a placed order request. Payment happens off-site (card
 * machine / payment link), so this "Lead"-type event is the strongest on-site signal
 * and what ad platforms should optimise toward.
 */
export function trackOrderRequest(opts: { value?: number; ref?: string }): void {
  if (!consentGranted) return;
  const { value, ref } = opts;
  const currency = "GBP";
  window.fbq?.("track", "Lead", { value, currency, content_name: ref });
  window.ttq?.track?.("SubmitForm", { value, currency });
  window.gtag?.("event", "generate_lead", { value, currency, transaction_id: ref });
}

/** A product/board was viewed. */
export function trackViewContent(opts: { id: string; name: string; value?: number }): void {
  if (!consentGranted) return;
  const { id, name, value } = opts;
  const currency = "GBP";
  window.fbq?.("track", "ViewContent", { content_ids: [id], content_name: name, value, currency });
  window.ttq?.track?.("ViewContent", { content_id: id, content_name: name, value, currency });
  window.gtag?.("event", "view_item", { currency, value, items: [{ item_id: id, item_name: name }] });
}
