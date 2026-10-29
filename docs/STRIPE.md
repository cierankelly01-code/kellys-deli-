# Taking deposits online with Stripe

Board and platter orders take a 25% deposit. With Stripe switched on, the customer is sent to **Stripe Checkout** (Stripe's own secure payment page) straight after ordering. Stripe tells our server when they've paid, and the order shows "Deposit paid". Card details never touch our server.

With Stripe switched off (no keys set), nothing changes: the site says "we'll be in touch to take a 25% deposit", as now.

Bread, lunch and deli counter orders are pay-on-collection and never go to Stripe.

## How it works (for the next developer)
- `server/src/lib/payments.ts` is the only file that talks to Stripe.
- `POST /api/orders` saves the order first, then creates a Checkout Session for the deposit. The amount always comes from the server's own pricing. If Stripe is down, the order is still saved and the customer can pay later from the confirmation page.
- `POST /api/orders/:ref/deposit-checkout` lets the customer pay or retry from the confirmation page.
- `POST /api/payments/webhook` checks Stripe's signature and ignores test-mode events when live keys are set (and vice versa). On `checkout.session.completed` (or `async_payment_succeeded`) with `payment_status: "paid"`, it marks the deposit paid once and emails the customer and the shop. It only does this if the amount Stripe collected exactly matches what the order owes and the order isn't cancelled. On `charge.refunded` (full refund) it marks the deposit refunded.
- Anything odd emails the shop with **ACTION NEEDED**:
  - a wrong amount, a payment on a cancelled order, or a second payment on an already-paid order: nothing is changed;
  - a payment on an order already marked confirmed or collected: it's recorded as paid, and you're asked to check you didn't also take the deposit another way.
- A deposit paid online can't be set back to "pending" in admin: refund it in Stripe instead. Marking a deposit "paid" by hand closes any Stripe page the customer still has open.
- One order has at most one open payment page. Tapping "Pay" again reopens the same Stripe session, and an unused session expires after about 30 minutes. Cards only (Apple Pay and Google Pay included).
- Online payment is only offered while an order is **new** or **deposit requested**, unpaid and in the future. Orders marked confirmed, collected or cancelled, or marked paid in admin, are never asked to pay online.
- **Admin → Orders**: the deposit pill is a dropdown (pending / paid / refunded). Use it for deposits taken by phone or bank transfer, so the customer isn't asked to pay online.
- The FAQ payment answer, the confirmation page, the order SMS and emails, and the shop alert all switch wording automatically when Stripe is on. The Terms and Privacy pages are worded to be true either way.
- Online deposits switch on only when **both** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set.

## One-time setup (Cieran)

### 1. Create the account
1. Go to dashboard.stripe.com and register with the business email.
2. Fill in the business details (business type, bank account for payouts, ID check). Stripe walks you through it. Live payments stay off until this is done, but test mode works straight away.

### 2. Test mode first, while the site password is still on
Do this **while the "coming soon" password is still on**. With test keys in place, anyone who could reach the site would get a test payment page, where card 4242 marks a deposit "paid" for free. The password keeps real customers out while you test.

0. Before switching on: in **admin → Orders**, set the deposit to **paid** on any order whose deposit you've already taken by phone or bank. Orders marked confirmed or collected are never offered online payment anyway.
1. In the dashboard, turn on **Test mode** (toggle, top right).
2. **Developers → API keys**: copy the **Secret key**. It starts `sk_test_`.
3. **Developers → Webhooks → Add endpoint**:
   - Endpoint URL:
     ```
     https://www.kellysdeli.co.uk/api/payments/webhook
     ```
   - Events to send: `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`
   - Save, then copy the **Signing secret**. It starts `whsec_`.
4. In **Coolify → Kelly's Deli app → Environment Variables**, add:
   ```
   STRIPE_SECRET_KEY
   ```
   with your `sk_test_…` value,
   ```
   STRIPE_WEBHOOK_SECRET
   ```
   with your `whsec_…` value, and, **only while testing**:
   ```
   STRIPE_ALLOW_TEST_MODE
   ```
   with the value `1`. Then **Redeploy**. Without that last one, the live site refuses test keys on purpose, so nobody can "pay" with the test card. **Delete it again when you switch to live keys.**
5. Check it's on:
   ```
   curl -s https://www.kellysdeli.co.uk/api/payments/status
   ```
   It should say `{"enabled":true,"mode":"test"}` (and `"mode":"live"` once you've gone live, section 4).

Never paste these keys into chat, email or the code. They only go in Coolify (and your password manager).

### 3. Test a payment (still test mode, no real money)
1. Place a board order on the site.
2. You land on Stripe's page. Pay with card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
3. You come back to the confirmation page, which should say **"Deposit paid — you're booked in!"** within a few seconds.
4. In admin → Orders, the order shows the deposit as **paid**.
5. Also try: close Stripe's page without paying → the confirmation page offers **"Pay £X deposit"**.
6. **Tidy up:** in admin → Orders, set every test order to **Cancelled**. Otherwise they sit on the prep sheet and use up a collection slot.

### 4. Go live
1. Finish Stripe's business verification.
2. Turn **Test mode off**, then repeat steps 2.2–2.4 with the **live** keys (`sk_live_…` and a new live webhook signing secret) in Coolify. **Delete `STRIPE_ALLOW_TEST_MODE`.** Redeploy. Orders that opened a test-mode payment page simply get a fresh live one when the customer taps Pay.
3. Place one real small order, pay it, and refund it from the Stripe dashboard. That proves the whole path. Then set that order to **Cancelled** in admin.
4. Never leave `STRIPE_ALLOW_TEST_MODE` set once the site password is off: with test keys, anyone could "pay" with the test card.
4. Update `client/public/llms.txt`, "How ordering works" step 3, to "pay the 25% deposit online by card" (it's a static file, so it doesn't switch on its own).

### Optional: a tighter key
Instead of the full secret key, you can create a **restricted key** (Developers → API keys → Create restricted key) with **Checkout Sessions: Write**. If checkout then fails with a permission error in the server log, add the permission it names. This limits the damage if the key ever leaked.

## Refunds
Do them in the Stripe dashboard (Payments → the payment → Refund). Deposits are refundable up to 48 hours before collection. A **full** refund marks the order's deposit "refunded" automatically through the `charge.refunded` webhook. For a partial refund, or one done outside Stripe, set it yourself in admin → Orders.

## Testing locally (developers)
- Unit tests fake Stripe completely: `server/tests/payments.stripe.test.ts`. No keys, no network.
- To click through with real test keys on your own machine, set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `PUBLIC_URL=http://localhost:4010` in your terminal (without `PUBLIC_URL`, Stripe sends you back to the live site), start `node server/scripts/start-local-prod.mjs`, and forward webhooks with the Stripe CLI: `stripe listen --forward-to localhost:4010/api/payments/webhook`. The CLI prints the `whsec_` to use locally.
