# Kelly’s Deli — storefront design plan

Live audit: 11 September 2026 · Plan completed: 12 September 2026 · Mobile first

This is a design and UX handover for the owner and the engineer implementing the existing React/Express shop. Only this document was created. No source changes, installs, builds, tests, migrations, seeds, direct database access or form submissions were performed.

## 1. Summary

- **Restore the route to actual food first.** During the live audit, the home page, Office category, Party category and all-boards page displayed no purchasable boards. Category tiles nevertheless advertised 24 or 28 boards. Both shopping journeys stopped here.
- **Make “Office catering” a main destination.** Add `/office-catering`, link it from the main menu and the second home-page section, and clearly separate standard platters for collection from enquiries about delivery, quantities and regular orders.
- **Keep the existing categories and product grouping.** Preserve `/shop` → `/shop/:slug` → `/platter/:id`. Show one product card per `variantGroup`, with honest price/portion information and sizes chosen on the product page.
- **Make ordering reassuring and readable.** Use larger text, clear collection information, labelled size choices, one relevant mobile action and consistent wording about an order request followed by a deposit link.
- **Refine the existing brand.** Keep navy, warm cream, Fraunces and Mulish. Replace generic imagery with Kelly’s actual food; shorten the home page and move optional promotions away from essential decisions.

## 2. Audit findings

### What was inspected, and what could not be completed

