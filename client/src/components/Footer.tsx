import { Link } from "react-router-dom";

/** Site footer — a designed destination, not an afterthought: giant wordmark,
 * useful links, contact, and the UK-required legal links. */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer grain">
      <div className="site-footer-inner">
        <p className="footer-word" aria-hidden="true">Kelly&apos;s Deli</p>

        <div className="footer-cols">
          <div className="footer-col">
            <p className="footer-col-h">Order</p>
            <Link className="u-link" to="/platters">Grazing boards</Link>
            <Link className="u-link" to="/plan">Plan an event</Link>
          </div>
          <div className="footer-col">
            <p className="footer-col-h">Collect from</p>
            <span>Bentley Heath — 1 Slater Road, Solihull B93 8AQ</span>
            <span>Henley-in-Arden</span>
            <span>Stratford-upon-Avon</span>
          </div>
          <div className="footer-col">
            <p className="footer-col-h">Get in touch</p>
            <a className="u-link" href="mailto:hello@kellysdeli.co.uk">hello@kellysdeli.co.uk</a>
            <Link className="u-link" to="/privacy">Privacy Policy</Link>
            <Link className="u-link" to="/terms">Terms &amp; Conditions</Link>
            <Link className="u-link" to="/admin">Staff login</Link>
          </div>
        </div>

        <p className="footer-copy">© {year} Kelly&apos;s Deli. Boards built by hand, same as always.</p>
      </div>
    </footer>
  );
}
