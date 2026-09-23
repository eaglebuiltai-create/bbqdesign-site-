# EagleBuilt AI — changelog

The build stamp is bottom-right in the designer (`build YYYY-MM-DD · N`). If what
you see there is lower than **Latest** below, you are on a cached or older copy —
hard-reload with Ctrl+Shift+R.

| | Build |
|---|---|
| **Latest built** | 2026-09-22 · 76 |
| **Live on eaglebuilt.ai** | 2026-09-19 · 75 |

Deploy — from `C:\Users\johns\Eaglebuilt AI. Claude\eaglebuilt-site`:

```
npx wrangler deploy
```

About 8 seconds. `wrangler.toml` pins the Worker name `fragrant-butterfly-5c92`,
which is what keeps `eaglebuilt.ai` and `www.eaglebuilt.ai` attached — never
change it. Dashboard drag-and-drop of `Downloads\eaglebuilt-site-live` still
works as a fallback.

---

## 76 — 2026-09-22 · the 3D stopped looking like a schematic

A materials-and-shapes pass over the software renderer. No engine change: still
the same `FACES` painter pipeline, still no libraries.

**Materials.** Stainless was one colour and one shading response, which is why
door fronts read as white plastic. There are now four materials — brushed
(hoods, flanges), satin (door and drawer fronts), polished (handle tubes) and
matte — and the satin response deliberately throws almost no specular highlight.
Fronts dropped from `#E4EAF1` to `#C2CCD8`.

**Door fronts are built, not stacked.** A full-size plate with a grey rectangle
laid on top of it is two overlapping coplanar quads, and those can always trade
places in a painter sort — which is what tore the recesses and the fridge glass
into fragments. `pushBox` can now skip the face pointing a given way, so a front
is composed of a rim, four bevel bands and a centre that tile it exactly and
never overlap.

**The grill lid** is a superellipse rather than a half-cylinder, with a rolled
lip and a dark reveal underneath so it separates from the counter.

**The slab edge** carries a lit top arris and a shadow under the drip even when
the stamped edge is switched off.

**Lighting and ground.** Contact shadow is two passes for a soft edge, the grid
fades towards the edge of the pad in four alpha bands, and `lineJoin` is round —
tube end caps are fans with a repeated point, and mitre joins turned those into
spikes.

**`texAmt` was dead code** since it was written: computed per finish in
`buildScene` and never passed anywhere. It now drives the veneer grain, so
stucco is not as coarse as stacked stone.

**Cost:** about +20% frame time (~28 → ~34 ms for a 12.8 lf island at phone
size, warmed, median of three runs of 25). Most of it is the finer subdivision
of cabinet fronts, `lim` 26 → 12, scoped to LAYER 1 — that is what stops the
masonry behind a bay painting across its doors.

**Still open:** at steep overhead angles, individual veneer stones can still win
the sort against a cabinet front. Pre-existing and unchanged by this pass — it
is the painter's algorithm reaching its limit, and the fix is a depth buffer or
drawing courses as texture rather than as proud geometry.

---

## 2026-09-21 · fire pit, fireplace and backyard tools can send a design

**Deployed 2026-09-21.** Live on all three.

Those three tools priced a design and then had nowhere to put it. There was no
send path at all — no quote button, no lead form — so a visitor who built
something had to copy the spec to the clipboard and email it themselves. Only
the kitchen designer could actually deliver a lead.

Each now has a **Get my firm quote** button under the estimate. One tap: the
email and ZIP were taken at the gate, so nothing is retyped, which on a phone
is the difference between a lead and a bounce. It sends to Web3Forms (the
mailbox that already receives every other lead) and to the CRM through the
Worker, tagged `firepit_quote`, `fireplace_quote` or `yard_quote`.

The spec text each tool already built for "Copy spec" was living inside the
clipboard handler, so it was extracted into `specText()` and is now used for
both — the emailed lead carries the same itemized spec the customer can copy.

**Guarded against empty sends.** The backyard planner opens with no design and
a dash for a total; tapping send there would have produced a lead with nothing
in it. All three now refuse when the total has no digits in it.

