import type { ReactNode } from "react";
import { Link } from "react-router-dom";

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
 * The banner at the top of a collection or content page: breadcrumbs, the headline, an
 * intro and optional actions, beside the owner's photo when there is one. No photo: the
 * hero is type only (never a drawing). `eyebrow` is for a label that carries information.
 */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  intro,
  children,
  imageUrl,
  imageAlt = "",
  illustrative = false,
  tone = "paper",
}: {
  crumbs?: Crumb[];
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode; // actions
  imageUrl?: string | null;
  imageAlt?: string;
  illustrative?: boolean; // AI or stock photo: say so until the owner's own replaces it
  tone?: "paper" | "green";
}) {
  return (
    <section className={`page-hero is-${tone}${imageUrl ? " has-visual" : ""}`}>
      <div className="page-hero-copy">
        {crumbs && <Breadcrumbs items={crumbs} />}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-hero-title">{title}</h1>
        {intro && <p className="page-hero-intro">{intro}</p>}
        {children && <div className="page-hero-actions">{children}</div>}
      </div>
      {imageUrl && (
        <div className="page-hero-visual">
          <img src={imageUrl} alt={imageAlt} />
          {illustrative && <span className="illustrative-tag">Illustrative photo</span>}
        </div>
      )}
    </section>
  );
}
