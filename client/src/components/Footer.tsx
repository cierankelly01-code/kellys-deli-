import { Link } from "react-router-dom";

/** Site-wide footer with the legal links required for a UK site handling personal data. */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span className="footer-brand">Kelly&apos;s Deli</span>
        <nav className="footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms &amp; Conditions</Link>
          <a href="mailto:hello@kellysdeli.co.uk">Contact</a>
        </nav>
        <span className="footer-copy">© {year} Kelly&apos;s Deli. All rights reserved.</span>
      </div>
    </footer>
  );
}