Both posts are fire-and-forget and the button always reports success — a
budget proposal is not a transaction, and a failed POST must never read as a
broken tool. Web3Forms remains the copy that matters and is independent of the
CRM.

---

## 2026-09-21 · CRM merged in, email gate feeds it (site only — designer build unchanged)

**Deployed 2026-09-21, and live end to end.** The CRM runs at
`https://crm.eaglebuilt.ai` (Vercel, project `eaglebuilt-crm`) against Neon
Postgres. The Worker secrets are set, and a POST to `eaglebuilt.ai/api/leads`
with no key — what the browser actually sends — returns `{"ok":true}` and the
lead lands in the CRM. Designer signups now reach it automatically.

The CRM app (Next.js + Prisma, supplied as `eaglebuilt-crm.tar.gz`) now lives at
`crm/`. It is **not** part of the deployed Worker: `wrangler.toml` ships only
`./site`, and a Next.js server cannot run on a Worker at all. It goes to Vercel
on `crm.eaglebuilt.ai`, with Neon Postgres — see `crm/DEPLOY.md`.

Two changes on the site side:

- `src/worker.js` gained `/api/leads`, a proxy into the CRM's ingest endpoint.
  It exists because the email gate runs in the browser, so an API key placed
  there would be readable by every visitor. The key sits in the Worker as a
  secret instead and the gate posts same-origin — no key in page source, no
  CORS. Inert and harmless until `CRM_INGEST_URL` and `CRM_LEADS_API_KEY` are
  set; until then it answers `not configured` and makes no outbound call.
- All four designer gates (`app`, `firepit`, `fireplace`, `yard`) now POST to
  `/api/leads` as well as Web3Forms. **Web3Forms is untouched** — it remains the
  path that actually delivers leads to `info@`. The CRM post is additive, fire
  and forget, and a CRM outage cannot stop anyone opening the tool.
- The `/design/` landing gate posts too (`source: "design-landing"`), and the
  kitchen designer additionally reports a Quick Build save (`quick_build`) and
  a finished quote (`designer_quote`, carrying estimate, timeline, notes and
  spec). The fire pit, fireplace and backyard tools send the gate signup only.
  Those extra paths came from a parallel Grok bot session; the ZIP they sent
  was a placeholder `"00000"` where the visitor gave none, which would have put
  fabricated ZIPs in the field used for local pricing. Now passed through as
  given, empty when empty.

Four changes inside the CRM itself. Ingest required a ZIP, but the gate labels
ZIP optional, so every visitor who skipped it would have 400'd and been lost —
`zip` is now optional there and stores as `""`. The datasource moved from SQLite
to Postgres, because Vercel's filesystem is ephemeral and a SQLite file there is
wiped on every redeploy. And lead search is now explicitly case-insensitive:
Postgres `LIKE` is case-sensitive where SQLite's was not, so searching `sarah`
would otherwise have stopped matching `Sarah Chen`. And the CRM now refuses
to be indexed — `src/app/robots.ts` disallows every crawler and the root
layout sets `noindex`. It is a private back office on a public subdomain, and
TLS certificates for it are published to certificate transparency logs, so
"nothing links to it" was never going to keep it out of Google.

## 2026-09-19 · one form to start designing (site only — designer build unchanged)

**Deployed 2026-09-21**, together with the CRM wiring above.

`/design/` was asking for a ZIP, then the designer asked again for email + ZIP:
two forms back to back. Social traffic was producing 5–10 "ZIP lead" emails a day
and no finished designs. New `CONFIG.gate: "email"` on `site/design/index.html`
asks **ZIP + email once**, writes the designer's own `eb.designer.lead` key so the
designer opens straight in, and fires `designer_open` for GA4. The email that
arrives is now **"Kitchen designer opened — email (ZIP)"**, tagged
`opened the designer` — the same as the designer's own gate sends, so every
start carries a contact. The old "New design started — ZIP lead" email stops.
Hidden fields (name, phone, a default "1–3 months" timeline) are no longer sent.
FAQ schema answer updated to mention the email. People who go straight to
`/design/app/` (or the fire pit, fireplace, backyard tools) still see the
designer's own gate, which is unchanged.

