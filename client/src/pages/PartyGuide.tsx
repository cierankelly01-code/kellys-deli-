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

/**
 * "Hosting a party in Solihull?" — answers the question people actually ask ChatGPT
 * and Google, answer first, with the live menu as the evidence. Server renders the
 * same text into the HTML (server/src/lib/seo-pages.ts) for crawlers without JS.
 */
export default function PartyGuide() {
  usePageTitle(partyGuide.title, partyGuide.description, true);
  const [boards, setBoards] = useState<Platter[] | null>(null);
  useEffect(() => {
    api.platters().then((ps) => setBoards(ps.filter((p) => feeds(p)))).catch(() => setBoards([]));
  }, []);

  return (
    <div className="app app-wide party-guide">
      <Header />
      <header className="pg-hero" data-reveal>
        <p className="deli-eyebrow">Party food, Solihull &amp; Stratford-upon-Avon</p>
        <h1 className="pg-h1">{partyGuide.h1}</h1>
        <p className="pg-answer">{partyGuide.answer}</p>
        <div className="pg-actions">
          <Link className="btn" to="/shop/hosting">See party platters</Link>
          <Link className="btn-ghost" to="/plan">Tell us your headcount →</Link>
        </div>
      </header>

      {partyGuide.sections.map((s, i) => (
        <section key={s.h} className="pg-section" data-reveal>
          <h2 className="section-h">{s.h}</h2>
          <p>{s.p}</p>
          {i === 0 && (
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
            ) : null
          )}
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
