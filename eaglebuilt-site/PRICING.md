# EagleBuilt AI — rate card

> **Everything the platform produces is a BUDGET PROPOSAL, not a quote.**
> Final pricing is subject to a site visit. John's words, 2026-08-28 — you cannot
> price a backyard you have not stood in: access, grade, existing conditions and
> utilities all move the number. The tool should say "budget proposal"
> throughout, never "firm price".

The single source of truth for what the designer quotes. Anything marked
**NEEDED** is a gap that stops the tool quoting that item — it can draw it, but
it can't price it.

Rule that keeps showing up: **a fixed minimum, then a rate above it.** The setup
work — trip, layout, forming, pour, cleanup — doesn't scale down, so small jobs
carry a floor. Applied to islands, firepits and now concrete.

---

## Outdoor kitchen island — CONFIRMED

| | |
|---|---|
| CMU block | $3,300 setup + $275/lf |
| Steel stud | $3,300 setup + $200/lf |
| Minimum (either frame) | $6,000 |

Effective rate: $688/lf at 8 ft, $550/lf at 12 ft, $481/lf at 16 ft.
Steel stud is for wood decks and tight spots — CMU is the default.

| Item | Rate |
|---|---|
| Raised bar | $150/lf |
| Low bar cantilever | $100/lf |
| Stone veneer | $35/sq ft |
| Paint stucco | $10/lf |
| Electrical outlet | $135 ea |
| Sink install | $350 ea |
| Gas flex line | $40 ea |
| Mount equipment | $400 small / $600 at 12 lf+ |
| Debris haul-off | $200 |

Countertop thickness drives the wall height — finished height is held at 37.5",
so a thinner top means a taller wall: 3" poured concrete, 2" poured, 1¼" stone
(3cm), 1½" porcelain tile over cement board.

---

## Fire pit — CONFIRMED

```
max($3,250, perimeter_ft × $150)
```

Includes 6" CMU 2 courses (16"), 3" poured colour concrete cap, key valve,
stucco. 19" finished — seat height. Round or square, same price at 5 ft.

**$150/lf is the universal masonry perimeter rate** — it applies to fire pit
perimeter in every shape John builds (round, square, rectangular, linear) and to
seat walls. Round measures circumference, the rest measure four sides, so a 5 ft
square (20 lf) prices above a 5 ft round (15.7 lf) once past the minimum.

| Item | Rate |
|---|---|
| Stone veneer | $35/sq ft of exterior face |
| Gas line supply | $20/lf (or by others) |
| Seat wall, stucco + concrete cap | $150/lf |

Cap overhang: 1½" on stucco, 3" on stone to clear the veneer.

---

## Decorative concrete — CONFIRMED

```
max($2,500, sq ft × rate)      rate by finish, below
+ placement per pour: $600 first truck, +$300 each additional  (9 yards/truck)
```

**Placement always applies** (confirmed). Backyard access is nearly always the
constraint — and where a pump won't fit, the concrete gets wheelbarrowed, which
costs about the same. Call it **"concrete placement"** on the quote, not "pump":
a homeowner who never saw a pump would query a pump charge.

**$2,500 is a floor** (confirmed) — a 120 sq ft landing is $2,500, not $1,800.
Same pattern as the island's $6,000 and the firepit's $3,250: the setup does not
scale down. The floor bites below about 165 sq ft at $15, or 125 sq ft at $20.

**Slab: 3.5"–4" thick** over **compacted subgrade, base rock and crushed rock
fill** — the site work is in the sq ft rate, not extra. Worth calling out on the
quote; it is exactly what a cheap bid leaves out.

Yardage = sq ft × thickness ÷ 324, so at 4" a slab is roughly sq ft ÷ 81 cubic
yards; at 3.5", sq ft ÷ 93.

**Finish drives the rate** (colour and finish, sometimes two colours needing two
separate pours). Confirmed by John, 2026-09-07 — *"yes thats good to go"*:

### Decorative finish adders (John, 2026-09-06/07)