**Email sanity check** — new `site/assets/emailcheck.js`, loaded by `/design/` and
all four tool gates. A likely typo (`gmial.com`, `yahoo.con`, any `*.con`) gets
"Did you mean …?" with a one-tap fix; a placeholder (`test@test.com`, `asdf@`,
`aaa@`, mailinator and other throwaway inboxes) gets one "use one you check"
message. Either way, pressing the button again with the same address goes
through — it never locks anyone out. Each page calls it only if the file
loaded, so the gates still work without it.

**Designer build 74 — EagleOne no longer talks on his own.** The voice greeting
used to play on the first tap anywhere in the designer; unrequested sound on a
phone from a social post reads as "close this page". EagleOne now speaks only
when the speaker button is pressed. The panel, its chips and the mic are unchanged.

**Designer build 75 — Quick Build.** John on his Android: "really hard to design
on phone", and most visitors start on one. Four tap screens, EagleOne asking:
shape (straight / L / U), length, what goes in it (grill always; side burner,
fridge, sink, pizza oven, griddle, trash pull-out, raised bar), and equipment
level (Value = Blaze, Premium = Fire Magic, Luxury = Lynx; sink and pizza oven
are Blaze in every kit, the Luxury fridge is Hestan because it is the only luxury
unit under the 34.5" underside). It then lays the island out and shows it in 3D
with a result bar docked underneath: total, equipment/build split, **Get my firm
quote** (opens the normal lead form with their gate email and ZIP pre-filled),
**Email it to me**, Change answers, Edit it myself.
- Layout rule: cooking units are separated by a drawer stack or the open counter
  run, so every one has 12" of landing (`fieldNotes()` passes). Prep (fridge,
  trash, sink) goes on the other side of the run, or on the L/U legs.
- Checked across all 6,912 combinations of shape × level × options × length: no
  fit warnings, no missing landing, no overlapping pieces, legs touch the run.
  When the picks do not fit the chosen length it builds longer and says so.
- Opens by itself on a phone (≤820px) with a fresh design. Not when they have an
  autosaved design, a `#d=` link or a `?add=` model link. Everywhere else it is
  the **Build it for me** chip on EagleOne. EagleOne folds to his tab on phones
  while it runs so the card does not cover the island.
- **Email it to me** sends a Web3Forms lead to `info@` — subject
  `Quick Build saved — email — $total — ZIP`, tagged `saved a quick build`, with
  the design link and full schedule — and mails the customer their copy with a
  picture through `/api/confirm` (which also BCCs `info@`, so expect two).
- The quote form now pre-fills email and ZIP from the gate everywhere, not just
  after Quick Build.

**Fix — L and U presets had floating legs.** `applyShape()` started the return
legs a full island depth below the main run's centre line instead of at its back
edge, leaving a 16" gap at every corner (visible in 2D and 3D). Legs now start at
`S.depth/2`, flush with the run's outer end. Affects the Quick Start L-Shape and
U-Shape buttons as well as Quick Build.

## 73 — 2026-09-15 · free consultation, local SEO, conversion tracking

**Free design consultation** at `/consultation/`, for people who would rather not
design it themselves (John: call back to qualify, then a site visit, a design
from the conversation, or designing it together). Name, phone and ZIP required;
then interest, best time to call, timeline and a budget band to qualify on the
call. Posts to Web3Forms tagged `consultation request`. Linked from the homepage
hero beside Start designing, `/design/`, the menu and footer on every page, and
the email gate on all four tools. Real submission confirmed delivered.

**Local SEO**, from a local-SEO audit:
- Schema claimed `areaServed: State of California`; now the seven towns served.
- Two pages declared the same `#business` and disagreed — one had no telephone.
- Name, address, hours and `sameAs` now match the Google listing: **EagleBuilt AI**
  (space — the listing slug `EagleBuilt+AI` settled it), **Granite Bay, CA 95746**,
  open 24 hours, linked by CID. City and ZIP only; no street or coordinates.
