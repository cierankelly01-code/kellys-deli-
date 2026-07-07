import { Header } from "../components/Header";

/**
 * UK GDPR / Data Protection Act 2018 privacy notice. Plain-English, email-contact
 * based (no postal address needed). Update the contact email + add an ICO registration
 * reference once registered. This is a solid standard notice, not formal legal advice.
 */
export default function Privacy() {
  return (
    <div className="app">
      <Header />
      <article className="legal">
        <h1>Privacy Policy</h1>
        <p className="muted">Last updated: 7 July 2026</p>

        <p>
          This policy explains what personal information Kelly&apos;s Deli (&quot;we&quot;, &quot;us&quot;)
          collects when you order from us or use this website, how we use it, and your rights under
          UK data protection law (the UK GDPR and the Data Protection Act 2018). Kelly&apos;s Deli is
          the &quot;data controller&quot; for this information.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>Your name, phone number and email address.</li>
          <li>Order details — what you ordered, the collection or delivery date, and any notes or requests you add.</li>
          <li>For gift orders: the recipient&apos;s name, delivery address and any gift message.</li>
          <li>A referral code if you use or share one.</li>
        </ul>
        <p>We do not collect or store card or payment-card details on this website.</p>

        <h2>Why we use it, and our legal basis</h2>
        <ul>
          <li><strong>To take and fulfil your order</strong> (our contract with you) — we can&apos;t prepare or deliver your order without it.</li>
          <li><strong>To contact you about your order</strong> — confirmations and updates by email or phone (our contract with you).</li>
          <li><strong>To run and improve the business</strong> — basic order statistics (our legitimate interest in running the deli well).</li>
          <li><strong>Marketing messages</strong> — only if you have opted in, and you can opt out at any time (your consent).</li>
        </ul>

        <h2>Who we share it with</h2>
        <p>We never sell your data. We share it only with the trusted service providers that run this site, acting on our instructions:</p>
        <ul>
          <li>Our website and database hosting providers (which store your order securely).</li>
          <li>Our email provider, to send you order confirmations.</li>
          <li>If and when card payments go live, a regulated payment provider (such as Stripe) — they handle card details directly; we never see your full card number.</li>
        </ul>
        <p>We may also disclose information if the law requires us to.</p>

        <h2>Cookies and analytics</h2>
        <p>
          We use privacy-friendly, cookieless website analytics to count visits and see which pages are
          popular. It does not use tracking cookies, does not identify you, and does not follow you
          across other websites — so this site does not need a cookie consent banner. We do not use
          advertising cookies.
        </p>

        <h2>How long we keep it</h2>
        <p>
          We keep order information for as long as needed to run the business and to meet our legal and
          accounting obligations (generally up to 6 years for financial records), then delete it. You can
          ask us to delete your details sooner where we&apos;re not required to keep them.
        </p>

        <h2>Your rights</h2>
        <p>Under UK data protection law you have the right to:</p>
        <ul>
          <li>ask for a copy of the personal data we hold about you;</li>
          <li>ask us to correct anything that&apos;s wrong;</li>
          <li>ask us to delete your data (where we&apos;re not legally required to keep it);</li>
          <li>object to, or ask us to restrict, certain uses of your data;</li>
          <li>withdraw consent to marketing at any time.</li>
        </ul>
        <p>
          To exercise any of these, email us at <a href="mailto:hello@kellysdeli.co.uk">hello@kellysdeli.co.uk</a>.
        </p>

        <h2>Keeping your data safe</h2>
        <p>
          Your information is stored on secure, access-controlled systems and transmitted over encrypted
          (HTTPS) connections. Access is limited to staff who need it to run your order.
        </p>

        <h2>Children</h2>
        <p>This website and our ordering service are intended for adults. We do not knowingly collect data from children.</p>

        <h2>Changes to this policy</h2>
        <p>We may update this policy from time to time. The latest version will always be on this page with the date it was last changed.</p>

        <h2>Contact and complaints</h2>
        <p>
          Questions about your data? Email <a href="mailto:hello@kellysdeli.co.uk">hello@kellysdeli.co.uk</a>.
          If you&apos;re not happy with how we&apos;ve handled your data, you can complain to the UK&apos;s
          Information Commissioner&apos;s Office (ICO) at{" "}
          <a href="https://ico.org.uk" target="_blank" rel="noreferrer">ico.org.uk</a>.
        </p>
      </article>
      <div style={{ height: 8 }} />
    </div>
  );
}
