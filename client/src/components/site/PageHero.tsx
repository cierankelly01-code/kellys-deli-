import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Ornament } from "../BrandMark";
import { ProductArt } from "../ProductArt";

export type Crumb = { to?: string; label: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((c, i) => (
          <li key={`${c.label}${i}`}>
            {c.to && i < items.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span aria-current={i === items.length - 1 ? "page" : undefined}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * The banner at the top of a collection or content page: breadcrumbs, eyebrow, serif
 * title, intro, optional actions, and an engraved illustration (or the owner's photo).
 */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  intro,
  children,
  art,
  imageUrl,
  tone = "ivory",
}: {
  crumbs?: Crumb[];
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode; // actions
  art?: string; // product name to illustrate, e.g. "Christmas Party Platter"
  imageUrl?: string | null;
  tone?: "ivory" | "green";
}) {
  const hasVisual = !!imageUrl || !!art;
  return (
    <section className={`page-hero is-${tone}${hasVisual ? " has-visual" : ""}`}>
      <div className="page-hero-copy">
        {crumbs && <Breadcrumbs items={crumbs} />}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-hero-title">{title}</h1>
        <Ornament />
        {intro && <p className="page-hero-intro">{intro}</p>}
        {children && <div className="page-hero-actions">{children}</div>}
      </div>
      {hasVisual && (
        <div className="page-hero-visual">
          {imageUrl ? <img src={imageUrl} alt="" /> : <ProductArt name={art!} className="page-hero-art" />}
        </div>
      )}
    </section>
  );
}