- The phone existed only inside the schema. NAP now in the footer of every page.
- Headline and title name Sacramento as the market; the address says Granite Bay.
- Map embed on `/contact/`.

**Conversion tracking** in `assets/track.js`, live with GA4 `G-1P2Q3CD8TZ`.
Counts `consultation`, `design_lead`, `designer_open` and `phone_click`, each
only after a confirmed success. Google Ads IDs still to add.

Two bugs of mine found in verification, both worth remembering:
- A replacement **string** eats `$$`, so inserting the opening hours turned
  `priceRange` from `$$-$$$` into `$-$$`. Use a replacement function.
- **A CSP wildcard matches subdomains, never the bare host.** `*.analytics.google.com`
  does not admit `analytics.google.com` — where GA4 sends page views — so the
  tag ran, looked installed, and had its main hit blocked. Found only by reading
  the browser console after deploy.

## 72 — 2026-09-07 · the raised bar had no knee room

John, from the 3D view: *"raised bar shows no over hang should be 12 inches?"*

The bar cap was padded by the counter overhang, 1.5" all round, so there was
nowhere to put your legs. It is now **1" splash + 6" block + 12" overhang =
19" of cap**, padded per side rather than uniformly.

That changed what `bar.depth` means. The tool modelled the bar as a single flush
overhang poured monolithic with no block under it, so `depth` was the whole
cantilever; it is now the block, with `oh` the cantilever. The label, the spec
sheet and the build guidance all had to move with it, or they print the block
where the overhang belongs.

Two things fell out of it:

- **The share-code decoder rebuilt `S.bar` from scratch** and kept only the keys
  in the code, so the knee overhang was silently dropped on every restored or
  shared design — right on a fresh island, gone the moment anyone reopened a
  saved one.
- **A bar design costs more than it did**, correctly. The cap went 15" to 19"
  and a test design went 42.7 to 46.1 sq ft. That overhang is real poured slab
  and should always have been in the number.

Also in 72: corner radii on the countertop are built, tested and priced, but the
control is **hidden**. The plan view rounds and measures the slab properly —
traced into a polygon so a rasterised arc is never measured as a staircase,
which runs 27% long — while elevation and 3D still draw square corners. Showing
a control while two of three views disagree just looks broken.

## 71 — 2026-09-06 · seven brands you could not reach, and a covered title block

Both found by John using it.

- **Seven of the eleven brands were unreachable.** The brand bar was
  `overflow-x:auto` with the scrollbar deliberately hidden — 799px of tabs in a
  269px column, four visible, and nothing on screen saying the rest existed. A
  vertical mouse wheel does not scroll a horizontal bar, so on a desktop with a
  plain mouse Alfresco, DCS, Fire Magic, Hestan, Lynx, Twin Eagles and Summerset
  simply did not exist. The bar now wraps: eleven tabs, four rows, all visible.
  Choosing the brand is step one of the tool.
- **The bottom-right chips lay across the title block.** The plan draws it at
  `CH-108` to `CH-16`; the chips sat at `bottom:10px` and covered the last 22px
  — exactly the scale and date row. They now lift 118px clear whenever the block
  is drawn, and drop back in 3D and elevation where there is none.
- The build stamp said `2026-08-29 · 69` while the changelog claimed 71 was
  live. Mine, and now corrected.

## 71 — 2026-09-06 · backyard planner listed, and a real nav menu

**The planner is public.** Its own section on `/design/`, a footer link on all
ten pages, and an entry in `llms.txt`. A demo video sits behind a "Watch demo"
button on the planner itself — youtube-nocookie, and the iframe has no src until
someone clicks, so the page never contacts Google for a visitor who does not
watch.

The tool page itself **stays noindex**, matching `/design/app/`. A full-screen
canvas app is thin content that would rank badly; `/design/` is the indexable
page that carries the words. For the same reason it is not in the sitemap — a
sitemap listing a noindex page is a contradiction, and that was flagged in a
previous SEO audit.

