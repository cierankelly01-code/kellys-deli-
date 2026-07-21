import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  initTracking,
  acceptConsent,
  rejectConsent,
  dismissNotice,
  OPEN_CONSENT_EVENT,
  type TrackingState,
} from "../lib/consent";

/**
 * Cookie consent bar. Two modes, decided by what the owner has configured:
 *   • "consent" — one or more marketing/analytics pixels are set, so we ask before loading
 *     them (Accept / Reject, both equally easy — no dark patterns).
 *   • "notice"  — no such trackers, so there is nothing to consent to; we show a one-off
 *     honest "we don't track you" note instead.
 * Re-openable from the footer "Cookie settings" link so a choice can always be changed.
 */
export function ConsentBanner() {
  const [state, setState] = useState<TrackingState | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    initTracking()
      .then((s) => {
        if (!alive) return;
        setState(s);
        setVisible(s.show);
      })
      .catch(() => {
        // initTracking is written to never reject; guard anyway so a future change can't
        // leave an unhandled rejection or a silently-missing banner.
        if (alive) setState({ config: { metaPixelId: null, tiktokPixelId: null, ga4Id: null, cloudflareToken: null }, mode: "none", show: false });
      });

    // Footer "Cookie settings" re-opens the bar so a decision can be revisited.
    const reopen = () => setVisible(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => {
      alive = false;
      window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
    };
  }, []);

  if (!state || !visible) return null;

  if (state.mode === "notice") {
    return (
      <div className="consent-bar" role="region" aria-label="Cookie notice" aria-live="polite">
        <p className="consent-copy">
          We keep it simple — <strong>no tracking or advertising cookies</strong>, just what your basket needs.{" "}
          <Link to="/privacy" className="consent-link">
            Privacy Policy
          </Link>
        </p>
        <div className="consent-actions">
          <button
            className="btn consent-btn"
            onClick={() => {
              dismissNotice();
              setVisible(false);
            }}
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="consent-bar" role="region" aria-label="Cookie consent" aria-live="polite">
      <p className="consent-copy">
        We use cookies to measure our advertising and understand what our customers love, so we can make
        Kelly&apos;s Deli better. You choose.{" "}
        <Link to="/privacy" className="consent-link">
          How we use cookies
        </Link>
      </p>
      <div className="consent-actions">
        <button
          className="btn btn-secondary consent-btn"
          onClick={() => {
            rejectConsent();
            setVisible(false);
          }}
        >
          Reject
        </button>
        <button
          className="btn consent-btn"
          onClick={() => {
            acceptConsent(state.config);
            setVisible(false);
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
