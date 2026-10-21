export type FaqItem = { q: string; a: string };

/** The standing questions for boards and platters — shown wherever <Faq /> is used as is. */
export const DEFAULT_FAQ: FaqItem[] = [
  {
    q: "How much notice do you need?",
    a: "At least 48 hours before your collection date. The calendar on the order page only shows dates that work.",
  },
  {
    q: "How does payment work?",
    a: "A 25% deposit secures your order when you book — we'll be in touch by text or email to confirm. The balance is due on collection, nothing extra is charged automatically. Your deposit is fully refundable up to 48 hours before.",
  },
  {
    q: "Can you cater for allergies?",
    a: "Yes — there's a notes field on the order form for allergies or dietary requirements, and we'll confirm with you directly before your collection date.",
  },
  {
    q: "Can I change or cancel an order?",
    a: "Get in touch as soon as you can with your order reference and we'll sort it out — the earlier you let us know, the more flexible we can be.",
  },
];

/** Questions as a quiet accordion. Pages may pass their own list (e.g. the homepage adds a
 * Christmas question in season), a small-capital eyebrow and a different title. */
export function Faq({ questions = DEFAULT_FAQ, title = "Questions", eyebrow }: { questions?: FaqItem[]; title?: string; eyebrow?: string } = {}) {
  return (
    <section className="faq" aria-labelledby="faq-h">
      {eyebrow && <p className="eyebrow faq-eyebrow">{eyebrow}</p>}
      <h2 className="choice-h faq-title" id="faq-h">{title}</h2>
      {questions.map((item) => (
        <details className="faq-item" key={item.q}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </section>
  );
}