**A Menu dropdown in the header**, on every page. Built on `<details>` so it
works on touch with no JavaScript. Groups the two design tools, the reference
pages and the company pages.

This also fixed something that had been broken since launch: the header links
carry `hideSm`, which hides them under 760px, so **a phone had no navigation at
all** beyond the CTA. Now it has all of it.

Fixed on the way: at 375px the wordmark, the Menu button and the CTA did not fit
on one line and the Menu button sat on top of the "AI". Under 560px the wordmark
drops and the emblem carries the brand.

---

## preview — 2026-09-06 · fix: a curve could be poured outside the yard

From John using it. Two clamps were missing on the edge bows, both mine:

- **Outward, nothing held the pour inside the yard.** A bottom edge bowed 150"
  put the outline 130" past the property line — nearly eleven feet of concrete
  outside the lot, priced as if it were fine. Bows now stop exactly at the
  boundary, and moving a bowed patio respects its overhang too, which the move
  clamp had also ignored.
- **Inward, each edge was clamped on its own**, so both sides could bow in until
  the patio was a 12" neck. An edge now has to leave room for whatever its
  opposite has already taken, with a 24" floor.

---

## preview — 2026-09-06 · true radii in the backyard planner

The second curve case, and the one that gets staked. A patio now carries
`r = [TL, TR, BR, BL]` alongside the edge bows. Green squares at the corners
pull a real radius; the **centre point is drawn with a cross, and the corner is
labelled `R 4' · 6'3" arc`** — so a crew can pull a tape to the centre and mark
it, which is the whole point of a radius as against a bow.

Radii and bows compose: an edge with a radius at each end runs between the
tangent points and can still bow in the middle.

Checked against exact geometry — a 36" corner takes `r²(1 - π/4)` off the area
and swaps `2r` of straight for `πr/2` of arc. Four of them on a 20 x 12 gives
232.158 sq ft against 232.274 true, and the arc length is exact. Straightening
everything returns exactly 240.000.

Fixed during the build: the radius clamp did not converge. It subtracted half
the overshoot per edge and walked around the four edges, so one absurd radius
came out at 381" on a 144" side instead of capping at 72". Now each radius is
capped at half the short side first, then any pair sharing an edge is scaled
proportionally.

---

## preview — 2026-09-06 · curved patio edges in the backyard planner

First half of the curve work. A patio now carries `cv = [top, right, bottom,
left]` — how far each edge bows out in inches. Four dots appear on the selected
patio; pull one and the edge curves, double-click it to straighten. John marks
these on the ground with upside-down paint and adjusts by eye, so they are
dragged, never typed.

**Area and perimeter come from the same flattened outline the canvas draws**, so
a curve cannot price differently from how it looks. Checked against the exact
parabolic answer: a 24" bow on a 20 ft edge computes 266.58 sq ft against 266.67
true — 0.03% from the 18-step flattening. An untouched patio flattens to exactly
w x d, so nothing that was straight moved by a cent.

Bulges snap to 3" and are stopped from folding the shape through itself.

**Still to do on curves:** the true radius case — centre point, R value and
sweep, annotated so it can be staked — and carrying all of this to the kitchen
countertop and raised bar. This half covers the serpentine, freeform edge, which
is what most of the hardscape drawings actually are.

---

## 70 — 2026-09-04 · every tool now asks for an email to open

John: *"I think we need to capture a email to start design."* An overlay on the
kitchen designer takes **email (required) and ZIP (optional)**, then opens the
tool. Stored under `eb.designer.lead` so a returning visitor is never asked
again, and POSTed to the same Web3Forms key the quote form already uses, tagged
`lead_stage: "opened the designer"` so it is distinguishable from a finished
design lead.

Deliberately no verification code: an emailed code means leaving the page and
coming back, which on a phone in a backyard is where people quit. Easy to add if
the address quality turns out to be poor.

The visitor is let in whatever the network does — the POST is fire-and-forget and
a blocked-storage browser still gets through, it just gets asked again next time.
A failed lead POST must never read as a broken tool.

