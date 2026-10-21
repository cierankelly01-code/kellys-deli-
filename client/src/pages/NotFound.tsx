import { Link } from "react-router-dom";
import { usePageTitle } from "../lib/title";
import { Crest, Ornament } from "../components/BrandMark";

/** Each kind of customer gets a door back in — nobody leaves a 404 at a dead end. */
const DOORS: Array<{ to: string; eyebrow: string; title: string; line: string }> = [
  { to: "/christmas", eyebrow: "Sort my Christmas", title: "The Christmas menu", line: "Hams, turkey, party food and hampers — collect in December." },
  { to: "/platters", eyebrow: "Something lovely", title: "Boards & platters", line: "Grazing and cheese boards for tonight or the weekend." },
  { to: "/plan", eyebrow: "Feeding a crowd", title: "Plan your event", line: "Give us a headcount and we’ll suggest the spread." },
  { to: "/bread", eyebrow: "Just a few bits", title: "Fresh bread", line: "Pre-order loaves and collect them from the shop." },
];

/** Designed 404 — in the art direction, with a route to every customer door. */
export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="nf-page">
      <section className="nf wrap">
        <Crest className="nf-crest" />
        <p className="nf-code" aria-hidden="true">404</p>
        <h1 className="nf-h">That shelf&apos;s empty.</h1>
        <Ornament />
        <p className="muted nf-sub">
          Whatever was here has been eaten. The boards, thankfully, are all still where they should be.
        </p>
        <ul className="nf-doors">
          {DOORS.map((d) => (
            <li key={d.to}>
              <Link className="nf-door" to={d.to}>
                <span className="nf-door-k">{d.eyebrow}</span>
                <span className="nf-door-t">{d.title}</span>
                <span className="nf-door-l">{d.line}</span>
                <span className="nf-door-go" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="nf-actions">
          <Link className="btn-ghost nf-home" to="/">Back to the deli</Link>
        </div>
      </section>
    </div>
  );
}
