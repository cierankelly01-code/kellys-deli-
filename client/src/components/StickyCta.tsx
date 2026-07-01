import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/** Persistent bottom CTA — keeps the primary conversion action reachable while scrolling,
 * hidden until the user scrolls past the hero so it doesn't duplicate the hero button. */
export function StickyCta({ label, to, hideAfter = 500 }: { label: string; to: string; hideAfter?: number }) {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > hideAfter);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hideAfter]);

  if (!visible) return null;

  return (
    <div className="sticky-cta">
      <button className="btn" onClick={() => navigate(to)}>{label}</button>
    </div>
  );
}
