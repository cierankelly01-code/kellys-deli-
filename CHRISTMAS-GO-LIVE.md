# Christmas go-live — what to do, in order

Plain-English checklist for the Christmas shop. Everything here is done from your phone
or laptop — no code.

## 1. Turn on card payments (10 minutes, once)

1. Log in to **Stripe** → Developers → API keys → copy the **Secret key** (`sk_live_…`).
2. Log in to **Coolify** → the Kelly's Deli app → **Environment Variables** → add
   `STRIPE_SECRET_KEY` = that key. Save and **Redeploy**.
3. Back in Stripe → Developers → **Webhooks** → Add endpoint:
   - URL: `https://www.kellysdeli.co.uk/api/payments/webhook`
   - Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   - Copy the **Signing secret** (`whsec_…`) into Coolify as `STRIPE_WEBHOOK_SECRET`, redeploy.
4. Test it: order the cheapest item on the site with your own card, check it shows as
   **paid** in admin → Orders, then refund yourself in Stripe.

Never paste these keys into a chat, an email or the code.

Until step 2 is done the site still takes orders — it just says "we'll send you a
payment link", like it does today.

## 2. Put the Christmas menu on sale (admin → Menu & Pricing → "Shop & Christmas")

18 Christmas items are already there **hidden**, with suggested prices. For each one:

- Check the **price** (the suggested ones are guesses — yours win).
- Fill in **Cost** so you can see your margin.
- **Supplier** + product code if you buy it in (this builds your supplier order list).
- Photo: upload your own, or paste the supplier's product link into **Fill from link**
  and press **Use this photo** (only if your supplier is fine with it). Tick
  "placeholder photo" if it isn't a photo of *your* product.
- Tick **Active** → it's on sale.

Adding something new from a supplier: **+ New** under "Shop & Christmas", paste the
supplier's product link, press **Fill from link**, set your price, Active, Save.

## 3. Daily, through December (admin, from your phone)

- **Today** (dashboard): how many collections today/tomorrow, new orders.
- **Supplier orders**: everything customers have paid for, grouped by supplier, with
  an "order by" date. Press **Copy order** and paste it into your supplier's email/WhatsApp.
- **Collect**: today's list. Search the name, check what they still owe, tap ✓ when
  they've collected.

## 4. If a day gets mobbed

Admin → Site Settings → **Most pre-order collections per shop per day**. Set a number;
once a day is full, the checkout stops offering it.

## 5. January

Admin → Site Settings → Website look → **Classic**. Christmas styling is gone, nothing to deploy.
