import { Header } from "../components/Header";

/**
 * Customer terms for ordering. Covers deposits, allergens (UK food law), collection/
 * delivery and cancellations. Standard plain-English terms, not formal legal advice.
 */
export default function Terms() {
  return (
    <div className="app">
      <Header />
      <article className="legal">
        <h1>Terms &amp; Conditions</h1>
        <p className="muted">Last updated: 29 October 2026</p>

        <p>
          These terms apply when you place an order with Kelly&apos;s Deli through this website. By
          placing an order you agree to them. Please read them alongside our{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>

        <h2>Placing an order</h2>
        <p>
          When you place an order you pay for it online, and once it&apos;s paid you&apos;ll receive a
          confirmation with a reference number. Your order is accepted once we confirm we can fulfil
          it for your chosen date and location. We may not be able to accept an order if we&apos;re fully
          booked or an item is unavailable.
        </p>

        <h2>Notice period</h2>
        <p>
          Orders require at least 48 hours&apos; notice so we can prepare fresh. Some dates may be fully
          booked; availability is shown when you order.
        </p>

        <h2>Prices and payment</h2>
        <ul>
          <li>Prices are shown on the website and include VAT where applicable.</li>
          <li>
            You pay for your order in full when you place it, by card through our payment provider, Stripe; we
            never see or store your card details. Your order is confirmed once it&apos;s paid.
          </li>
          <li>
            If online payment isn&apos;t available when you order a board or platter, we&apos;ll be in touch to
            arrange payment, and your date is confirmed once it&apos;s paid. For bread, lunch and deli counter orders,
            you pay when you collect. Your order page tells you which applies.
          </li>
          <li>Tasting sessions: a 25% deposit, taken by phone when we confirm your booking.</li>
          <li>Orders placed before 29 October 2026 keep the terms they were placed on (a deposit, with the balance paid on collection).</li>
        </ul>

        <h2>Changes, cancellations and refunds</h2>
        <p>
          Need to change or cancel? Contact us as soon as possible, quoting your order reference. If you cancel
          48 hours or more before collection, we&apos;ll refund you in full. Because our food is freshly prepared
          to order, we can&apos;t refund cancellations made less than 48 hours before collection. This does not
          affect your legal rights if something is wrong with your order.
        </p>
        <p>
          The usual 14-day right to cancel an online purchase doesn&apos;t apply to our food, because it&apos;s
          perishable and made to order (Consumer Contracts Regulations 2013, regulation 28). Our own refund rule
          above applies instead.
        </p>

        <h2>Collection and delivery</h2>
        <p>
          Please collect or be available to receive your order at the time and place selected. If a
          delivery can&apos;t be completed because no one is available, we may not be able to offer a
          refund for perishable food.
        </p>

        <h2>Allergens and food safety</h2>
        <p>
          Our food is prepared in a kitchen that handles allergens including cereals containing gluten,
          milk, eggs, nuts, peanuts, fish, soya, mustard, celery, sesame and sulphites. We cannot
          guarantee any item is completely free from a given allergen.
          <strong> If you or a guest has a food allergy or intolerance, please tell us before ordering</strong>{" "}
          so we can advise. Full allergen information for each product is available on request.
        </p>

        <h2>Our liability</h2>
        <p>
          We take great care with our food and service. We don&apos;t exclude any liability that can&apos;t
          be excluded by law (including for death or personal injury caused by our negligence, or for
          fraud). Otherwise, our liability for an order is limited to the price of that order.
        </p>

        <h2>Changes to these terms</h2>
        <p>We may update these terms from time to time. The version that applies to your order is the one on this page when you place it.</p>

        <h2>Governing law</h2>
        <p>These terms are governed by the law of England and Wales, and disputes are subject to its courts.</p>

        <h2>Contact</h2>
        <p>
          Questions about an order or these terms? Email{" "}
          <a href="mailto:hello@kellysdeli.co.uk">hello@kellysdeli.co.uk</a>.
        </p>
      </article>
      <div style={{ height: 8 }} />
    </div>
  );
}
