import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import { usePageTitle } from "../lib/title";

/** Designed 404 — in the art direction, with a route back to the boards. */
export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="app">
      <Header />
      <section className="nf">
        <p className="nf-code" aria-hidden="true">404</p>
        <h1 className="nf-h">That shelf&apos;s empty.</h1>
        <p className="muted nf-sub">
          Whatever was here has been eaten. The boards, thankfully, are all still where they should be.
        </p>
        <div className="nf-actions">
          <Link className="btn" to="/platters">Browse the boards</Link>
          <Link className="btn-ghost" to="/">Back to the deli</Link>
        </div>
      </section>
    </div>
  );
}
