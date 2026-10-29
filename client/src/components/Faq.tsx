import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { faq } from "../lib/seoContent";

// The questions live in server/src/content/seo-content.json so the server can put the
// same Q&A (and matching FAQPage schema) in the HTML that crawlers read. An answer's
// `aOnline` variant is used once online deposits (Stripe) are switched on — the server
// makes the same choice, so people and crawlers read the same thing.
type Item = { q: string; a: string; aOnline?: string };

export function Faq() {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    api.paymentsStatus().then((s) => setOnline(s.enabled)).catch(() => setOnline(false));
  }, []);
  return (
    <section className="faq">
      <h2 className="choice-h">Questions</h2>
      {(faq as Item[]).map((item) => (
        <details className="faq-item" key={item.q}>
          <summary>{item.q}</summary>
          <p>{online && item.aOnline ? item.aOnline : item.a}</p>
        </details>
      ))}
    </section>
  );
}
