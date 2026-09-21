# EagleBuilt AI — social ad kit

Fifteen ready-to-upload PNGs in `out/`. Five concepts × three sizes, rendered at
exact pixel dimensions, no upscaling.

**This folder is outside `site/` on purpose** — `npx wrangler deploy` only ships
`site/`, so nothing here can reach eaglebuilt.ai by accident.

| Size | File suffix | Where it goes |
|---|---|---|
| 1080 × 1080 | `-square` | Facebook feed, Instagram feed, Google Business post |
| 1080 × 1350 | `-portrait` | Instagram feed (takes the most screen — best organic reach) |
| 1080 × 1920 | `-story` | Instagram / Facebook Stories, Reels cover |

The story files keep the bottom ~300 px clear because Instagram puts its own
buttons there.

---

## Concept A — `tool` · the 3D designer

The scroll-stopper. Nobody expects a contractor to hand them software.
**Send it to `eaglebuilt.ai/design/`.**

> **Primary text**
>
> Most people start an outdoor kitchen with a Pinterest board and end up with a
> number they did not expect.
>
> Start with the island instead. Our free 3D tool lets you drop in the exact
> grill you want — real cutout sizes from ten manufacturers — and watch the
> price move as you build. About five minutes, in your browser, nothing to
> install.
>
> Then we come build it. Sacramento and the foothills, 36 years.

- **Headline:** Design your outdoor kitchen in 3D
- **Description:** Free · Real grill cutouts · Live pricing
- **Button:** Learn More

> **Organic caption (shorter)**
>
> Design your outdoor kitchen in 3D before anyone quotes you. Free tool, real
> grill cutouts, price updates as you build. Link in bio. 🦅
>
> #outdoorkitchen #bbqisland #sacramento #roseville #folsom #granitebay
> #eldoradohills #outdoorliving #backyarddesign #concretecountertops

---

## Concept B — `craft` · real block, real concrete

Trust and differentiation. This is the one that separates you from the pallet
kits. **Send it to `eaglebuilt.ai/projects/`.**

> **Primary text**
>
> There are two ways to build an outdoor kitchen.
>
> One shows up on a pallet. The other gets laid in block, veneered in stone, and
> topped with a countertop poured on site — so it is still standing, and still
> flat, in twenty years.
>
> We have been doing it the second way for 36 years. Roseville, Rocklin, Folsom,
> Granite Bay, El Dorado Hills, Serrano, Rescue.
>
> Come look at the work.

- **Headline:** Built in block and poured concrete
- **Description:** CSLB #992251 · GC & C-29 Masonry
- **Button:** Learn More

> **Organic caption**
>
> Block, stone, and a countertop poured on site. Not a kit. 36 years of these in
> the Sacramento foothills.
>
> #masonry #outdoorkitchen #concretecountertop #sacramentocontractor #roseville
> #rocklin #folsom #custombuild #bbqisland

---

## Concept C — `cost` · the question everyone asks

Highest engagement of the three — the price question is the one people actually
click. **Send it to `eaglebuilt.ai/cost/`.**

> **Primary text**
>
> "What does an outdoor kitchen cost?" is the first question everyone asks and
> the last one anybody answers.
>
> Honest version: it comes down to the grill you pick and how long the island
> is. So we built a free tool that prices it as you draw it — equipment and
> construction quoted separately, so you can see exactly what moving up a grill
> tier costs you.
>
> No guessing, no salesman in your kitchen.

- **Headline:** See what your island actually costs
- **Description:** Free 3D designer · Sacramento area
- **Button:** Learn More

> **Organic caption**
>
> The honest answer to "what does an outdoor kitchen cost?" — price it yourself,
> free, before you call anyone.
>
> #outdoorkitchencost #bbqisland #outdoorkitchen #sacramento #placercounty
> #eldoradohills #backyardproject #homeimprovement

---

## Concept D — `firepit` · fall

Seasonal — run it September through November, then pull it. Amber accent instead
of blue, because the blue chip fought the firelight.
**Send it to `eaglebuilt.ai/design/firepit/`.**

> **Primary text**
>
> The backyard does not close in October. It gets better.
>
> A fire pit is the cheapest square foot of outdoor living you will ever build,
> and the one people actually sit at. Gas or wood, stone or smooth stucco, with
> a seat wall wrapping around it so nobody is dragging chairs over.
>
> Design yours free in about three minutes — then we pour it.
>
> Sacramento and the foothills, 36 years.

- **Headline:** Fire pit weather is here
- **Description:** Free designer · Sacramento area
- **Button:** Learn More

> **Organic caption**
>
> Fall is the whole reason to build one. Gas or wood, seat wall around it, lit
> by dinner. Design yours free at eaglebuilt.ai
>
> #firepit #outdoorliving #sacramento #roseville #folsom #granitebay
> #eldoradohills #backyarddesign #masonry #fallnights

**Check this one before you post it:** the creative says *"lit before the
holidays."* That is a scheduling promise. If your fall calendar is already
tight, change the `sub` line for `firepit` in `ad.html` — one string — and
re-render.

