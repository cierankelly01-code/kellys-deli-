import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/** Persistent bottom CTA — keeps the primary conversion action reachable while scrolling.
 * Hidden until the user scrolls past the hero, and hidden again near the page bottom so
 * it never covers the footer or the last row of buttons. */
export function StickyCta({ label, to, hideAfter = 500 }: { label: string; to: string; hideAfter?: number }) {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function onScroll() {
      const nearBottom = window.innerHeight + window.scrollY > document.body.scrollHeight - 320;
      setVisible(window.scrollY > hideAfter && !nearBottom);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [hideAfter]);

  if (!visible) return null;

  return (
    <div className="sticky-cta">
      <button className="btn" onClick={() => navigate(to)}>{label}</button>
    </div>
  );
}
