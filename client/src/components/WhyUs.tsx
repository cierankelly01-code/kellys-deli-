import { whyUs } from "../lib/seoContent";

/** The plain reasons to pick us, in the words the server also gives search engines. */
export function WhyUs({ heading = "Why Kelly’s Deli" }: { heading?: string }) {
  if (!whyUs.length) return null;
  return (
    <section className="why-us" data-reveal aria-labelledby="why-us-h">
      <h2 id="why-us-h" className="section-h">{heading}</h2>
      <ol className="why-us-list">
        {whyUs.map((w) => (
          <li key={w.fact}>{w.fact}</li>
        ))}
      </ol>
    </section>
  );
}