| Adder | Rate | Note |
|---|---|---|
| Acid stain | **+$5/sq ft** | Sealer included. Acid stain has to be sealed, so it is not optional and not billed apart. |
| Hand seed | **+$3/sq ft** | Seeded aggregate, hand seeded |
| Saw cut | **+$3/LINEAR ft** | Cut joints. NOT per sq ft. |
| Salt finish | **$0** | Standard pricing, inside the base rate |

**Saw cut is billed by the foot of cut, not by area** — the one that is easy to
get wrong, and was, on 2026-09-06. Cuts run both ways on a grid, so a 30 x 20 ft
patio on a 5 ft grid is:

```
floor(30/5) - 1 = 5 cuts x 20 ft = 100 lf
floor(20/5) - 1 = 3 cuts x 30 ft =  90 lf
                                   190 lf x $3 = $570
```

Charged by the square foot that same patio came to $1,800 — **more than three
times over**. The planner now computes the linear feet from a grid spacing.

The saw cutting sits **outside** the $2,500 concrete minimum: the minimum covers
getting a pour to the site, the cutting is separate labour on top.

| Finish | Rate |
|---|---|
| Broom, one colour | $15/sq ft |
| Stamped, one colour | $18/sq ft |
| Stamped, two colours / two pours | $20/sq ft |

**The pump is charged per pour** (confirmed). A two-colour job is two separate
pours, so it pays the pump twice — $600 minimum each time, before the extra-truck
charges. On a small patio that costs more than the per-foot difference does:

| 600 sq ft | Concrete | Pump | Total |
|---|---|---|---|
| Stamped, one colour | $10,800 | $600 | **$11,400** |
| Stamped, two colours | $12,000 | $1,200 | **$13,200** |

Still open: whether seeded aggregate, salt finish, acid stain or saw-cut patterns
are separate options with their own rates.

| Patio | Yards @ 4" | Trucks | Pump |
|---|---|---|---|
| 300 sq ft | 3.7 | 1 | $600 |
| 600 sq ft | 7.4 | 1 | $600 |
| 900 sq ft | 11.1 | 2 | $900 |
| 1,500 sq ft | 18.5 | 3 | $1,200 |

**NEEDED:**
- **What moves $15 → $20?** Broom vs stamped, colour count, pattern? The tool
  needs the actual choices, not a range — a range isn't a quote.
- **Is $2,500 a floor** (everything under ~150 sq ft costs $2,500)?
- **Is the pump always needed**, or a toggle for jobs that can chute off the truck?

---

## Pavers — MOSTLY CONFIRMED

```
max($2,500, sq ft × rate)      same floor as concrete
+ banding      $25/lf
+ steps        line item — see below
```

The **$17–26/sq ft** spread is driven by three things John named: **paver
selection, laying pattern, and a difficulty factor** — sometimes pallets have to
be moved to the back yard by hand, which is the paver equivalent of the concrete
placement charge.

Confirmed by John, 2026-09-06 — *"Paver pricing is good"*:

| | |
|---|---|
| Paver — standard | $17/sq ft |
| Paver — premium | $21/sq ft |
| Pattern — running bond | +$0 |
| Pattern — herringbone (more cuts) | +$2 |
| Pattern — circle / custom | +$3 |
| Access — machine to the back | +$0 |
| Access — hand-carried pallets | +$2 |

Floor $17 = standard, simple, good access. Ceiling $26 = premium, custom,
hand-carried. Worth sanity-checking the hand-carry adder — on a small patio
there is less area to spread that labour across.

**Steps: $40/lf** of tread — measured as **number of steps × width**. John's
example: 4 steps at 4 ft wide = 16 lf = **$640**. They are their own line item
because paver steps need concrete underneath, so the surface rate does not cover
them; the $40/lf is the step complete, substructure included.

---

## Fireplace — MOSTLY CONFIRMED

**Range $8,000–$12,000**, driven by how much seat wall, hearth and back wall come
with it. That decomposes onto the same universal perimeter rate:

