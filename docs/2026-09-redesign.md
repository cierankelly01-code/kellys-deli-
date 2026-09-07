# Kelly’s Deli — navy storefront and conversion features

## Current state

The hosted visitor password was disabled through the authenticated settings API on 6 September 2026. A fresh request to the public homepage returned HTTP 200 without credentials. Staff authentication remains required.

The redesign and new features are local changes. Do not push this working tree wholesale: it already contained substantial bread preorder work before this redesign began. The existing main branch deployment triggers Coolify.

## Editing the storefront

- Brand colours and spacing: `client/src/styles/tokens.css`. Editorial layouts: `editorial.css`.
- Homepage uses the existing products, prices, categories, rating and hero image from admin.
- The homepage shows six signature product groups. Full selection remains under Boards & platters.
- Replace the existing temporary food imagery through Menu & Pricing / Site Settings. New photography should show the actual portions and contents being sold.
- Basket extras use active add-ons in admin sort order. The existing free-gift threshold remains available in Site Settings.

## Bundles

Admin → Bundles supports 0–50% discounts. New bundles are hidden by default. Choose real boards and extras, set the percentage, check the displayed price, and enable when ready.

The highest-saving complete bundle applies automatically, for each complete set of its components. Incomplete sets receive no bundle discount. Competing bundle discounts do not stack. Subscribe & Save is calculated after the bundle saving; a valid referral is then applied by the existing server pricing. All prices are recalculated on order submission. The applied bundle saving is recorded in order notes.

## Food videos

Admin → Site Settings → Shoppable food videos. Add up to six owned MP4/WebM HTTPS file URLs, poster images, titles, optional VTT captions, and a product association. Native video controls are customer-initiated; no autoplay or TikTok tracking scripts. These are short-form product videos, not embedded TikTok profile pages. An empty list renders no section. Product-linked videos also appear in the basket.

## Birthday / occasion reminders

Customers can request one reminder for an upcoming occasion, via email, SMS or both, 7/14/30 days before. Channel consents are separate and unchecked. The date must leave enough advance notice and be within two years. Each message has a cancellation link; opening that link does not cancel until the customer presses the confirmation button. Legacy email-only reminder enquiries are not automatically enrolled.

The worker runs every 15 minutes in the long-running Express server. It must be enabled in BOTH Site Settings (`remindersEnabled=on`) and server environment (`REMINDERS_ENABLED=on`). Configure:

- Email: `RESEND_API_KEY`, verified `EMAIL_FROM`.
- SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`. Configure the Messaging Service opt-out handling before enabling SMS.
- `PUBLIC_URL=https://www.kellysdeli.co.uk` and a stable, strong existing `JWT_SECRET` for cancellation signatures.

The signup form hides channels that cannot deliver. No real messages were sent during development. Integration checks mock the providers. API acceptance is recorded as `accepted`; that is not proof of delivery. Failed attempts and attempts left at `sending` require staff/provider review; there are no automatic retries after ambiguous provider responses. Monitor Admin → Enquiries for these states. This version is one upcoming date per signup, not an annual recurring birthday subscription.

## Database rollout

Two new Prisma migrations were tested against localhost only:

- `20260906120000_bundle_discount`
- `20260906121000_reminder_channels`

Apply additive migrations before deploying the code. Do not run reset/seed on the hosted database. Reminder data remains server-only with RLS enabled; no public policies were added. Confirm the runtime database role retains its existing server access.

## Verification and outstanding launch work

Frontend and server builds, pricing/reminder unit tests, integration tests and responsive browser checks are run during this task. See the final task report for results and limitations. The production email/SMS credentials, owned product photography and actual video/discount content are owner configuration. No fabricated reviews or made-up offers were added. The existing SPA still requires JavaScript for the shopping flow; server rendering is a separate architectural improvement.

Design references: Fortnum & Mason’s product-first merchandising; Section Store’s modular storefront approach; Shopify’s official bundle and complementary-product guidance. These informed native components; no paid Shopify plugin or Shopify migration is required.
