const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: "How much notice do you need?",
    a: "At least 48 hours before your delivery date. The calendar on the order page only shows dates that work.",
  },
  {
    q: "How does payment work?",
    a: "A £25 deposit secures your order when you book — we'll be in touch by text or email to confirm. The balance is due on delivery, nothing extra is charged automatically.",
  },
  {
    q: "Can you cater for allergies?",
    a: "Yes — there's a notes field on the order form for allergies or dietary requirements, and we'll confirm with you directly before your delivery date.",
  },
  {
    q: "Can I change or cancel an order?",
    a: "Get in touch as soon as you can with your order reference and we'll sort it out — the earlier you let us know, the more flexible we can be.",
  },
];

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
