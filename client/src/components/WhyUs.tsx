import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { whyUs } from "../lib/seoContent";

/** The plain reasons to pick us, in the words the server also gives search engines. */
export function WhyUs({ heading = "Why Kelly’s Deli" }: { heading?: string }) {
  const [rating, setRating] = useState<{ rating: number; count: number } | null>(null);
  useEffect(() => {
    api
      .categories()
      .then((c) => {
        const r = parseFloat(c.reviewRating ?? "");
        const n = parseInt(String(c.reviewCount ?? ""), 10);
        if (Number.isFinite(r) && Number.isFinite(n) && n > 0) setRating({ rating: r, count: n });
      })
      .catch(() => {});
  }, []);
  if (!whyUs.length) return null;
  return (
    <section className="why-us" data-reveal aria-labelledby="why-us-h">
      <h2 id="why-us-h" className="section-h">{heading}</h2>
      {rating && (
        <p className="why-us-rating">
          Rated <strong>{rating.rating.toFixed(1)}</strong> out of 5 on Google from {rating.count} reviews.
        </p>
      )}
      <ol className="why-us-list">
        {whyUs.map((w) => (
          <li key={w.fact}>{w.fact}</li>
        ))}
      </ol>
    </section>
  );
}
