import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type CategoryCounts, type Platter } from "../lib/api";
import { groupVariants } from "../lib/variants";
import { gbp } from "../lib/format";
import { usePageTitle } from "../lib/title";
import { StickyCta } from "../components/StickyCta";
import { Faq } from "../components/Faq";
import { DeadlineChip, Stars } from "../components/Trust";
import { Ticket } from "../components/site/Ticket";
import { morphNavigate } from "../lib/motion";
import { PageHero } from "../components/site/PageHero";
import { ProductCard, ticketUnit } from "../components/site/ProductCard";
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
  // The hero photo: the biggest signature board that has one (never a drawing).
  const heroBoard = useMemo(
    () => groups.map((g) => g.lead).filter((b) => b.imageUrl && b.tier === "signature").sort((a, b) => (b.fixedPrice ?? 0) - (a.fixedPrice ?? 0))[0] ?? null,
    [groups],
  );

  return (
    <div className="collection platters-page">
      <PageHero
        crumbs={[{ to: "/", label: "Home" }, { label: "Boards and platters" }]}
        title="Boards and platters"
        intro="Grazing boards for two and platters for twenty, made up by hand at the deli. We need 48 hours' notice, and a 25% deposit holds your date."
        imageUrl={heroBoard?.imageUrl}
        imageAlt={heroBoard?.name ?? ""}
        illustrative={!!heroBoard?.imageIllustrative}
      >
        <a className="btn" href="#signature">Shop the boards</a>
        <a className="btn btn-secondary" href="#size-guide">How many does it feed?</a>
      </PageHero>

      <ul className="cfacts wrap" aria-label="How ordering works">
        <li><DeadlineChip /></li>
        <li>A 25% deposit holds your date</li>
        {counts?.reviewRating ? <li className="cfacts-stars"><Stars rating={counts.reviewRating} count={counts.reviewCount} /></li> : <li>Pay the rest when you collect</li>}
      </ul>

      {boards !== null && groups.length > 0 && (
        <CollectionToolbar count={groups.length} sort={sort} onSort={setSort} />
      )}

      {boards === null && <p className="collection-loading wrap" role="status">Loading boards…</p>}

      {signature.length > 0 && (
        <section className="section" id="signature" aria-labelledby="signature-h">
          <div className="wrap">
            <SectionHead
              id="signature-h"
              title="Signature boards"
              intro="Our signature boards, in the sizes people ask for most."
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
              <h2 id="planner-band-h" className="planner-band-h">Feeding a crowd? Tell us how many.</h2>
              <p className="planner-band-copy">
                A party, a christening or the office do. The event planner starts from your headcount and suggests
                boards to feed everyone. Swap anything before you order.
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
            <SectionHead id="more-boards-h" title="More boards" intro="Something a little different, each one made to order." />
            <div className="pgrid gallery-grid">
              {gallery.map((g) => (
                <button
                  type="button"
                  key={g.lead.id}
                  className="gallery-card"
                  onClick={(e) => morphNavigate(navigate, `/platter/${g.lead.id}`, e.currentTarget.querySelector(".board-card-img") as HTMLElement | null)}
                >
                  <span className="gallery-card-photo">
                    <span className="gallery-card-media">
                      {g.lead.imageUrl ? (
                        <span
                          className="board-card-img"
                          style={{ backgroundImage: `url(${g.lead.imageUrl})` }}
                          role="img"
                          aria-label={g.lead.imageIllustrative ? `${g.lead.name} (illustrative photo)` : g.lead.name}
                        />
                      ) : (
                        <span className="board-card-img gallery-card-blank" role="img" aria-label={g.lead.name} />
                      )}
                      {g.lead.imageIllustrative && g.lead.imageUrl && <span className="illustrative-tag">Illustrative photo</span>}
                    </span>
                    <Ticket
                      from={g.hasChoice}
                      price={gbp(g.hasChoice ? g.fromPrice : g.lead.fixedPrice ?? g.lead.fromPrice ?? 0)}
                      unit={ticketUnit(g)}
                    />
                  </span>
                  <span className="gallery-card-body">
                    <span className="gallery-card-name">{g.lead.name}</span>
                    <span className="gallery-card-go">{g.hasChoice ? "Choose a size" : "See the board"}</span>
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
            <p>Please check back shortly, or tell us about your event and we&apos;ll suggest a spread.</p>
            <Link className="btn btn-secondary" to="/plan">Open the event planner</Link>
          </div>
        </section>
      )}

      {sizeRows.length > 0 && (
        <section className="section is-paper size-guide" id="size-guide" aria-labelledby="size-guide-h">
          <div className="wrap">
            <SectionHead
              id="size-guide-h"
              title="How many does each board feed?"
              intro="Every board and size, smallest gathering first. For a big number, mix and match, or let the planner do the sums."
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

      <div className="wrap collection-faq">
        <Faq />
      </div>

      <StickyCta label="Plan my event" to="/plan" />
    </div>
  );
}
