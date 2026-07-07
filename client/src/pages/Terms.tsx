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
        <p className="muted">Last updated: 7 July 2026</p>

        <p>
          These terms apply when you place an order with Kelly&apos;s Deli through this website. By
          placing an order you agree to them. Please read them alongside our{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>

        <h2>Placing an order</h2>
        <p>
          When you place an order you&apos;ll receive a confirmation with a reference number. This
          confirms we&apos;ve received your order; your order is accepted once we confirm we can fulfil
          it for your chosen date and location. We may not be able to accept an order if we&apos;re fully
          booked or an item is unavailable.
        </p>

        <h2>Notice period</h2>
        <p>
          Orders require at least 48 hours&apos; notice so we can prepare fresh. Some dates may be fully
          booked; availability is shown when you order.
        </p>

        <h2>Prices, deposits and payment</h2>
        <ul>
          <li>Prices are shown on the website and include VAT where applicable.</li>
          <li>A deposit is taken to secure your order; the balance is due on collection or delivery.</li>
          <li>Until online card payment is enabled, deposits and balances are arranged directly with us.</li>
        </ul>

        <h2>Changes, cancellations and refunds</h2>
        <p>
          Need to change or cancel? Contact us as soon as possible, quoting your order reference. Because
          our food is freshly prepared to order, we may be unable to refund a deposit if you cancel inside
          the 48-hour notice window. We&apos;ll always try to be fair and reasonable, and this does not
          affect your legal rights if something is wrong with your order.
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
