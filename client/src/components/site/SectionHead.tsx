import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Ornament } from "../BrandMark";

/** Section title in the house style: small-capital eyebrow, serif title, gold rule. */
export function SectionHead({
  eyebrow,
  title,
  intro,
  action,
  align = "center",
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
    <header className={`section-head is-${align}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Tag className="section-title" id={id}>{title}</Tag>
      {align === "center" && <Ornament />}
      {intro && <p className="section-intro">{intro}</p>}
      {action && <Link className="section-action" to={action.to}>{action.label}</Link>}
    </header>
  );
}