**Copy across the site had to move with it.** "Free, no sign-up" was printed on
the homepage, `/cost/`, `/projects/`, `/design/` (three places), the
CMU-vs-steel-stud guide and `llms.txt`, and `/contact/` called the tool
"unrestricted". All nine now say the tool is free and that an email opens it —
**free and no-sign-up are different claims**, and only the second one stopped
being true.

**All four tools carry it** — kitchen, fire pit, fireplace and backyard planner
(John: *"ok same for all"*). One shared storage key across the site, so a
visitor is asked once and every tool opens after that. The lead names which tool
they opened, so a fireplace enquiry is distinguishable from a kitchen one at a
glance.

---

## preview — 2026-09-04 · fix: "No chimney" was making the chimney wider

John, from using it: *"when I tap no chimney it makes the chimney wider?"*
Exactly right, and it was my bug.

Removing the chase left the overall height alone, so the region that had been a
48" chase simply became 60" of full-width body, and the cap grew from 54" to 66"
to sit on it. Same height, wider top — the opposite of what the button says.

**No chimney now makes the fireplace shorter.** The overall height drops onto
what the body was, so a 5' x 8' with a chase becomes a 5' x 5'10" flat-capped
box — the massing in the real builds.

Both the height and the mantel are remembered while the chimney is off, so
putting it back is exact. Without that, toggling twice left the fireplace 6"
taller and $500 dearer each round trip, and quietly walked the mantel down 3"
every time, because the shorter body clamps it and the clamp used to stick.

---

## preview — 2026-09-04 · fireplace: optional chimney, size-scaled base

- **The chimney is optional.** A vent-free box has nothing to vent, so the chase
  is there for the look or to carry a TV. Without one the body runs full height
  and is capped flat across its full width — the massing in John's white-painted
  and reclaimed-brick builds. Overall height now goes down to 5 ft, since a
  chimney-less fireplace is a much shorter object.
- **The base scales with size.** John: *"use a percentage of growth to fireplace,
  20% bigger the price goes up 20%."* $8,000 buys a **5' x 8' starting size**;
  the base is that times (size / 80 sq ft), floored at $8,000 because a starting
  size does not go cheaper. Size is the three-sided envelope,
  `(width + 2 x depth) x height`. The tool had been quoting a flat $8,000 for a
  12-footer.

The resulting curve puts **5' x 8' at $8,000 and 7' x 10' at $12,000** — exactly
John's stated range, from a rule that was never fitted to it.

Fixed on the way: the first cut measured the real stepped face including the
narrower chase, so the starting size came out as 95% of itself and an extra foot
of width read as 2% growth. Size is now the plain envelope, which is also what
"20% bigger" means to anyone reading it.

`PRICING.md` also corrects a superseded inference of mine: the $8k-$12k range
was explained there as 27 lf of seat wall. It is size, with seat wall added on
top — which is why a loaded fireplace exceeds $12,000 quite legitimately.

---

## preview — 2026-09-04 · fireplace: shoulder at the mantel, real stone pricing

Both from John looking at the first build.

- **The shoulder is no longer its own number.** The mass steps back to the chase
  AT the mantel, which is how he builds it — the mantel caps the body and the
  chimney carries on above it, narrower. The slider is gone while a mantel is on.
  (`mantelY` now clamps against the overall height rather than the shoulder, or
  the two would define each other in a circle.)
- **Stone is priced, not deferred.** $35/sq ft manufactured (Eldorado type),
  $50/sq ft natural or cut veneer. **Three sides — front and both returns. The
  back is stucco**, so it never counts, and neither does the firebox opening.

John's sanity check on the area: *"6 ft wide, 2 ft deep, around 70 sq ft."* The
tool computes 70 sq ft for exactly that at 8'6" tall. His estimate and the
geometry agree, which is the second time his numbers from memory have matched
the model — see the 17.5 lf island at 2.1%.

Stone therefore sits above the $8,000-$12,000 range, which describes stucco.

---

## preview — 2026-09-03 · fireplace designer (new)

