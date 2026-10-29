import { faq } from "../lib/seoContent";

// The questions live in server/src/content/seo-content.json so the server can put the
// same Q&A (and matching FAQPage schema) in the HTML that crawlers read.
const QUESTIONS: Array<{ q: string; a: string }> = faq;

export function Faq() {
  return (
    <section className="faq">
      <h2 className="choice-h">Questions</h2>
      {QUESTIONS.map((item) => (
        <details className="faq-item" key={item.q}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </section>
  );
}
