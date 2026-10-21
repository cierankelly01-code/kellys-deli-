import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type CategoryCounts, type Platter } from "../lib/api";
import { groupVariants } from "../lib/variants";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { StickyCta } from "../components/StickyCta";
import { Faq } from "../components/Faq";
import { DeadlineChip, Stars } from "../components/Trust";
import { ProductArt } from "../components/ProductArt";
import { morphNavigate } from "../lib/motion";
import { PageHero } from "../components/site/PageHero";
import { ProductCard, priceLine } from "../components/site/ProductCard";
import { SectionHead } from "../components/site/SectionHead";
import { CollectionToolbar, useSort, sortGroups, maxFeeds } from "./ShopCategory";

/** "6–8" — tidy the hyphen in a serves range for display. */
const range = (s: string) => s.replace(/\s*-\s*/g, "–");

export default function Platters() {
  usePageTitle(
    "Boards & Platters",
    "Browse Kelly's Deli grazing and charcuterie boards — charcuterie, cheese, savoury and smoked salmon in small, medium and large. Collection from the deli in Solihull, 25% deposit, 48 hours' notice.",
  );
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Platter[] | null>(null);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [sort, setSort] = useSort();

  useEffect(() => {
    api.boards().then(setBoards).catch(() => setBoards([]));
    api.categories().then(setCounts).catch(() => setCounts(null));
  }, []);

  // Group first, then split by tier on the leading variant — otherwise a board whose sizes
  // sit in different tiers would appear twice.
  const groups = useMemo(() => groupVariants(boards ?? []), [boards]);
  const sorted = useMemo(() => sortGroups(groups, sort), [groups, sort]);
  const signature = sorted.filter((g) => g.lead.tier === "signature");
  const gallery = sorted.filter((g) => g.lead.tier !== "signature");

  // Size guide: every size of every board, smallest crowd first — the catering customer's
  // question is "what feeds 20?", not "what's on the cheese board?".
  const sizeRows = useMemo(
    () =>
      groups
        .flatMap((g) =>
          g.variants.map((v) => ({
            id: v.id,
            leadId: g.lead.id,
            name: g.lead.name,
            size: g.hasChoice ? (v.variantLabel ?? v.name).replace(/\s*[—-]\s*feeds.*$/i, "") : null,
            serves: v.serves,
            min: v.feedsMin ?? Number((v.serves ?? "").match(/\d+/)?.[0] ?? 0),
            max: v.feedsMax ?? maxFeeds({ ...g, variants: [v] }),
            price: v.fixedPrice ?? v.fromPrice ?? 0,
          })),
        )
        .filter((r) => r.serves)
        .sort((a, b) => a.min - b.min || a.max - b.max || a.price - b.price),
    [groups],
  );

  // ProductCard's photo carries alt text; give it the aria-label the image audit reads too.
  // (No-op for the engraved art, which is already labelled.)
  useEffect(() => {
    document
      .querySelectorAll<HTMLImageElement>(".platters-page img.board-card-img:not([aria-label])")
      .forEach((img) => img.setAttribute("aria-label", img.alt));
  }, [sorted]);

  const planMyEvent = () => navigate("/plan");

  return (
    <div className="collection platters-page">
      <PageHero
        crumbs={[{ to: "/", label: "Home" }, { label: "Boards & Platters" }]}
        eyebrow="The board counter"
        title="Boards & Platters"
        intro="Grazing boards for two, platters for twenty — built by hand at the deli on the day you collect. 48 hours' notice, and a 25% deposit holds your date."
        art="Charcuterie Board"
      >
        <a className="btn" href="#signature">Shop the boards</a>
        <a className="btn btn-secondary" href="#size-guide">How many does it feed?</a>
      </PageHero>

      <ul className="cfacts" aria-label="How ordering works">
        <li><DeadlineChip /></li>
        <li>25% deposit secures your date</li>
        {counts?.reviewRating ? <li className="cfacts-stars"><Stars rating={counts.reviewRating} count={counts.reviewCount} /></li> : <li>Balance paid on collection</li>}
      </ul>

      {boards !== null && groups.length > 0 && (
        <CollectionToolbar count={groups.length} sort={sort} onSort={setSort} />
      )}

      {boards === null && <div className="collection-loading" role="status">Loading boards…</div>}

      {signature.length > 0 && (
        <section className="section" id="signature" aria-labelledby="signature-h">
          <div className="wrap">
            <SectionHead
              id="signature-h"
              eyebrow="Made every day"
              title="Signature boards"
              intro="The boards we're known for, in the sizes people ask for most."
            />
            <div className="pgrid cgrid" data-n={signature.length}>
              {signature.map((g) => (
                <ProductCard key={g.lead.id} group={g} showDescription />
              ))}
            </div>
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section className="section is-green planner-band" aria-labelledby="planner-band-h">
          <div className="wrap planner-band-inner">
            <div>
              <p className="eyebrow">Feeding a crowd?</p>
              <h2 id="planner-band-h" className="planner-band-h">Tell us how many. We&apos;ll suggest the spread.</h2>
              <p className="planner-band-copy">
                Party, christening or the office do — the event planner starts from your headcount and builds the boards
                to feed everyone. Swap anything before you order.
              </p>
            </div>
            <div className="planner-band-cta">
              <button type="button" className="btn" onClick={planMyEvent}>Plan my event</button>
            </div>
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="section" aria-labelledby="more-boards-h">
          <div className="wrap">
            <SectionHead id="more-boards-h" eyebrow="From the counter" title="More boards" intro="Something a little different — each one made to order." />
            <div className="pgrid cgrid gallery-grid" data-n={gallery.length}>
              {gallery.map((g) => (
                <button
                  type="button"
                  key={g.lead.id}
                  className="gallery-card"
                  onClick={(e) => morphNavigate(navigate, `/platter/${g.lead.id}`, e.currentTarget.querySelector(".board-card-img") as HTMLElement | null)}
                >
                  <span className="gallery-card-media">
                    {g.lead.imageUrl ? (
                      <span
                        className="board-card-img"
                        style={{ backgroundImage: `url(${g.lead.imageUrl})` }}
                        role="img"
                        aria-label={g.lead.name}
                      />
                    ) : (
                      <ProductArt name={g.lead.name} section={g.lead.section} className="board-card-img" />
                    )}
                  </span>
                  <span className="gallery-card-body">
                    <span className="gallery-card-name">{g.lead.name}</span>
                    <span className="gallery-card-price">{priceLine(g)}</span>
                    <span className="gallery-card-go">{g.hasChoice ? `${g.variants.length} sizes` : "View the board"} <span aria-hidden="true">→</span></span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {boards !== null && boards.length === 0 && (
        <section className="section">
          <div className="wrap-narrow collection-empty">
            <h2>Our boards are being updated.</h2>
            <p>Please check back shortly — or tell us about your event and we&apos;ll suggest a spread.</p>
            <Link className="btn btn-secondary" to="/plan">Open the event planner</Link>
          </div>
        </section>
      )}

      {sizeRows.length > 0 && (
        <section className="section is-paper size-guide" id="size-guide" aria-labelledby="size-guide-h">
          <div className="wrap">
            <SectionHead
              id="size-guide-h"
              eyebrow="Size guide"
              title="How many does each board feed?"
              intro="Every board and size, smallest gathering first. For a big number, mix and match — or let the planner do the sums."
            />
            <table className="size-table">
              <caption className="visually-hidden">Every board and size by how many it feeds</caption>
              <thead>
                <tr>
                  <th scope="col">Feeds</th>
                  <th scope="col">Board</th>
                  <th scope="col" className="size-price">Price</th>
                </tr>
              </thead>
              <tbody>
                {sizeRows.map((r) => (
                  <tr key={r.id}>
                    <td className="size-feeds">{range(r.serves!)}</td>
                    <td className="size-name">
                      <Link to={`/platter/${r.leadId}`}>
                        {r.name}
                        {r.size && <small>{r.size}</small>}
                      </Link>
                    </td>
                    <td className="size-price">{gbp(r.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="size-guide-foot">
              <button type="button" className="btn btn-secondary" onClick={planMyEvent}>Plan my event by headcount</button>
            </div>
          </div>
        </section>
      )}

      <div className="wrap-narrow">
        <Faq />
      </div>

      <StickyCta label="Plan my event" to="/plan" />
    </div>
  );
}
