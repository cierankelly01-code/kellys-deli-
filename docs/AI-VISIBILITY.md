# Getting Kelly's Deli recommended by ChatGPT, Google and the rest

Written 29 Oct 2026. What the site now does, and what only the owner can do.

## Why ChatGPT couldn't say why it picked us (diagnosis, 29 Oct)
1. **Every page returned 401** to crawlers because of the "coming soon" password, including `robots.txt` and `llms.txt`.
2. **The site is a JavaScript app.** GPTBot, ClaudeBot and PerplexityBot don't run JavaScript, so even without the gate every URL looked like the same empty page.
3. **Thin evidence off the site.** The Google profile has reviews (4.7 from 47, as entered in Site Settings), but there's little else: no directory listings found, an FSA hygiene listing filed under "Bentley Barber Co, Slater Road", and other "Kelly's Delis" in Wales, Ireland and the US competing for the name.

## What the site now does (branch `feature/ai-seo`)
- The server writes each page's real content into the HTML: products, prices, what each board feeds, shops, hours and FAQs. Crawlers read it without JavaScript. People get the same HTML (not cloaking), and the app takes over once it loads.
- Each page has its own title, description, canonical URL and structured data: Product + Offer on board pages, LocalBusiness on shop pages, Article + FAQ on the party guide, breadcrumbs everywhere.
- New pages: `/bentley-heath`, `/stratford-upon-avon`, `/party-food-solihull`.
- `robots.txt` and `llms.txt` are readable even while the password is on. Unknown URLs return a real 404. Checkout and admin are `noindex`.
- The sitemap lists every board page with last-changed dates.
- The share image is a real counter photo, not Unsplash.
- `server/scripts/indexnow.mjs` pings Bing the moment pages change. ChatGPT search leans heavily on Bing's index.
- The homepage tiles are real links Google can follow, and the Google stars + review count show again (a CSS rule had been hiding them).

## Owner checklist (in order of impact)
| # | Do this | Why | Time |
|---|---|---|---|
| 1 | Take the site password off (admin → Site Settings → Coming soon → clear) | Nothing else works until crawlers can get in | 1 min |
| 2 | Google Business Profile: claim **both** shops at business.google.com. Same name, address and phone as the site. Category "Delicatessen", plus "Caterer". Add the website link per shop: `https://www.kellysdeli.co.uk/bentley-heath` and `/stratford-upon-avon` | Google AI answers and Maps pull from here first | 30 min |
| 3 | Ask every happy customer for a Google review; reply to every review | Review count and recency are the strongest local signal, and the "why" AI quotes | ongoing |
| 4 | Bing Places for Business (bingplaces.com): import from Google Business Profile | ChatGPT search uses Bing's data | 10 min |
| 5 | Apple Business Connect (businessconnect.apple.com) | Siri and Apple Maps | 10 min |
| 6 | Google Search Console + Bing Webmaster Tools: verify `kellysdeli.co.uk`, submit `https://www.kellysdeli.co.uk/sitemap.xml` | See what's indexed and what people search | 15 min |
| 7 | After the gate is off and each deploy: `node server/scripts/indexnow.mjs` | Bing re-crawls in minutes | 1 min |
| 8 | Ask the council to correct the FSA hygiene listing's business name (it says "Bentley Barber Co") | Name/address consistency | email |
| 9 | Listings with identical name/address/phone: Yell, Tripadvisor, Facebook page, Instagram bio, Stratford tourism (visitstratforduponavon), Solihull directories | AI cross-checks what other sites say | 1 hr |
| 10 | Get mentioned: local Facebook groups, Solihull/Knowle/Dorridge and Stratford "best deli / party food" round-ups, local press. Real customers only, never fake posts | Third-party mentions move AI answers more than anything on our own site | ongoing |
| 11 | Send 5–10 real facts for the "Why Kelly's Deli" list: year started, who makes the food, named suppliers, how many parties catered | Specific numbers are what AI quotes back. Add them to `server/src/content/seo-content.json` | 10 min |
| 12 | Sort out the Stratford phone number (missing on the site and in its business details) | NAP consistency | 1 min |

## Facts only the owner can confirm (copy is held back until then)
A claim-check on 29 Oct removed or softened every line we couldn't prove. To put any of these back, confirm it:
1. After a board order, how is the 25% deposit actually taken: a payment link, bank transfer, or a phone call? (Terms say "arranged directly with us"; the confirmation page says "secure payment link".)
2. Is the bread baked in-house? If yes, "fresh-baked" can go back on the Bread tile and pages.
3. Is Bentley Heath the original shop?
4. Is the Stratford address exactly 13 Wood Street, CV37 6JF? Is it really closed Sunday and Monday, and what's its phone number?
5. Is delivery offered for big events, and from which shop?
6. Which occasions can we name: christenings, hen dos, Christmas, wakes?
7. Which grocery lines are actually on sale (salads by the kilo, cheese, meats)?

## Bugs found while checking claims (not fixed on this branch)
- **Boards can be booked for Sundays and Mondays**, when both shops are shut. The board calendar checks notice and capacity but not closed days (bread and groceries do). Fix it, or confirm Sunday/Monday collection happens.
- **"Order for tomorrow"** (the live Lunch tile) can't happen: the 24h lead time is measured to midnight, so tomorrow is never bookable. This branch rewords the tile. Shortening the lead time is your call.
- The board calendar uses a hard-coded 48h, not the admin lead-time setting the order endpoint uses.

## Measure it monthly (first Monday)
Ask each in ChatGPT, Gemini, Perplexity and Google (AI Overview), in a fresh chat. Log whether we're named (mention), linked (citation), the position, and what reason it gives.
1. "I'm hosting a party in Solihull, where can I get party food or grazing boards?"
2. "Best deli near Knowle / Dorridge?"
3. "Grazing boards to order in Stratford-upon-Avon"
4. "Office catering near Solihull for a team lunch"
5. "Why would I choose Kelly's Deli?" (the answer should match the site's "Why Kelly's Deli" list)

Expect Google to move over 1–3 months once the gate is off. AI answers can move faster but swing around, so watch the trend, not one answer. Nobody can guarantee being first every time; the goal is named often, for the right reasons.