Fourth tool, at `/design/fireplace/`. Unlisted like the other two previews.

Elevation, plan and 3D. **Elevation is the default**, because a fireplace is a
stack of heights off grade and that is the one drawing it gets built from. The
3D is **isometric rather than an orbit camera** — nothing to get lost in,
parallel edges stay parallel so it still reads as a drawing, and boxes sort by
depth with no camera plane for corners to flip past.

Controls: firebox opening, body and chase, hearth height and projection, mantel,
stucco or stone, seat wall left and right, extended hearth, back wall, wood
storage, outlets, TV.

Priced on John's confirmed numbers — $8,000 base (firebox, chase, stucco,
hearth), $150/lf for seat wall, extended hearth and back wall, $1,000 wood box,
$135 an outlet. **Stone reads "quote add"**, not a number, because the rate is
not set. The log set and the TV always print as by owner even at $0: silence
about who buys what is where the argument starts.

Fixed during the build, all three found by looking at it rather than reading it:
the opening dimension landed on the mantel band; the plan's hearth label was
dark text on a dark chip; the firebox was painted after the whole sorted set, so
it sat on top of the hearth in front of it. Left-hand dimensions also clipped
off-canvas once seat walls widened the span.

---

## preview — 2026-09-03 · fire pit: plan, elevation, budget caveat, burner

- **Plan and elevation views**, joining 3D in the switcher top-right — the same
  three the kitchen designer has had. The orbit view reads as a picture but
  badly as an instruction: a low box seen at an angle hides the inside opening,
  which is the dimension the block actually gets laid to. Plan gives outside,
  opening and over-cap; elevation gives course heights, cap thickness and
  finished height off grade. Both carry the finish colours and a note block, so
  the drawing and the render can never disagree.
- Fixed on the way: the dimension chip was written at the tail of the 3D path,
  so the two new views left it showing the previous shape.

Fire pit designer only — still unlisted, and the kitchen designer is untouched
at build 69.

- **The estimate now says it is a budget proposal**, on screen under the total
  and in the copied spec. The spec matters more: that text gets pasted into
  emails and travels without you. It was printing a total with no qualifier at
  all, which invites being read as a firm quote.
- **Burner, pan and igniter is now a stated line**, defaulting to *by owner* —
  the homeowner picks and buys it, EagleBuilt sets and connects it, no discount
  for supplying your own. "EagleBuilt supplies" reads *quote add* rather than a
  guessed number, since size and brand move it too much. The line prints even
  when it costs nothing, because silence about who buys the burner is where the
  argument starts.

Both came out of the first job designed in the tool and built: a 17.5 lf island
at $10,000 plus a $4,000 fire pit, where the customer bought the valve, pan,
burner and igniter. The tool had priced that island within 2.1%.

---

## 66 — 2026-08-25 · automatic confirmation email

- **The customer now gets a real email** when they send a design — from
  `info@eaglebuilt.ai`, with their design link, the estimate, licence and phone.
  Sent via **Resend**, which required verifying `eaglebuilt.ai` (DKIM + a `send.`
  subdomain for SPF, so the existing Cloudflare root SPF was left alone).
- Added `src/worker.js` with a single `/api/confirm` endpoint. The site was
  previously assets-only. **Static files are still served before the script
  runs**, so a fault in the worker cannot take the website down.
- Deliberately narrow: only ever mails the address the form collected, only ever
  the fixed template, and the design link must be an `eaglebuilt.ai` URL.
- The browser call is **fire-and-forget** — the lead reaches Web3Forms first and
  a failed confirmation can never surface as a failed lead.
- Resend API key lives in Cloudflare's secret store, not in source.

## 65 — 2026-08-24 · the customer keeps their design

- **Success screen now gives the customer their design link**, with *Copy link*
  and *Email it to me* buttons. Previously they submitted and left with nothing.
  Web3Forms' auto-responder is a Pro feature; this covers most of it for free.

## 64 — 2026-08-23 · readable lead emails

- **Lead subject lines** now read `New design — {name} — {estimate} — {zip}`,
  prefixed `[PARTNER]` when the job is under the island minimum. Leads can be
  triaged from the inbox list without opening anything.