---

## Concept E — `fireplace` · the outdoor room

Same season as the fire pit and the bigger ticket, so run them together: fire pit
wide at the top, fireplace retargeted to people who opened the designer.
**Send it to `eaglebuilt.ai/design/fireplace/`.**

> **Primary text**
>
> A fire pit gets people outside. A fireplace keeps them there.
>
> It is a wall, a hearth at seat height, and a firebox clad in whatever the
> house is already wearing — stone, brick or stucco. Built right it turns a
> patio into a room you use in November, not just in July.
>
> Design yours free, or send a photo of the wall and we will tell you what it
> takes.
>
> Sacramento and the foothills, 36 years.

- **Headline:** An outdoor room you use in winter
- **Description:** Free fireplace designer · Sacramento area
- **Button:** Learn More

> **Organic caption**
>
> A fire pit gets people outside. A fireplace keeps them there. Stone, brick or
> stucco, seat walls at hearth height. Design yours free at eaglebuilt.ai
>
> #outdoorfireplace #outdoorliving #sacramento #roseville #folsom #granitebay
> #eldoradohills #masonry #patiodesign #outdoorkitchen

**Why the copy says "firebox clad in":** that is what you actually build, and it
avoids claiming a true masonry firebox. The California rule behind that is a
genuinely strong content angle — most search results assume a real masonry
firebox — but it stays out of paid copy until you confirm which rule applies.

**On the photo:** `masonry-fireplace.jpg` is 750 px wide, the largest fireplace
shot you have, so the story crop upscales about 3×. It holds at phone size but
it is the softest of the five. A new photo of a lit fireplace at dusk would beat
every creative in this kit.

---

## Reel — `consultation` · the free design consultation

`out/eaglebuilt-consultation-reel.mp4` — 1080 × 1920, 30 fps, 21 s, H.264, **no
audio** (add a trending track inside Instagram — licensed in-app, and it helps
reach). `eaglebuilt-consultation-cover.png` is the cover frame; the `step1–3`
and `end` PNGs work as a carousel or as Stories on their own.
**Send it to `eaglebuilt.ai/consultation/`.**

| Time | On screen |
|---|---|
| 0–3.4 s | *Rather not design it yourself?* — the hook, for people the 3D tool does not reach |
| 3.4–6.8 s | *Book a free design consultation.* |
| 6.8–10 s | Step 1 · *We call you back.* |
| 10–13.2 s | Step 2 · *We pick the next step* — site visit, sketch, or design it together in 3D |
| 13.2–16.4 s | Step 3 · *You get a design and a budget.* |
| 16.4–21 s | End card — eaglebuilt.ai/consultation, (949) 564-1948, CSLB |

> **Caption**
>
> Want an outdoor kitchen but don't want to design it yourself? Book a free
> design consultation. We call you back, figure out the right next step, and
> you get a design and an itemized budget before anyone breaks ground. Free, no
> obligation. Link in bio or call (949) 564-1948. 🦅
>
> #outdoorkitchen #bbqisland #sacramento #roseville #folsom #granitebay
> #eldoradohills #backyarddesign #outdoorliving #designconsultation

- **Headline (paid):** Book a free design consultation
- **Description:** We call you back · Sacramento area
- **Button:** Book Now
- **Judge on:** `consultation` conversions in `track.js`, not views

Copy and timing live in the `SCENES` array in `reel.html`. Preview it at any
moment with `reel.html?t=8.6` (it must be served — see below). Re-record with:

```
cd "C:\Users\johns\Eaglebuilt AI. Claude\eaglebuilt-site\ads"
node record-reel.mjs
```

It records in real time (~40 s total) using your installed Chrome — no ffmpeg.
The log line `recorded 630 frames … N late` should show only a few late
frames; if it shows hundreds, the video comes out longer than 21 s.

---

## If you run these as paid

- **Geo:** 20–25 mile radius on Roseville / Folsom / Granite Bay, not "California"
- **Age:** 35–65, homeowners
- **Interests:** home improvement, grilling & BBQ, Traeger / Weber / Blackstone,
  swimming pools, landscaping
- **Placements:** Advantage+ is fine — that is why there are three sizes
- **Budget:** $10–20/day per concept for seven days, then keep the winner
- **Judge on:** designer opens (the email gate fires a lead), not likes

Point ads at `/design/` or `/cost/` — never the homepage. And per the earlier
note, hold the Google Ads spend until the Business Profile has reviews.

---

## Re-rendering

```
cd "C:\Users\johns\Eaglebuilt AI. Claude\eaglebuilt-site\ads"
./render.sh              # all five concepts
./render.sh fireplace    # just one
```

Copy, photos and layout all live in `ad.html` — the `CONCEPTS` object near the
bottom is the only thing you need to touch to add another. Set `warm: true`
on it for the amber treatment. Preview one in a
browser with `ad.html?c=cost&s=story`.