```
$8,000 base        5' x 8' STARTING SIZE - firebox, chase, STUCCO, hearth
                   scales linearly with size, see below
+ $150/lf          seat wall / extended hearth / back wall
+ $35/sq ft        manufactured stone veneer (Eldorado type), THREE SIDES
+ $50/sq ft        natural stone or cut veneer, THREE SIDES
+ $1,000 each      wood storage box
+ $135 each        electrical outlet (a TV niche needs one)
```

**Owner-furnished:** the log set or the metal insert, and the **TV plus its
mounting bracket**. EagleBuilt does the electrical and the masonry opening.

### The base scales with size

**"Use a percentage of growth to fireplace, 20% bigger the price goes up 20%"**
(John, 2026-09-04). The $8,000 buys a **5' wide x 8' tall** fireplace. Size is
the three-sided face envelope - front and both returns - because the back is
against a wall, and is neither finished nor seen:

```
size = (width + 2 x depth) x height        30" deep is standard
5' x 8' x 30" = 80 sq ft = 100% = $8,000
base = $8,000 x (size / 80), floored at $8,000
```

Floored, because $8,000 is a **starting** size: smaller does not go cheaper.

| | face | | base |
|---|---|---|---|
| 5' x 8' | 80 sq ft | 100% | $8,000 |
| 6' x 8' | 88 | 110% | $8,800 |
| 6' x 9' | 99 | 124% | $9,900 |
| 7' x 10' | 120 | 150% | $12,000 |
| 8' x 11' | 143 | 179% | $14,300 |

**The $8,000-$12,000 range turns out to be exactly a 5' x 8' through a 7' x 10'**
under this rule. The stated range and the linear growth model agree without
either having been fitted to the other.

> **SUPERSEDED.** An earlier reading of this file explained the range as
> $4,000 / $150 = 27 lf of seat wall. That was wrong. The range is **size**, and
> seat wall, extended hearth and back wall are added **on top** of it - which is
> why a loaded fireplace can exceed $12,000 without anything being out of order.

### The chimney is optional

**"On a none vent we can even eliminate the chimney"** (John, 2026-09-04). A
vent-free box has nothing to vent, so the chase exists for the look, or to carry
a TV. Without one the body runs full height and is capped flat - the massing in
the white-painted and reclaimed-brick builds. It does not change the rate: size
is still size.

**Two firebox routes** (confirmed 2026-08-28), both owner-furnished at the
burning end:

1. **EagleBuilt builds a firebrick zero-vent box** — the masonry route. The
   **log set is owner-furnished**.
2. **Zero-clearance metal firebox insert** — the **customer selects it**,
   EagleBuilt installs it into the build.

Either way the combustion product is the customer's, which is exactly the
"customer supplied" pattern the kitchen designer already implements.

**Firebox route makes no difference to the price** (John, 2026-09-03): *"install
firebox is as much work as building it with firebrick so no real change."* So
the base is the same either way, and which route gets used is a spec detail, not
a pricing one.

**Stone veneer is priced by the square foot on three sides** (John, 2026-09-03):

```
manufactured veneer, Eldorado type    $35 / sq ft
natural stone or cut veneer           $50 / sq ft
```

**Front and both returns get stone. The back is stucco** - it faces a wall or is
not seen - so it never counts toward the area. Neither does the firebox opening.

John's own check: *"6 ft wide, 2 ft deep, around 70 sq ft."* The designer
computes 70 sq ft for exactly that at 8'6" tall, which is a sensible height for a
6-footer. His estimate and the geometry agree, so the area formula is sound:

```
(width + 2 x depth) x shoulder height          body, three sides
+ (chase width + 2 x chase depth) x rest       chase, three sides
- firebox opening
```

Stone sits ON TOP of the $8,000-$12,000 range, which describes stucco. A stone
fireplace lands above it, and that is expected rather than a contradiction.

---

## Not priced — refer to partners

Landscape, irrigation, pools and spas. John doesn't build these; the designer
should place them as shapes with **no price** so a layout reads honestly, and
the quote says "by others."
