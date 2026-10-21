import { Link } from "react-router-dom";
import { usePageTitle } from "../lib/title";

/** Each kind of customer gets a door back in — nobody leaves a 404 at a dead end. */
const DOORS: Array<{ to: string; title: string; line: string }> = [
  { to: "/christmas", title: "The Christmas menu", line: "Hams, turkey, party food and hampers, collected in December." },
  { to: "/platters", title: "Boards and platters", line: "Grazing and cheese boards for tonight or the weekend." },
  { to: "/plan", title: "Plan your event", line: "Give us a headcount and we’ll suggest the spread." },
  { to: "/bread", title: "Fresh bread", line: "Order loaves ahead and collect them from the shop." },
];

/** 404: plain words and a way back in for every kind of customer. */
export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="nf-page">
      <section className="nf wrap">
        <h1 className="nf-h">We can&apos;t find that page.</h1>
        <p className="nf-sub">
          The link may be out of date, or the page has moved. Everything we make is still here.
        </p>
        <ul className="nf-doors">
          {DOORS.map((d) => (
            <li key={d.to}>
              <Link className="nf-door" to={d.to}>
                <span className="nf-door-t">{d.title}</span>
                <span className="nf-door-l">{d.line}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="nf-actions">
          <Link className="btn btn-secondary nf-home" to="/">Back to the home page</Link>
        </p>
      </section>
    </div>
  );
}