The public [Kelly’s Deli site](https://www.kellysdeli.co.uk/) was inspected in Chrome using CSS viewport sizes **375 × 812**, then **390 × 844**, followed by **768 × 1024** and **1440 × 1000**. Phone work included navigation, home, shop, Office and Party categories, the all-boards fallback, empty basket and empty checkout; bread and the event-planner entry were also inspected. Tablet and desktop checks concentrated on home/navigation and Office catering. These were browser walkthroughs and visual/DOM inspections, not physical iPhone tests or automated test-suite runs.

| Intended journey at 375px | What happened live |
| --- | --- |
| Office manager: home → office catering → board → size → basket → checkout | Opened Menu: no office link. Followed “Shop the deli” → fourth category, “Office & Corporate” → `/shop/office-corporate`. No boards appeared. “See all boards” → `/platters` also showed an empty selection. The enquiry form was available, but no product could be selected. |
| Birthday customer: home → Party → board → size → basket → checkout | Followed the home-page Party card → `/shop/hosting`. Despite the “28 boards” count, no boards appeared. The all-boards route was also unavailable. A subsequent inspection at 390px found an empty basket and, after loading, “Your order is empty” at `/order`. |

**Neither full purchase journey could be completed.** No live product ID was exposed by these catalogue paths, so size selection, a populated basket, collection selection, review and confirmation were assessed from source only. No fabricated cart, synthetic product or production enquiry was used to bypass the problem. The implementation must revisit these stages with available products; this document does not claim that they passed.

“Live” below means observed browser behaviour. “Source” means an implementation finding that still needs browser verification. A source defect consistent with the live symptom is not proof of its production root cause. The earlier `docs/2026-09-redesign.md` describes local work and outstanding rollout/content work; it is not a reliable inventory of everything currently deployed. Findings are dated observations, not a claim that the catalogue remains in that state indefinitely.

Severity: **blocker** prevents the task; **major** makes a consequential decision difficult or misleading; **minor** adds avoidable effort.

| Route/page | Device/evidence | Specific problem | Severity |
| --- | --- | --- | --- |
| `/`, `/shop/office-corporate`, `/shop/hosting`, `/platters` | Live, 375px; Office/home also rechecked at larger widths | Featured boards and both occasion lists are empty. The fallback also has no boards. Customers cannot reach a product, choose a size or order. | **Blocker** |
| `/shop` and home category cards | Live, 375/390px; source | Office advertises “24 boards” and Party “28 boards”, but those pages contain none. Source counts assignment rows, including inactive products and separate variants, while the display groups active products. | **Major** |
| Header and footer | Live, phone/tablet/desktop | No Office catering link. “Shop the deli” and “Boards & platters” lead to different browse pages without explaining the difference. | **Major** |
| `/` | Live, 375/390px; source | Office is the fourth occasion choice, below featured products. On phones the home occasion shelf scrolls horizontally, making the office destination easy to miss. | **Major** |
| `/` hero | Live, 375/390px | Long text precedes the food. At 390px the photo begins about 625px down the page. Measured intro is 14.4px, primary button text 11.52px and collection note 11.2px: too small for the intended reading conditions. | **Major** |
| Header | Live, 768px | Navigation labels measure 10.88px even though their targets are 44px high. A large clickable area alone does not make a label readable. | **Major** |
| `/shop/office-corporate` | Live, 375/390/768/1440px | Restaurant-interior imagery does not show the platters being sold. The top explains repeats before quantities, food prices, delivery conditions or how to place a one-off order. | **Major** |
| `/shop/office-corporate` | Live, phone/tablet/desktop | “A standing platter” and repeated delivery/subscription paragraphs make a single meeting feel secondary. A birthday booking promotion below the form distracts from office requirements. | **Minor** |
| Office enquiry | Live, 390px | A fixed “Browse all boards” button appears while the customer is filling in the enquiry. It competes with the form and occupies the lower screen. No keyboard-obscuring failure is claimed: a real phone keyboard was not tested. | **Major** |
| Office category | Live + source | Monthly invoicing, regular delivery and “save 10%” are asserted without clear conditions. Some promotional text is hard-coded rather than tied to the actual enabled offer. | **Major** |
| Home/category notice and FAQ | Live + source | “Collect from Sunday 13 Sep” was displayed. `DeadlineChip` simply adds 48 hours; it does not use configured notice or a location’s bookable dates. This date was not verified as available for boards. | **Major** |
| `/plan` | Live, 390px | The planner says it cannot load boards and offers a useful telephone fallback, while the prominent “Show me a spread” action remains. | **Major** |
| `/platter/:id` | Source only | Back navigation always goes to `/platters`, losing the category. The add button follows description and subscription choice; there is no contextual product sticky action. | **Major** |
| Category cards/product | Source only | A group’s lowest price can sit beside its widest combined serving range, implying the cheapest size feeds the largest group. “Choose a size” also appears for non-size option groups. | **Major** |
| Product/basket/order/confirmation | Source only | Product says “Only 25% today”; basket says “Pay today”. Checkout submits a request; confirmation says a secure deposit link will follow. | **Major** |
| Filled basket → `/order` | Source only | Basket promises “choose collection day”, but checkout opens an Extras screen first. Collection suitability is discovered after an upsell. | **Major** |
| Filled basket/review | Source only | No explicit change-size action; variant label is not consistently shown. Review omits collection location, contact details and full requirements/notes. | **Major** |
| `/order` details | Source only | Review can remain disabled without field-level explanations. Availability failures can look like indefinite “Loading dates…”. Menu errors are not consistently displayed at the current step. | **Major** |
| Empty basket/`/order` | Live, 390px | Empty drawer offers no useful route when recommendations are absent. Checkout briefly displayed £0 and steps before settling into its empty state; the settled state omits the normal header. | **Minor** |
| `/bread` calendar | Live, 375/390px | Day targets measured about 42.4 × 58px at 375px, below the requested 44px width; about 44.6 × 58px at 390px. The first viewport is mostly a calendar, with bread below it. | **Minor** |
| Focus styling | Live focused form + source | Mustard focus has approximately 2.51:1 contrast against cream. Corporate inputs themselves measured 16px and 44–46px high live; they are not reported as undersized. | **Major** |
| Admin → Enquiries | Source only | Messages are truncated to 200 characters without expansion. Staff may miss the date, postcode or dietary detail later in a 2,000-character enquiry. | **Major** |

Retain the useful foundations: no page-level horizontal overflow was observed in inspected states; the corporate form stacked on phones; bread clearly stated collection/payment on pickup; source already has native size radios, semantic FAQ disclosures, drawer focus trapping/Escape and reduced-motion support. This is not a claim of full accessibility conformance.

### Source evidence

Paths are relative to the repository root; line numbers refer to the source inspected for this plan.

| Finding | Evidence |
| --- | --- |
| Routes and real home component | `client/src/App.tsx:69–77`; home is `client/src/pages/Choice.tsx`. |
| Home ordering and phone category carousel | `client/src/pages/Choice.tsx:96–267`; `client/src/styles/editorial.css:143–145`. |
| Missing office navigation | `client/src/components/Header.tsx:43–54`; `Footer.tsx:15–27`. |
| Count/list inconsistency | `server/src/routes/public.ts:465–483`; `client/src/pages/ShopCategory.tsx:125–126`. |
| Grouped prices and options | `client/src/lib/variants.ts:26–61`; `client/src/pages/ShopCategory.tsx:19–23,158–176`; `PlatterDetail.tsx:40–42,127–165`. |
| Checkout sequence/payment wording | `client/src/components/CartDrawer.tsx:300–302`; `client/src/pages/Order.tsx:28–30,48,277–282,414–415`; `Confirm.tsx:109–112`. |
| Checkout validation/review | `client/src/pages/Order.tsx:80,108,185–186,291–325,370–415`. |
| Notice mismatch | `client/src/components/Trust.tsx:9–10`; `Faq.tsx:3–4`; `client/src/pages/PlanEvent.tsx:274,372`; configured notice in `server/src/routes/public.ts:57–61`. |
| Enquiry and staff view | `client/src/components/CorporateEnquiryForm.tsx:4–9,54–100`; `server/src/lib/validation.ts:274–281`; `server/src/routes/public.ts:487–503`; `client/src/pages/admin/Enquiries.tsx:113`. |
| Editable content | `server/prisma/schema.prisma:29–111,424–459`; `client/src/pages/admin/Categories.tsx:210–238,288–305`; `MenuEditor.tsx:249–282`; `SiteSettings.tsx:150–177`. |

### Current UK references: specific patterns to borrow

Official page content was reviewed on 11 September 2026. These are design references, not measured conversion results or mobile checkout certifications. Their prices, delivery areas and policies must not be copied into Kelly’s content.

| Reference | Observed pattern and what Kelly’s should borrow |
| --- | --- |
| [GRAPE & Fig](https://grapeandfig.com/) and its [ordering guide](https://grapeandfig.com/pages/how-we-work) | Priced standard products have a purchase path; bespoke work has a separate contact path. The guide sets out notice, delivery charges, collection and what happens after ordering. Borrow the separation and put essentials beside Kelly’s first action. Avoid its much broader navigation. |
| [Covent Garden Catering](https://www.coventgardencatering.com/) | Bundle cards connect total price and headcount. The enquiry process asks for practical details and explains review, confirmation and payment. Borrow price/serves together and an explicit request sequence. Avoid switching between “order” and “request” for the same action. |
| [The De Beauvoir Deli catering](https://thedebeauvoirdeli.co.uk/collections/catering), particularly its [sandwich platter](https://thedebeauvoirdeli.co.uk/collections/catering/products/sandwiches) | A recognisable local deli identity accompanies small/large choices with serving counts and prices. Borrow complete size labels and useful local contact/collection reassurance. Expose the relevant portion guide on Kelly’s cards too. |
| [Graze Haus](https://www.grazehaus.co.uk/) | A short sequence explains browsing, date/location choices and receiving food ready to serve. Borrow practical “what arrives/what do I do?” reassurance using verified Kelly’s preparation/packaging details. Avoid abstract navigation labels that need interpretation. |

## 3. Information architecture

### Mobile navigation first

Keep **Menu**, the Kelly’s Deli home link and **Basket (n)** in a compact header. Use 16px menu/basket text, 44px minimum targets and an approximately 72px header at normal text size; allow it to grow with enlarged text. Remove the decorative announcement strip from the default phone layout. A real closure notice may replace it when needed.

The opened menu is a vertical list:

1. **Boards & platters** → `/shop`
2. **Office catering** → `/office-catering`
3. **Bread pre-orders** → `/bread`
4. **Plan an event** → `/plan`
5. **Visit & contact** → `/#our-shops`

Separate the first three buying destinations from the final two help links with space and a rule, not another navigation level. Include a telephone link in the contact area: the current planner exposes **01564 703441**; verify it with the owner before reusing it site-wide. Keep basket available without opening Menu. Close the menu after navigation; Escape returns focus to its opener.

Choose **Office catering** over “Corporate catering” or “Business catering”. It describes a familiar use in ordinary UK language and welcomes small workplaces, not just large companies. The introduction says “For meetings, team lunches and workplace gatherings” so other businesses recognise themselves. “Corporate catering” can appear naturally in supporting search copy, not as the main label.

### Page map and compatibility

| Destination | Route | Role |
| --- | --- | --- |
| Home | `/` | Food, direct board CTA, office signpost and categories. |
| Boards & platters | `/shop` | Existing category directory. |
| Party platters | `/shop/hosting` | Existing Party category, clearer display label; birthdays and gatherings. |
| Canapés | `/shop/canapes` | Existing category; this slug is in source seed data, so resolve links from the live category record. |
| Boards for home | `/shop/at-home` | Existing At Home category; same live-record linking rule. |
| Office platters | `/shop/office-corporate` | Existing corporate product category, focused on browsing food. |
| Product and size | `/platter/:id` | Existing variant-specific route. |
| Office catering | `/office-catering` — new | Service information, office products preview and enquiry form. |
| All boards | `/platters` | Compatible secondary browse page for links/bookmarks; remove its competing top-level entry. |
| Plan an event | `/plan` | Optional quantity help, never a required gateway. |
| Basket/checkout/receipt | Existing drawer, `/order`, `/confirm/:ref` | Preserve current ordering/payment arrangements. |
| Bread pre-orders | `/bread` | Separate ordering/calendar and payment-on-collection message. |

Display-label changes use the existing category editor; do not recreate categories or move assigned boards. Office platters remains in the shop alongside other categories. Its service callout links to Office catering. The landing page links to those same products rather than introducing another catalogue.

Breadcrumb: **Boards & platters / Party platters / [Product]**. On phones, **Back to Party platters** can replace a long breadcrumb. Preserve originating category through size changes and basket edits; use `/shop` when a shared product link has no origin. Office category breadcrumbs stay within the shop; add a separate **Office catering information** link. Keep variant URLs shareable and private enquiry details out of URLs.

Retain the phone menu on tablet until full navigation fits at 16px; start with a 1,024px breakpoint and verify long labels. Desktop uses the same names and order. The footer repeats the three buying destinations, planning, collection address, contact and policy links.


## 4. Office catering

### Landing page, in mobile reading order

Build `client/src/pages/OfficeCatering.tsx` with normal HTML sections and existing components. No mandatory wizard or headcount question before browsing.

| Section | Copy direction and behaviour | Data and actions |
| --- | --- | --- |
| **1. Heading and quick answers** | H1 **“Office catering”**. Intro **“Boards and platters for meetings, team lunches and workplace gatherings.”** Six short labelled lines: **People**, **Notice**, **Collection**, **Delivery**, **Dietary needs**, **Invoices & regular orders**. Keep these and the two paths ahead of the hero image. | People: “Each size shows how many it serves. Ask us for help with quantities.” Notice: configured collection notice plus any verified office qualification. Collection: active shop name. Delivery: approved area/fee/minimum, or “Ask us to confirm availability and cost.” Dietary: “Tell us what you need before booking.” Invoices/repeats: “Tell us what you need in your enquiry.” |
| **2. Two clear paths** | Primary **“Choose platters for collection”**, with “Choose your food, then your collection date.” Secondary outlined **“Ask about catering”**, with “For delivery, help with quantities or regular orders.” | First links to existing corporate category. Second links to `#enquiry`, scrolls there and focuses its heading. Neither says “Book delivery”. Telephone is an assisted option below, not a third equally prominent button. |
| **3. Real food photograph** | Actual office selection, showing packaging and scale where possible. No restaurant interior, boardroom stock photograph or text over a busy image. | Existing corporate `Category.heroImageUrl`; text-first fallback if no suitable owned photo. Caption only if it explains contents/size accurately. |
| **4. Office platters** | **“Choose food for the meeting”**. Up to three product groups: photo, name, matching price/serves and **“Choose size”**, **“Choose option”** or **“View platter”**. Link **“See all office platters”**. | Active corporate assignments grouped with `groupVariants`. Current product DTO prices. If empty, honest unavailable message and enquiry/phone route; no invented products or prices. |
| **5. Quantities** | **“Will this feed everyone?”** Explain serving assumptions from approved descriptions. “Planning a full lunch or food alongside other dishes? Tell us when you enquire so we can suggest enough.” No promised maximum group size. | `serves`, `feedsMin`, `feedsMax`, `description`, `items`; optional `/plan` help when its catalogue works. Owner confirms whether ranges describe lunch or light grazing. |
| **6. Collection, delivery and dietary details** | Three short subheadings. Collection shop/address and date selection. Delivery area, fee/minimum and notice only when confirmed; otherwise invite an enquiry. State whether food arrives ready to serve and what plates/cutlery cost. “Please tell us about allergies or dietary requirements. We’ll discuss what we can provide before you book.” | Public shop/location content; actual contents and add-on names/units/prices; operational text below. No universal adaptation or allergen-free guarantee. |
| **7. Regular lunches and invoices** | **“Ordering regularly?”** Explain the manually arranged service. “Tell us how often you need food and whether you need an invoice.” Publish monthly invoicing, credit terms or savings only if offered. | Existing frequencies and approved terms. Savings match `subscribeSave`, `subscribeSaveDiscountPct` and actual eligibility. No implication of automatic billing or a business account. |
| **8. Enquiry** | **“Tell us what you need”**. “A one-off meeting or a regular lunch — send us the details you know.” Button **“Send catering enquiry”**. **“This is an enquiry. Nothing is booked or charged.”** | Reuse `CorporateEnquiryForm`, `POST /api/corporate-enquiry`, existing record type and admin destination. |
| **9. Contact and next step** | Short contact/collection block, links to Office platters and full shop. No birthday promotion, voucher form, referral pitch or reminder signup. | Verified contact details and opening hours. |

Within the first 10 seconds, an office manager should identify serving guidance, notice, collection versus delivery, dietary help, invoice/repeat-order enquiries and the two next actions. Render six quick answers as a compact list, not paragraphs. At 375px, heading and routes should be immediately visible, with all six answers in the opening screen or first short scroll. Do not shrink text to force a fixed-height screen. Prices follow in the food preview. No essential fact requires opening an FAQ.

### Content ownership and minimal data changes

| Content | Existing field/editor | Plan |
| --- | --- | --- |
| Corporate category, intro/photo | `Category.name`, `tagline`, `description`, `heroImageUrl`, `isCorporate`, `active`, `sortOrder`; Admin → Categories | Keep category, rename display label to Office platters and edit intro to suit both uses. New service page H1 is Office catering. Reuse appropriate intro/photo content. |
| Products and order | `PlatterCategory.categoryId`, `platterId`, `sortOrder`; category assignment editor | Select products once; preview and category list share active groups/order. |
| Product details | `Platter.name`, `description`, `items`, `imageUrl`, `fixedPrice`, `pricePerHead`/existing derived price DTO, `serves`, `feedsMin`, `feedsMax`, `variantGroup`, `variantLabel`, `variantOrder`; Admin → Menu & Pricing | No new product schema fields. Existing description explains serving context and verified dietary information. Never infer suitability from name/photo. |
| Collection address/contact | Current Bentley Heath address/email in `components/Footer.tsx`, telephone in `pages/PlanEvent.tsx`; these are fixed in code, not editable `Location` fields | Reuse the verified Bentley Heath address only for that identified location, via a small shared contact constant if useful. Other locations show their verified name only until an address is supplied. No new address schema is required for this release. |
| Collection notice | Existing `Setting.orderLeadTimeHours`; Site Settings | One numeric source. Actual collection dates come from availability, including location/capacity restrictions. Bread keeps separate rules. |
| Office operational text | **New** `Setting` key `officeCateringContent` | Typed JSON with five explicit properties: `categoryId`, `leadTimeNote`, `deliveryNote`, `dietaryNote`, `invoiceRepeatNote`. These are five editing decisions, shown as labelled ordinary fields, not a JSON editor. |
| Repeat-order settings | Existing `subscribeSave`, `subscribeSaveDiscountPct`, `corporateNextDayDelivery` public settings | Current Site Settings has no friendly controls for these keys. Add labelled controls so displayed offers remain owner-controlled. Do not change saved values merely by rolling out the controls. |
| Home content | Existing `heroImageUrl`, `aboutText`, `missionTagline`, `founderNote`, `reviewRating`, `reviewCount`; Site Settings | Reconnect useful existing fields before adding new ones. Current `Choice` hero paragraph is hard-coded; some story fields are not rendered. |

`officeCateringContent` fits the existing key/value `Setting` model. It needs typed parsing/validation, a small public content response addition and friendly Site Settings controls, **not a Prisma migration**. Use plain text, length limits and an explicit public allowlist. The selector chooses the active `isCorporate` category; never silently substitute an unrelated category. Before configuration, show neutral enquiry wording. `leadTimeNote` adds qualifications, not a second conflicting numeric notice rule.

Implementation detail: the existing generic `settingSchema` caps a setting value at **500 characters total** (`server/src/lib/validation.ts:221–223`). Do not send the office JSON through that unchanged limit. Add dedicated validation for `officeCateringContent` in the existing settings handler, following its special-setting pattern: validate the category reference, bound each of the four notes to 400 characters, and cap the complete serialised value at 3,000 characters. Keep the generic limit unchanged for other settings. The public parser needs the same shape and safe fallbacks. Keep quick-answer copy concise; longer approved notes belong in the relevant detail section.
Owner publication checklist: confirm delivery area, fee/minimum, one-off delivery eligibility, lead time, serving assumptions, dietary handling, invoice terms, repeat terms and contact details. Unknown facts use honest enquiry wording, not guessed numbers or invented response times. A next-day setting alone must not generate a universal delivery promise without its applicable terms.

Keep category SEO metadata on the category. New page title: **“Office catering in Solihull | Kelly’s Deli”**, with a description about meetings, food and enquiries. Category `seoTitle`/`seoDescription` describe browsing office platters. Keep both pages distinct; no duplicated full-page copy or canonicalisation of one away.

### Enquiry fields, success and staff handover

Keep three required fields: **Company or organisation**, **Your name**, **Email**. Phone, people, frequency and message stay optional. Mirror current limits: company 160, name 120, phone 30, message 2,000 characters; headcount a positive whole number within the existing server limit. No payment or unnecessary full address upfront.

Use **How many people? (if known)** and **How often?**: “One-off meeting”, “Weekly”, “Every two weeks”, “Monthly”, with an unselected “Not sure yet” choice. Message label: **“Date, timing and anything else (optional)”**. Visible helper: **“If you know them, include your date, time, delivery postcode and dietary requirements. Tell us if you need an invoice.”** Reuse `CorporateEnquiry.message`; no separate date/address model fields are needed.

Success: **“Thanks — we’ve received your enquiry.”** Then **“We’ll contact you to discuss the food, date and any delivery requirements. Nothing is booked or charged yet.”** Focus the heading and announce success. Do not claim an email was sent: the handler stores the enquiry and returns success without sending a customer email. On failure retain fields and show retry plus verified phone/email.

In Admin → Enquiries, add **“Show full enquiry”**, revealing the entire message with line breaks. Preserve New / Contacted / Closed. The owner must be able to act on all submitted details without inspecting the database.

## 5. Home page

The actual home component is `client/src/pages/Choice.tsx`. Use this mobile section order:

1. **Compact header, then food-led hero.** Real 16:9 photograph, H1 **“Made for sharing.”**, **“Boards and platters, prepared by our family deli in Bentley Heath.”**, one navy CTA **“Choose a board”** → `/shop`. Below: **“Choose your collection date when you order.”** Add verified minimum notice, not an unverified earliest date. Allow natural headline wrapping.
2. **Office catering signpost.** Full-width short row, not carousel: **“Lunch for the office?”** / **“Platters for meetings and team lunches.”** / **“Office catering”** → `/office-catering`. It is section two, before featured products. Direct board access remains ahead of it.
3. **Choose by occasion.** **“What are you planning?”** Existing categories as visible vertical rows: Party platters, Boards for home, Canapés, Office platters. Party helper: **“Birthdays and gatherings.”** Home helper: **“A smaller table or a night in.”** Set this initial order in existing admin; respect future owner ordering. No separate birthday-board catalogue.
4. **Three featured product groups.** **“From the deli counter”**. Existing signature groups/admin order, reduced from six to three. Photo, name, matched price/portion, action. **“See all boards & platters”** → `/shop`. Hide genuinely unconfigured shelves; request failure gets retry/contact, not an invented maintenance explanation.
5. **How ordering works.** **“Choose your food”** → **“Choose collection and send your request”** → **“We confirm and arrange your deposit”**. Explain the verified balance-on-collection policy without implying instant booking. Small **“Help with quantities”** link to `/plan` only when it can give useful results.
6. **Bread pre-orders.** Quiet row: **“Fresh bread for collection”** / **“Pre-order and pay when you pick it up.”** / **“Pre-order bread”** → `/bread`.
7. **Real deli and visiting information.** Short approved story using `aboutText`/`founderNote`, actual shop/team photo where available, collection address and hours. One verified rating link here or near the hero CTA. Avoid repeated trust strips/stars.
8. **Four practical questions, then footer.** Notice, collection/delivery, payment, dietary requirements; `Faq` uses shared policy content. Footer has all destinations and contact details.

Keep built capabilities but reduce prominence: one real active bundle alongside relevant products; product videos on relevant detail pages with native controls; reminder capture below a birthday section in the shop with consent unchanged; `GiftVoucher` behind a **“Request a gift voucher”** disclosure on `/shop`. Remove “instant gift cards coming soon”. Do not change bundle pricing rules, invent offers or turn reminders into automatic subscriptions.

The direction is quiet editorial food photography using the navy identity. Large lifestyle headers could reinforce premium positioning, but delay practical decisions on a phone. Compact real food imagery wins here. No signature animation or decorative interaction is required.

## 6. Shop, category and product pages

### Directory and categories

Change `/shop` H1 to **“Boards & platters”** and introduction to **“Choose an occasion, then pick your food and size.”** Retain categories. One-column category rows on phones, two columns on tablet, restrained grid on desktop. Use real links with visible labels and explanations; no hover-only navigation.

Category order: breadcrumb/back, plain heading, two-line introduction, collection notice, products. Keep photos shallow. Move the Party planner banner below first products or make it a compact help link. Office category callout: **“Need delivery, an invoice or help planning? Visit Office catering.”** The full enquiry lives on the new page, avoiding duplicate large forms.

One card per `variantGroup`, or individual ID when ungrouped. Preserve assignment order and admin variant order. Counts, if shown, mean **active distinct product groups**, not variants/assignments. Omit unnecessary counts.

### Product card contract

Photo → name → price with matching portion guide → brief contents → one action. **“Choose size”** for size groups, **“Choose option”** for other groups, **“View platter”** for single-option products. Detail remains the consistent place to read contents and add food. “Order” must not describe merely opening a page.

For a multi-size product, pair “From £X” with **the serving guide of that same lowest-priced available variant**, explicitly labelled by size/option. Separately say **“More sizes available”**. Never combine lowest price with the maximum across all sizes as one offer. Link to the represented variant; radios still follow owner `variantOrder`.

Prefer that variant’s photo. A shared group photo may be used if honestly identified as representative of the range, not proof of a particular portion. Use readable `Platter.name` and separate `variantLabel`; the owner can clean current text without a new naming model. Uncertain/missing price shows **“Ask us for a price”** and help, never £0 or an invented fixed price. Any existing per-head products retain visible per-person units and minimum quantities; do not convert them into fixed-price boards.

### Product detail and sizes

Mobile order: back link → product name → food photo → short contents introduction → **Choose your size/option** → selected price/serving guide → collection notice → **Add to basket · £X**. Detailed contents, dietary discussion and optional repeat information follow. One-off remains normal; subscription is not a decision everyone must make before adding food.

Keep the native fieldset/legend/radios in `PlatterDetail.tsx`. Full-width option rows show:

- `variantLabel` in readable semibold;
- verified serving range and eating context;
- that variant’s full price;
- visible radio/check and contrasting selected border.

Selection updates price, serving guide, image where appropriate and `/platter/:id` together. Retain `replace` navigation so Back does not visit every size tried. Shared URLs select their actual ID. Never silently switch to a costlier size after adding.

**“Will this feed everyone?”** sits beside the serving guide. Readable text comes from `serves`; numeric helpers use validated `feedsMin`/`feedsMax`. Explain “as part of a buffet” versus “for lunch” in existing descriptions after owner confirmation. Missing reliable portions means **“Ask us about portions”**, not a guessed range.

Reuse optional customer-entered cart headcount. **“You’re planning for 12 people”** must represent real input, not an automatic midpoint estimate. If selected upper serving range is below headcount, say **“This size may not be enough on its own. See larger sizes or ask us for help.”** Do not declare “enough” just because a maximum meets headcount. Mixed savoury, cheese and sweet platters are not interchangeable meals: a summed range is not a guarantee that an event is catered for.

Label quantity **“Number of platters”**, distinct from people. Existing planner recommendations remain suggestions with editable products and itemised prices.


## 7. Basket and checkout on mobile

### Basket

Retain `CartDrawer` and its focus trap, Escape and focus restoration. Each line shows product, selected size/option, serving guide, quantity, unit price and line total. Add **“Change size”** and **“Remove”**. Changing size replaces that line’s variant, preserving quantity and other lines; if the target variant already exists, merge quantities predictably. Never accidentally add a second platter.

Prioritise total and **“Choose collection date”** at the bottom. Show **“25% deposit to confirm your order”**, **“Payment link sent after your request”**, and balance information using existing calculations. Avoid “Pay today” and “Only 25% today”. Keep actual savings itemised; hide promotional progress bars and videos from this decision area. Optional extras can sit in a closed **“Add extras”** disclosure above the summary; no preselected items.

An empty basket always has **“Browse boards & platters”** → `/shop`, even if recommendations fail. Empty checkout keeps normal navigation. An unavailable product remains an identified line with explanation and remove/replace choice; do not silently discard it or make a populated cart appear empty. If its name cannot be resolved, say **“An item in your basket is unavailable”** without guessing name/price.

### Checkout

Use two steps: **“Collection & details”**, **“Review request”**. Reuse current controls and submission endpoint. First step:

1. Collection shop/address and existing availability calendar. **“Collection only. For delivery, ask about office catering.”** links to enquiry. No cosmetic delivery toggle: current checkout does not collect/submit general delivery details.
2. Name, phone and email with persistent labels and concise reasons where useful. Preserve current required contact fields.
3. Optional headcount, occasion, allergies/requirements and gift note. Gift fields stay closed until chosen. Never prefill a gift message into a real order.
4. Optional **“Add extras”** disclosure using `AddOnsStep` and existing active add-ons, units and prices. No separate mandatory Extras screen. Preserve chosen extras and existing bundle/discount calculations.
5. Total and **“Review request”**.

Give dates separate loading, no-available-dates and failure states. Failure: **“We couldn’t load collection dates. Try again or contact the deli.”** Keep entered details and basket. Show unavailable dates with reasons. When a shop/date becomes unavailable, explain beside the calendar, not only after submission.

Let “Review request” reveal clear errors rather than remain silently disabled for incomplete fields. Disable only during genuine loading/submitting or when a visible explanation makes progression impossible. Focus an error summary linked to fields; associate inline messages and invalid states. Preserve fields between steps; do not start storing personal/allergy information indefinitely in browser storage.

Review shows food, variant, quantity, extras, actual discounts, total, deposit amount, balance, collection shop/address/date, contact, requirements and gift note. Each section has **“Edit”**. Final action: **“Send order request”**, preceded by **“We’ll contact you with a secure link for the 25% deposit to confirm your order. The balance is payable on collection.”** Match current `Confirm` behaviour and approved terms. Remove unverified speed promises such as “shortly”.

`/confirm/:ref` says **“Order request received”**, displays reference and next steps, and distinguishes request receipt from payment/confirmation. No new payment provider/screen, invoice checkout or automatic billing. Refund wording must match current terms everywhere; avoid truncated “Refundable to 48 hrs”.

### One relevant sticky action

Replace `StickyCta`’s arbitrary scroll-distance trigger with whether its equivalent in-page action is visible. Share presentation, with page-specific behaviour:

| Context | Mobile bottom action |
| --- | --- |
| Home after hero action leaves view | **Choose a board** → `/shop`. |
| Category after products begin | **View basket (n)** when populated; otherwise no redundant browse-all bar taking shoppers away. |
| Product | Selected price + **Add to basket**, using the same variant/action as the page button. |
| Office catering | **Ask about catering** until the enquiry is reached, then hide. Never Browse all boards over the form. |
| Checkout | Current step action and total, without a second page CTA below. |

Only one bottom bar at a time. Hide page bars when the drawer is open or an enquiry/input is being edited. Use `env(safe-area-inset-bottom)`, matching content padding and visible focused fields/errors. Use normal flow when the viewport is too short for a useful fixed bar. Verify with a real mobile keyboard during implementation.

## 8. Visual system

Use `client/src/styles/tokens.css` as the authoritative storefront token layer. Consolidate conflicting storefront overrides in `theme.css`, `editorial.css`, `components.css` and `shop.css`, preserving needed aliases. Do not accidentally recolour the admin.

| Element | Specification |
| --- | --- |
| Typography | Existing **Fraunces** headings, **Mulish** body/navigation/forms. Two families. Medium/semibold controls; no light-weight essential text. |
| Body | Default **18px**, line-height **1.55–1.65**. **16px minimum** for body, supporting instructions, form values/labels, prices, navigation, buttons and policy text. |
| Headings | Phone H1 **36px/1.12**, H2 **28px/1.2**, H3 **22px/1.25**. Desktop H1 **56px**, H2 **36px**, H3 **24px**. Fluid rem-based tokens and natural wrapping. No viewport-height hero. |
| Prices | **22–24px** on detail/summary; at least **18px** on cards. Tabular numerals, existing GBP formatter, clearly attached unit/size. |
| Reading width | About **45–65 characters** on desktop; natural phone content width. Avoid long centred paragraphs. |
| Spacing | Scale **4, 8, 12, 16, 24, 32, 48, 64, 96px**. Phone gutters **16–20px**, sections **40–48px**, cards **24px** apart. Desktop gutters **32–64px**, sections **64–96px**, maximum content width around **1,200px**. |
| Brand colour | Navy `--navy: #102b46` is the single brand accent for actions, selections and restrained footer. Cream `--cream: #faf7f0`; card `--card: #fffcf7`; ink `--ink: #142e44`; secondary text `--ink-soft: #58616a`. |
| Gold/olive | Stop using as competing accents or essential states. Existing aliases may stay for compatibility. Semantic error/success colours are allowed with text/icons. |
| Contrast | Text **4.5:1 minimum**, aim **7:1** for main reading text; large headings at least **3:1**. Controls/selected boundaries/focus at least **3:1** against adjacent colours. Token ratios against cream: navy about **13.48:1**, ink-soft **5.89:1**; recheck actual rendered combinations. |
| Borders/focus | `--line: #ddd9cf` is decorative only, about **1.32:1** against cream. Use stronger input boundaries. Focus: **3px navy outline, 3px offset** on light surfaces; cream on navy. Mustard must not be the sole indicator. |
| Images | Mobile home hero **16:9**, category thumbnails/product cards **4:3**, detail **4:3**. Keep food/portion in frame. Accessible tap-to-enlarge where useful, with close/focus behaviour. No text overlays needed. |
| Targets/controls | Primary **54px minimum height**, **16–18px** sentence-case labels. Other targets at least **44 × 44px**, preferably **48px**, separated. Size rows at least **72px**, allowed to grow. Inputs **50px minimum height**. |
| Shapes | Retain **2–3px** radius and light dividers. Avoid pill-shaped everything, floating badges, repeated shadows or arches competing with food. |
| Motion | Useful press/focus feedback around **150–200ms**. No autoplay, essential-choice carousel, parallax, animated counters or required scroll reveals. Videos stay user-initiated with controls/captions where applicable. |

Photography is the premium signal: actual products at sold sizes, packaging/ready-to-serve view and the real deli/team. These are content requirements, not permission to generate imaginary food or claims. Missing photography must not prevent ordering: use a clear neutral fallback. Set image dimensions, responsive sizes and below-fold lazy loading so buttons do not move as photos load.

## 9. Accessibility & readability

- **Readable content:** minimum 16px functional text, 18px body default, sentence case, short paragraphs and familiar labels. Avoid acronyms, all-caps actions and vague verbs where “Choose a board” is clearer.
- **Touch/zoom:** 44 × 44px minimum targets. At 375px, seven 44px calendar targets plus six 4px gaps require 332px: use full content width without nested card padding. Below the width where that fits, offer an accessible date list rather than shrink days or scroll horizontally. Check 200% text and 320px reflow.
- **Keyboard:** visible focus everywhere. Links navigate; buttons perform actions. Radios keep native keyboard behaviour. Drawers trap focus only while open, close with Escape and restore focus. Menu navigation must not strand focus.
- **Structure:** one H1, sensible heading order, landmarks and skip link. No instructions only in placeholders or hover states. Route/step changes focus the new heading; progress uses `aria-current="step"`.
- **Forms:** visible required/optional labels, correct autocomplete and mobile input types. Linked error summary and inline messages; values survive errors. Announce relevant price/size changes and submit status without reading the whole page repeatedly.
- **Calendars:** full date/reason labels. Fix incomplete ARIA grid structure or use labelled native button/date-list patterns. Retaining a grid requires rows/gridcells, arrow-key movement and selection semantics together. Colour alone must not mean availability.
- **Reduced motion:** honour `prefers-reduced-motion`, including variant transitions and smooth scrolling. No content starts invisible awaiting animation.
- **Images/trust:** useful alt for informative imagery; empty alt for decorative images. Do not call stock imagery Kelly’s product or infer dietary suitability. Only actual enabled offers and current verified reviews; editable rating fields are not independent verification.
- **Acceptance checks:** keyboard, screen-reader labels, zoom, high contrast, landscape, drawer scrolling and keyboard-open forms. These are engineer checks, not claims that this audit completed a full accessibility assessment.


## 10. Implementation plan for the engineer

Sizes: **S** = focused change; **M** = contained component/content changes; **L** = broader work to split further. These are relative scope estimates, not day commitments. The list avoids a large rebuild. Paths below are relative to `client/src/` unless prefixed `server/`; abbreviated filenames share the preceding directory. These are future touch points, not instructions to change source during this design task. Each item is a useful increment; explicit dependencies prevent dead links or incomplete journeys.

### 1. Recover catalogue journeys and honest empty/error states — M

**Files:** `pages/Choice.tsx`, `Shop.tsx`, `ShopCategory.tsx`, `Platters.tsx`, `PlanEvent.tsx`; `lib/api.ts`, `variants.ts`; `server/src/routes/public.ts` and existing DTO helper if required.

**Work:** Diagnose deployed empty responses/rendering against current client contract. Reconcile active/grouped counts. Do not assume reseeding is needed or reactivate withdrawn products. Distinguish empty, failed request and not-found. Give the planner the same availability state and useful contact alternative. If the diagnosed repair exceeds this task, split it before implementation.

**Browser acceptance:** Available Office/Party products appear; a group counts once and opens its detail. Empty data has honest wording and contact/browse actions. Failed requests offer Retry without claiming maintenance. No loop between empty pages without contact. This is the dependency for finishing the live shopping walkthrough.

### 2. Correct collection and payment expectations everywhere — M

**Files:** `components/Trust.tsx`, `Faq.tsx`, `CartDrawer.tsx`; `pages/Choice.tsx`, `Shop.tsx`, `ShopCategory.tsx`, `PlatterDetail.tsx`, `PlanEvent.tsx`, `Order.tsx`, `Confirm.tsx`; `lib/api.ts`; existing settings/availability response in `server/src/routes/public.ts` if needed.

**Browser acceptance:** No page implies payment happened or is taken “today” when it sends a request. Receipt explains the deposit-link next step. Any earliest collection shown is supported by checkout availability; otherwise only configured notice appears. Changing notice through the existing editor updates customer wording. Bread keeps its own notice/payment rules.

### 3. Apply readable text, controls and focus tokens — M

**Files:** `styles/tokens.css`, `theme.css`, `editorial.css`, `components.css`, `shop.css`; `components/Header.tsx` where necessary.

**Browser acceptance:** At 375, 390 and 768px essential text is at least 16px. Targets meet specified sizes, focus is obvious on cream/navy and 200% text does not clip prices/actions. Tablet uses Menu instead of tiny navigation. No page-level horizontal scrolling is introduced.

### 4. Add Office catering with safe default content — M

**Files:** new `pages/OfficeCatering.tsx`; `App.tsx`; `lib/api.ts`; `components/CorporateEnquiryForm.tsx`, `StickyCta.tsx`; `styles/shop.css`, `editorial.css`.

**Browser acceptance:** Direct load/refresh of `/office-catering` works. At 375/390px quick answers and the two paths are readable. Browse opens existing corporate category; enquiry scrolls/focuses the form. No duplicate products. Missing photo/data leaves a useful page. Page and reused form make no unsupported delivery/invoice claim. Sticky enquiry action hides when the form is reached/edited.

### 5. Make Office catering findable in menu and home — S

**Files:** `components/Header.tsx`, `Footer.tsx`; `pages/Choice.tsx`, `ShopCategory.tsx`.

**Dependency:** task 4 destination exists.

**Browser acceptance:** Office catering is second menu entry and second home content section, with no horizontal swipe required. Office product category links to service page. Boards & platters opens `/shop`; Bread pre-orders opens `/bread`; old `/platters` links still work. Menu, Back and focus remain predictable.

### 6. Give the owner office-content controls — M

**Files:** `pages/admin/SiteSettings.tsx`, `Categories.tsx` if helper text changes; `lib/api.ts`, `admin.ts`; `server/src/routes/public.ts`, `server/src/routes/admin.ts` and existing validation helpers; `pages/OfficeCatering.tsx`.

**Browser acceptance:** Ordinary fields edit the five `officeCateringContent` properties without JSON/code. Selected category is recognisable. Valid approved content appears on landing page; blank/malformed content has safe fallback. Product details remain edited in the menu editor. No Prisma migration. Existing repeat/next-day settings have understandable controls, with saved values and approved offer conditions respected.

### 7. Make cards and size choices unambiguous — M

**Files:** `pages/Choice.tsx`, `ShopCategory.tsx`, `Platters.tsx`, `PlatterDetail.tsx`; `lib/variants.ts`; `styles/components.css`, `editorial.css`.

**Browser acceptance:** Multi-size board has one card. “From” price/serving guide/link match one variant. Every option shows its own price/serves. Changing radio updates URL, price and added variant; refresh retains it. Back preserves originating category. Non-size groups say “Choose option”. Missing prices/portions never become £0 or invented claims. The same rules apply to Office landing previews.

### 8. Improve basket editing and contextual mobile actions — M

**Files:** `components/CartDrawer.tsx`, `StickyCta.tsx`; `pages/PlatterDetail.tsx`, `ShopCategory.tsx`; `lib/cart.ts`; `styles/components.css`, `editorial.css`.

**Browser acceptance:** Basket names option, quantity and totals. Change size replaces/merges the intended line without duplicate food or lost quantity. Empty basket links to shop. Unavailable lines are explained, not silently removed. Sticky product action adds displayed variant; category bars do not divert empty-basket shoppers. One bar only, safe-area padding, reachable drawer actions with enlarged text. Focus trap/Escape still work.

### 9. Put collection before optional extras — M

**Files:** `pages/Order.tsx`; `components/AddOnsStep.tsx`, `CartDrawer.tsx`, `CapacityCalendar.tsx`; `styles/components.css`.

**Browser acceptance:** “Choose collection date” lands on Collection & details. Extras are closed/optional; customer can review without buying extras. Chosen extras and gift details survive forward/back. Standard checkout clearly states collection and links delivery questions to enquiry. Identical products, quantities and discounts give identical financial totals before/after the layout change.

### 10. Complete review, validation and recovery — M

**Files:** `pages/Order.tsx`, `Confirm.tsx`; `components/CapacityCalendar.tsx`; `styles/components.css`.

**Browser acceptance:** Missing fields produce linked understandable errors. Failed dates/menu loading offers retry at current step and retains details. Review includes food/options, collection address/date, contact and requirements with Edit links. Submission is accurately labelled and protected against repeated taps. Failure preserves the request for correction. Receipt explains what happened without changing payment flow.

### 11. Make enquiries useful to customers and staff — M

**Files:** `components/CorporateEnquiryForm.tsx`; `pages/OfficeCatering.tsx`, `ShopCategory.tsx`; `pages/admin/Enquiries.tsx`; `styles/shop.css`.

**Browser acceptance:** One-off wording reads naturally; required fields and limits are clear; failure retains text. Success gets focus and says nothing is booked/charged. In an authorised non-production setup, one submission creates one existing-type enquiry whose full message expands in admin. No invented customer-email claim. Production submissions are not needed to verify layout. Category links to the main enquiry location rather than retaining a second large form.

### 12. Reorder and shorten home — M

**Files:** `pages/Choice.tsx`; `components/Bundles.tsx`, `DeliVideos.tsx`, `ReminderCapture.tsx` only for placement/props; `styles/editorial.css`.

**Browser acceptance:** Phone sequence matches section 5, with food/board CTA before office signpost. Three distinct featured groups when available. All categories reachable without horizontal carousel. Empty promotions leave no blank space. Existing story content renders; no autoplay; consent and discounts keep current behaviour.

### 13. Refine categories and genuine photography — S

**Files:** `pages/Shop.tsx`, `ShopCategory.tsx`; `styles/shop.css`; existing admin category/menu editors only if preview/help changes.

**Browser acceptance:** Owner applies labels/photos through existing controls. Category IDs/slugs/assignments remain intact. First products follow compact introduction; planner/promotions do not precede essential choices. Actual food or honest fallback images. Long names wrap without hiding prices/actions.

### 14. Finish bread, calendars and secondary content — M

**Files:** `pages/Bread.tsx`, `Shop.tsx`; `components/BreadCalendar.tsx`, `CapacityCalendar.tsx`, `GiftVoucher.tsx`, `Faq.tsx`, `Footer.tsx`; `styles/components.css`, `shop.css`, `editorial.css`.

**Browser acceptance:** Bread retains separate order/payment rules. Calendar targets meet 44px at 375px, with readable alternative at smaller widths and complete keyboard/assistive labels. Bread explains “Choose a shop and date, then your bread” before calendar. Gift vouchers/reminders are optional, accurately named and outside office journey. Contact is easy to find; FAQ works by touch/keyboard.

### 15. Verify both complete customer journeys — M

**Files:** no new feature required; correct only affected files if checks find issues.

**Dependency:** available representative products and implemented tasks above. This is future verification, not work performed for this document.

**Browser acceptance:** Walk office meeting and birthday journeys at 375/390px first, then 768/1440px. Include multi-size and non-size options, quantity/size edits, unavailable/empty data, Back, refresh, date errors and order request in an authorised non-production environment. Check 200% text, 320px reflow, keyboard focus, reduced motion, landscape and real mobile keyboard. Observe an owner/representative customer finding office catering, servings, price, collection method and next step without coaching. Do not claim readiness with any catalogue blocker or unvisited stage.

## 11. Out of scope / do not do

- **No implementation in this assignment.** This document is the only file changed. Tasks are a handover, not permission to run source edits, migrations, seeds, installs, builds, tests or database operations now.
- **No platform replacement.** Keep React/Vite/React Router, Express, Prisma and Postgres on the existing origin. No CMS migration, Shopify, framework switch or separate catering app.
- **No catalogue restructure.** No replacement occasion taxonomy/configurator, corporate-only inventory or separate product cards for variants. Keep existing category/product URLs compatible.
- **No new payment/delivery product.** No invoice-at-checkout, automatic subscription billing, payment provider, courier integration, delivery calculator or combined bread/board basket. Delivery/invoice enquiries use the current manual process.
- **No invented promises.** No new discounts, fake testimonials/awards/reviews, unsupported “most popular”, guessed serving capacities, guaranteed next-day service, allergen-free claims or invented response times. Existing published claims must be verified before repeating or expanding them.
- **No decorative complexity.** No scroll-jacking, autoplay hero, marquees, parallax, chatbot, mega-menu, hidden-swipe essential navigation, pop-up discount funnel or mandatory event wizard. These add effort for customers and maintenance for one engineer.
- **No speculative business systems.** No corporate accounts, saved repeat baskets, quotations engine, CRM replacement or messaging automation. Make current enquiries readable first.
- **No broad admin/SEO project.** Limit admin to named content controls/full enquiry display. Give the new page clear metadata/navigation without expanding into CMS, analytics or search-platform work.
- **No pretending polish fixes availability.** The observed empty-board blocker and uncompleted populated shopping stages remain explicit implementation dependencies.