- **Fixed truncation** in the emailed spec — the construction line was cut at 44
  characters, so `stucco finish` arrived as `stucc`. Column widened to match the
  64-character rule and the label shortened.

## 57–63 — 2026-08-23 · steel stud

- **Second frame: steel stud**, $3,300 setup + $200/lf. Same fixed setup as CMU
  (standing the wall is what's cheaper, not the mobilisation), so the saving
  lands in the per-foot rate. CMU remains the default.
- **Structure selector** added to the panel. `S.frame` had been stored and
  serialised since before this session but had no UI at all — it was scaffolding
  with a single CMU entry.
- **Live weight readout** under the selector, with a warning above 50 psf. CMU
  with a poured top is ~156 psf against a residential deck's ~50. Steel stud with
  a 3" poured top is still 55 — over — so the deck case needs a 2" pour (43) or
  3cm stone (34).
- **2" color concrete** countertop added for exactly that case.
- Quote line, spec and share code all follow the frame.

## 53–56 — 2026-08-23 · slab thickness follows the countertop

- **Fixed a live bug.** Slab thickness was hard-coded at 3" in eleven places, so
  choosing granite changed the colour and nothing else. Head-room is finished
  height minus slab, so the underside always read 34.5" — and the Alfresco
  kegerator, needing a 35" opening, was rejected on designs where it fits.
- Thickness is now a property of the countertop. Finished height is what's held,
  so a thinner top means a taller wall and a **larger** opening: 3cm stone puts
  the underside at 36¼".
- Spec prints **"Build wall to: X underside"** — the number the mason works to.
- Porcelain tile confirmed at 1.5" (tile over cement board, not over a poured top).

## 50–52 — 2026-08-23 · island pricing rebuilt

- **Fixed cost plus per-foot, replacing a flat rate.** $3,300 + $275/lf, with a
  **$6,000 minimum**. Reason: the trip, layout, shoring, pour setup and cleanup
  are the same work at 8 feet as at 12, so a flat $/lf underpriced every small
  job. Gives $688/lf at 8 ft, $550/lf at 12 ft — big-island pricing unchanged.
- Deliberately **not** a tier: a tier would have made a 12-footer cheaper than a
  10-footer.
- **Large equipment mount now starts at 12 lf** (was an unverified assumption of 10).
- **Partner handoff flag** in leads under the minimum.
- `/cost/` page and its FAQ structured data updated to match — it had advertised
  a flat $550/lf in five places.

## 47–49 — 2026-08-23 · info@eaglebuilt.ai

- Address switched across the designer, contact and partners pages.
- Corrected a misleading comment claiming `leadEmail` controlled delivery. It
  doesn't — Web3Forms decides that, keyed to the access key.
- Phone added: (916) 751-1429, in the contact card and homepage structured data.

## 40–46 — 2026-08-23 · customer-supplied equipment

- **"Supplied by: Us / Them"** on any piece. Owner-furnished gear leaves the
  equipment quote but keeps all build labor — framing, gas, mounting — and stays
  in the drawings and bay schedule.
- **Customer Supplied** catalog group with editable W × H × D for gear not in the
  catalog. Typed cutouts reach the plan, elevation, 3D and fit warnings.
- **Equipment list paste/upload** — matches model numbers, brand + size and bare
  descriptions; anything unrecognised becomes a labelled placeholder.
- **On-site note**: their equipment on site before the build starts, or its full
  cutout confirmed, with a count of items still missing dimensions.
- Fixed `parseLen` reading `42 1/2"` as **2 inches** — since cutout fields display
  as `30 5/8"`, clicking through one would silently rewrite it.

## 37–39 — 2026-08-20 · wok and tabletop oven

- **Wok burners** — five wok-capable power burners renamed and recategorised so
  they're findable.
- **Tabletop pizza oven and countertop wok** on a new `counter` mount: sits on the
  slab, no cutout, full head-room beneath, drawn dashed in elevation because
  there's nothing to frame.
