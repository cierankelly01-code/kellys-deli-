import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Section title in the house style: a left-aligned headline, an optional line under it
 * and an optional link to the rest of the range. `eyebrow` is kept for the rare label that
 * carries information (sentence case, 14px); it is not decoration. `align` is accepted for
 * older callers and has no effect: every section head is left-aligned.
 */
export function SectionHead({
  eyebrow,
  title,
  intro,
  action,
  id,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  action?: { to: string; label: string };
  align?: "center" | "left";
  id?: string;
  as?: "h1" | "h2";
}) {
  return (
    <header className="section-head is-left">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Tag className="section-title" id={id}>{title}</Tag>
      {intro && <p className="section-intro">{intro}</p>}
      {action && <Link className="section-action" to={action.to}>{action.label}</Link>}
    </header>
  );
}
