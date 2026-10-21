# Kelly's Deli: design direction ("The Counter")

Why the last version failed: it used every generic AI tell. Cream paper with a classical serif, gold hairlines,
a made-up heritage crest, tracked ALL-CAPS labels over every heading, "A · B · C" strings, one italic word
in each headline, and drawings of hams instead of photos of ham. A deli sells appetite. You can't
draw appetite.

## The idea
The site is the deli counter. You see the food large and close, and prices are on counter tickets, the
little white price cards pushed into the ham on the counter. Order slips work like the Christmas
order book by the till. Nothing is pretend-heritage. It's a busy, generous, local shop that is good at food.

## Rules
1. **Photography leads.** Every product, board, door and hero is a photo, cropped tight and full-bleed where it
   matters. A product without a photo shows a plain colour block with its name in the ticket style, never
   a drawing. AI or stock photos carry a small "Illustrative photo" tag until the owner's own photos replace them.
2. **One typeface family: Archivo** (Google Fonts, variable width 62–125, weight 100–900).
   - Headlines: Archivo, weight 800, width 100 for normal headlines and 112 for the biggest. Sentence case, tight leading (1.0–1.05).
   - Body: Archivo 400, 17px, line-height 1.55, measure 34em at most.
   - Ticket numerals and prices: Archivo, width 75 (condensed), weight 800, tabular figures.
   - No serif, no italic accent words, no tracked uppercase labels. Small labels are sentence case at 14px/600.
3. **Colour.**
   | token | hex | use |
   |---|---|---|
   | `--paper` | `#ffffff` | page |
   | `--counter` | `#f1efe9` | quiet bands, image placeholders |
   | `--ink` | `#1d1d1b` | text |
   | `--green` | `#1f3d2b` | brand surfaces: header, footer, big CTA band |
   | `--red` | `#c8102e` | action buttons, the ticket's top stripe, order-by warnings |
   | `--kraft` | `#c9a26b` | rare: paper-bag accents on the order slip |

   Christmas adds nothing new. The season comes through photos and copy (holly is in the photo, not the CSS).
4. **Signature element: the counter ticket.** A white card with a 4px red top stripe, the price in large condensed
   figures, and the unit underneath ("Half ham, about 2.5kg"). It sits over the bottom-left corner of product photos and appears on the
   product page. That's the one bold thing; everything else stays quiet.
5. **Shape.** Photos have 0 radius. Buttons and tickets have 2px. No shadows, except the ticket (one crisp `0 1px 0 rgba(0,0,0,.15)`).
   Use no hairline-rule decoration, no ornaments and no crest.
6. **Layout.** Left-aligned throughout, and nothing centred except single buttons inside a band. 12-column grid, 24px gutter.
   Product grid has 2 columns on phone and 4 on desktop, photo 4:5.
7. **Copy.** Plain and local. Write "Order your ham by 16 December. Collect it from the shop any day up to Christmas Eve."
   Not "Purveyors of fine food". Use real facts only: no invented dates, awards or reviews.
8. **Motion.** None on scroll. Use only one: the basket count ticks when something is added.

## Logo
Wordmark "Kelly's" in Archivo 800, width 112, with "Deli, Bentley Heath" under it in 14px/600. No crest.
Favicon: the existing green square "K".
