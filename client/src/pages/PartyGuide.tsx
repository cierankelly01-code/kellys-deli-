import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Platter } from "../lib/api";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { partyGuide } from "../lib/seoContent";
import { Header } from "../components/Header";
import { WhyUs } from "../components/WhyUs";
import { StickyCta } from "../components/StickyCta";

const feeds = (p: Platter) => p.serves || (p.feedsMin && p.feedsMax ? `${p.feedsMin}–${p.feedsMax}` : p.feedsMin ? `${p.feedsMin}+` : null);
type GuideRow = Awaited<ReturnType<typeof api.headcountGuide>>[number];
type Section = { h: string; p: string; table?: string };

/**
 * "Hosting a party in Solihull?" — answers the questions people actually ask ChatGPT
 * and Google (how much food for 20, friends round this weekend, Sunday parties, prices,
 * deposits), answer first, with the live menu as the evidence. The server renders the
 * same text and tables into the HTML (server/src/lib/seo-pages.ts) for crawlers without JS.
 */
export default function PartyGuide() {
  usePageTitle(partyGuide.title, partyGuide.description, true);
  const [boards, setBoards] = useState<Platter[] | null>(null);
  const [guide, setGuide] = useState<GuideRow[] | null>(null);
  useEffect(() => {
    api.platters().then((ps) => setBoards(ps.filter((p) => feeds(p)))).catch(() => setBoards([]));
    api.headcountGuide().then(setGuide).catch(() => setGuide([]));
  }, []);

  const headcountTable =
    guide === null ? (
      <p className="muted" role="status">Working out the menu…</p>
    ) : guide.length > 0 ? (
      <div className="pg-table-wrap">
        <table className="pg-table">
          <caption className="sr-only">Suggested boards and prices by number of guests</caption>
          <thead><tr><th scope="col">Guests</th><th scope="col">Suggested boards</th><th scope="col">Feeds</th><th scope="col">Price</th></tr></thead>
          <tbody>
            {guide.map((r) => (
              <tr key={r.headcount}>
                <th scope="row" className="num">{r.headcount}</th>
                <td>
                  {r.boards.map((b, i) => (
                    <span key={b.id}>
                      {i > 0 && " + "}
                      {b.qty > 1 && `${b.qty} × `}
                      <Link to={`/platter/${b.id}`}>{b.name}</Link>
                    </span>
                  ))}
                </td>
                <td className="num">up to {r.feeds}</td>
                <td className="num">{gbp(r.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null;

  const boardTable =
    boards === null ? (
      <p className="muted" role="status">Loading the menu…</p>
    ) : boards.length > 0 ? (
      <div className="pg-table-wrap">
        <table className="pg-table">
          <caption className="sr-only">Boards, how many they feed and what they cost</caption>
          <thead><tr><th scope="col">Board</th><th scope="col">Feeds</th><th scope="col">Price</th></tr></thead>
          <tbody>
            {boards.map((p) => (
              <tr key={p.id}>
                <th scope="row"><Link to={`/platter/${p.id}`}>{p.name}</Link></th>
                <td className="num">{feeds(p)}</td>
                <td className="num">{p.isFixed ? gbp(p.fixedPrice ?? 0) : p.pricePerHead != null ? `${gbp(p.pricePerHead)} per person` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null;

  return (
    <div className="app app-wide party-guide">
      <Header />
      <header className="pg-hero" data-reveal>
        <p className="deli-eyebrow">Party food, Solihull &amp; Stratford-upon-Avon</p>
        <h1 className="pg-h1">{partyGuide.h1}</h1>
        <p className="pg-answer">{partyGuide.answer}</p>
        <p className="muted small">Updated {partyGuide.updated}. Prices and sizes are live from our menu.</p>
        <div className="pg-actions">
          <Link className="btn" to="/shop/hosting">See party platters</Link>
          <Link className="btn-ghost" to="/plan">Tell us your headcount →</Link>
        </div>
      </header>

      {(partyGuide.sections as Section[]).map((s) => (
        <section key={s.h} className="pg-section" data-reveal>
          <h2 className="section-h">{s.h}</h2>
          <p>{s.p}</p>
          {s.table === "headcount" && headcountTable}
          {s.table === "boards" && boardTable}
        </section>
      ))}

      <section className="pg-section" data-reveal>
        <h2 className="section-h">Occasions we cater for</h2>
        <ul className="pg-occasions">
          {partyGuide.occasions.map((o) => <li key={o}>{o}</li>)}
        </ul>
      </section>

      <WhyUs />

      <p className="pg-links">
        Collect from <Link className="u-link" to="/bentley-heath">Bentley Heath, Solihull</Link> or{" "}
        <Link className="u-link" to="/stratford-upon-avon">Stratford-upon-Avon</Link>. Feeding the office instead?{" "}
        <Link className="u-link" to="/office-catering">Office catering</Link>.
      </p>
      <StickyCta label="See party platters" to="/shop/hosting" />
    </div>
  );
}
