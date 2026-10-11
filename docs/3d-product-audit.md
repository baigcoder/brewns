# 3D product viewer audit

Every product's Photo / 3D tab was opened in a running dev build, compared with its photograph, and classified. The
rule: **a product gets `3D VIEW` only if its modelled piece matches its photograph**; otherwise it keeps the photograph,
either lifted into relief and labelled `TILT VIEW` (a few degrees each way, never called 3D), or as a photograph alone.

The decision lives in [`components/brewns/viewPolicy.ts`](../components/brewns/viewPolicy.ts) and is read by the tab
label, the hint text, the canvas's accessible name and the viewer itself. `tests/models3d.test.ts` pins it.

## Evidence types

- **Automated**: a script asserts it and records pass/fail (`audit-matrix`, `audit-behaviour`, `audit-resources`, unit tests).
- **Inspection**: a person (here, the reviewing assistant) looked at the captured screenshots.
- **Real device**: none. Every "mobile" result is Chrome device emulation with synthetic touch events, on a software
  WebGL renderer (SwiftShader). Nothing here was run on an iPhone, an Android phone or a GPU.

## Tools (all project-local, `scripts/`)

| Tool | What it does |
|---|---|
| `audit-3d.mjs <out> [width] [ids]` | Opens `#shop/<id>`, **fails the product if `#pdp-name` does not match the catalogue**, checks the view button is pressed before each shot; captures photo, model at 0/90/180°, relief, option choices (`VARIANTS=1`). `POLICY=1` captures what ships. Retries once on a page crash. Reduced motion by default. |
| `audit-strips.mjs <dir>` | Lays products out side by side for reading (`ALL=1` includes variant frames, `FIT=contain` for tall frames). |
| `audit-variants.mjs <out> [ids]` | Clicks every option choice at 2x on a front-facing crop and records which choice the page reports selected. |
| `audit-matrix.mjs <out> [widths] [ids]` | **Every product x 7 widths**: identity, tab labels vs policy, hint honesty, page overflow, one canvas, silhouette inside the stage, centred, clear of the hint and Photo/3D buttons; for 3D, silhouette still solid after turning 90° and 180°; for TILT, silhouette still the same after a very long drag. |
| `audit-behaviour.mjs <out>` | WebGL off, model file blocked, overflow, touch/keyboard/wheel, repeated switching. |
| `audit-compare.mjs <out> <ids>` | Photograph beside the forced model at 0/90/180/270 degrees, 2x. |
| `audit-fallback.mjs <ids>` | WebGL off and model file blocked, per product. |
| `audit-resources.mjs [cycles]` | Open/close/switch the viewer N times; counts canvases, live WebGL canvases, heap after forced GC, rAF rate. |

Outputs: `docs/3d-audit/` (`matrix/matrix.jsonl` with every row, `variants/` with 2x captures and `variants.json`,
`behaviour/` fallback screenshots). The earlier screenshots that showed the homepage were discarded. The Chrome profile
caches the scripts used to write there are removed; the scripts now use the temp directory.

## What changed in this pass

- **Latte** (`pdp3dEngine.ts`): the printed cup's lower body now shows a drink-coloured liquid with tapioca pearls at the
  foot, as in the photograph's clear cup, instead of plain cream paper. Done in the printed texture, not with
  transparency, so there are no sorting artefacts and the sleeve, wordmark and rear are unchanged.
- **Test** for that print; the policy test was already there. 94 tests now.
- **Audit tooling**: matrix, variants and resources scripts; profile caches moved out of the repo.
- Nothing else in the models was changed: no other defect was found by inspection or by the matrix.

## Results

### Automated matrix, 1440 and every other width (`audit-matrix`)

294 rows (42 products x 320, 375, 390, 768, 1024, 1440, 1920): **294 pass, 0 fail**; no console errors; page overflow
0px in every row. 56 rows were 3D models (8 products), 224 TILT (32 products), 7 photo-only, 7 gift card. Margins were
wide: the turned-silhouette area stayed at 91% of the front view or more for every model (the check fails below 45%), and
relief silhouettes stayed within 90-100% after a 900px drag. At 320px the pieces fill 18-57% of the stage width (small
but whole and clear of the controls); this is a framing limit, not a defect the matrix flags.

What the matrix does **not** do: judge likeness, label legibility or texture quality. Those are the inspection results below.

### Phase 1 matrix (`audit-matrix`, 9 products x 7 widths)

63 rows: **62 pass, 1 flagged** (lime soda at 375px, the rotation-area threshold, explained above and checked by eye).
Failures found on the way and fixed: at 768px (a 558px-tall stage) the cortado and nitro glasses touched the control
row, so the camera now reserves room for the hint and buttons whenever the stage is under 640px tall or wide; and at
1024px the cast shadow reaching the edge of a narrow stage was being read as product, so the detector now ignores
neutral shadow grey. No page overflow in any row, no console errors.

### Per product

Variants are the page's own option groups, all selected one by one in `audit-variants` for the eight 3D products (each
selection confirmed by the page's `aria-checked`, one canvas throughout).

| Product | Variants | Representation | Geometry / branding | Interaction | Responsive (7 widths) | Fallback | Status |
|---|---|---|---|---|---|---|---|
| ESPRESSO | shots (single, double), style (3) | **3D VIEW** | Inspected at 2x front-facing: SINGLE SHOT and DOUBLE SHOT print correctly, same alignment, ESPRESSO band, wordmark, legible. Side and rear continue the band. Cup matches photo. | drag, arrows, +/-, wheel, mode switch, 6 rapid toggles -> 1 canvas | automated pass x7; touch drag 320, 390 (emulated) | WebGL off and blocked model -> photo + message (tested on this product) | **VERIFIED PASS** |
| LATTE | size (3), milk (3), temp (2) | **3D VIEW** | Cream cup, navy sleeve, LATTE, lid match; clear-cup liquid and pearls now printed. Still **not an exact match**: the photographed cup is clear with a milk-coloured drink visible through the whole body and a different sleeve placement; the model is a printed paper cup whose body above the sleeve is cream. | drag pass | pass x7 | same code path as espresso, not run separately | **VERIFIED PASS with documented gap** |
| SLOW ROAST | size, grind, purchase | **3D VIEW** | Charcoal bag, sage panel, wordmark, script match; rear is the bag's own back | drag | pass x7 | blocked model: same code path as espresso, not run | **VERIFIED PASS** |
| ICED MATCHA | size, milk, sweet | **3D VIEW** | Clear cup, leaf print, label, straw, lid match; sides continue print | drag | pass x7 | not run | **VERIFIED PASS** (variant frames inspected: size scales the cup; milk/sweet do not visibly change it) |
| ICED LATTE | size, milk, shots | **3D VIEW** | as iced matcha | drag | pass x7 | not run | **VERIFIED PASS** (same note) |
| CAPPUCCINO | size, milk, temp | **3D VIEW** | Black cup, saucer, spoon match; latte art is a chevron where the photo has a rosetta; HOT/ICED does not change the cup (it stays a cup of hot drink; iced shows no ice) | drag | pass x7 | not run | **VERIFIED PASS** with limitations |
| SPANISH LATTE | size, temp, sweet | **3D VIEW** | Tall glass, layered drink, saucer, spoon match the composition; glass is plain, photo's is faceted; sweetness changes the layers | drag | pass x7 | not run | **VERIFIED PASS** with limitations |
| CAFFE AMERICANO | size, temp, shots | **3D VIEW** | Mug and separate spoon resting on the table with its own contact shadow, believable scale, not floating, not touching the mug (inspected front/side/rear and across all 7 variant frames). Spoon is silver; the photo's is near-black. ICED does not change the mug. | drag, arrows | pass x7 | not run | **VERIFIED PASS** with limitations |
| ETHIOPIA YIRGACHEFFE | size, grind, purchase | **3D VIEW** (phase 4) | Real bag geometry (the shared bag model, as Slow Roast) printed with artwork reconstructed from its photograph: see phase 4 below | drag pass | pass x7 (phase 4 matrix) | blocked model / WebGL off: photo + message (22/22 in phase 4) | **VERIFIED PASS** with notes |
| _(none left)_ | | | Every catalogue product with a viewer now has a verified model, except the Ethiopia bag (photo only). A product added later without a model falls back to `TILT VIEW`; the policy test pins that. | | | | |
| GIFT CARD | n/a | its own card view | n/a | n/a | opens and no overflow x7 | n/a | **NOT VERIFIED** as a viewer (out of scope) |

### Phase 1: drinkware rebuilt as real 3D (9 products)

Each was rebuilt against its own photograph (side-by-side comparison frames: `docs/3d-audit/drink/`), then checked at
0, 90, 180 and 270 degrees, across every option, at 7 widths, and with WebGL off. **Each has one photograph, so every
unseen side is a reconstruction, not an observation**: the glass, the drink and the garnish are built from what the
front shows, the back of each piece repeats the same drink and glass, and the tumbler's printing is on the front only.

| Product | What was built (geometry / material / texture) | Options tested | Matches the photo | Known differences | Status |
|---|---|---|---|---|---|
| MINT MARGARITA | highball with a thick glass foot, muddled-mint body fading to crushed ice (cell-pattern ice texture plus 64 loose chunks heaped on top), toothed and veined mint sprig, lime wheel, steel straw | size (2) | colours, ice, garnish, composition | ice is a texture, not 3D chunks inside the drink; drink body is opaque, not truly translucent | **VERIFIED PASS** |
| PEACH ICED TEA | amber tea, clear amber ice cubes, six crescent peach wedges extruded with a painted flesh/skin face, one on the rim, mint | size (2), sweet (3) | colour, wedges, garnish | fewer, smaller ice cubes than the photo; wedge skin blush is plainer | **VERIFIED PASS** |
| MANGO SMOOTHIE | tapering tumbler (narrower at the base, as photographed), saturated mango body, steel straw, whole mango with green-to-red blush and a hedgehog-cut cheek, both resting on the floor | size (2), milk (2) | composition, glass shape, straw, fruit | fruit skin is smoother than the photo's; the photo's cut cheek is more detailed | **VERIFIED PASS** |
| FRESH LIME SODA | clear fizzy water, three large lime wheels with segments, mint leaves against the glass, ice above the rim, mint sprig, a lime wedge and loose mint resting on the floor (they floated before; now placed by `rest()`) | style (3) | composition, garnish | ice and leaves inside the glass are denser than in the photo | **VERIFIED PASS** (375px rotation-area check dips to 0.44 because the loose garnish moves behind the glass; frames inspected, glass is solid from every side) |
| CORTADO | faceted Gibraltar glass (octagonal foot, round above), caramel milk coffee with a foam band, crema surface with a white heart, no saucer (the photo has none) | shots (2), milk (3), temp (2) | glass shape, drink colour, heart | the heart is small and the crema paler than the photo; options change only a tint | **VERIFIED PASS** with those notes |
| NITRO COLD BREW | the same faceted glass, dark coffee, cream head, amber clear ice pressed against the front and sides | size (2), style (2) | glass shape, head, ice | the glass foot reads milky white; ice is fainter than the photo's | **VERIFIED PASS** with those notes |
| FLAT WHITE | speckled cream-over-black stoneware cup (the glaze line now closes with no seam), rosetta, handle, gold spoon | milk (3), temp (1) | cup, glaze, rosetta, spoon | handle is plain black where the photo's is two-tone; the rosetta is a stylised leaf | **VERIFIED PASS** |
| BELGIAN MOCHA | deeper, narrower rustic bowl with a seamless mottled glaze, cocoa-dusted foam with a heart, a heap of flat angular chocolate shards | size (2), milk (3), temp (2) | bowl shape, glaze, shards | cocoa dusting is finer and more even than the photo | **VERIFIED PASS** |
| CERAMIC TRAVEL TUMBLER | tapering body, wide band and shallow-dome matte lid with sip hole and slot, **brewns wordmark and emblem cut from the product photograph's own gold pixels** and wrapped on the front only | colour (3), lid (2) | silhouette, lid, logo (shape and proportions are the real ones) | logo is slightly soft; the lid slide option is a flat plate | **VERIFIED PASS** (the copper body's logo was unreadable in gold: found by the variant check, now printed dark) |

Not exact: none of the nine is a photograph. Glass is rendered with real transmission, but the drinks are painted
bodies placed just inside the wall so the glass has something to show.

### Phase 2: plated food and bakery rebuilt as real 3D (13 of 14 products)

Inventory from the catalogue: 3 pizzas and 3 pastas (kitchen) and 8 bakery items = 14, no overlap with the verified set.
Each already had a modelled piece with real structure; the work was matching it to its photograph (comparison frames in
`docs/3d-audit/food/`, option frames in `docs/3d-audit/variants13/`). **One photograph each: every unseen side and the
underside is a reconstruction.** Where a photo is a different object from the model, the product was not promoted.

| Product | Geometry / material change this phase | Options tested | Remaining differences from the photo | Status |
|---|---|---|---|---|
| MARGHERITA PIZZA (first model) | puffed crust ring (tube thickened, deeper orange, strong leopard char), deep glossy crushed-tomato sauce (the pale cheese texture that made it read pink is gone), seven thick torn mozzarella patches, ten dark glossy basil leaves with painted veins, folded and curled (new `basilGeo`), camera starts nearly overhead like the photo | size (3) | crust is more even than the photo's; cheese has no oil sheen pattern | **VERIFIED PASS** |
| PEPPERONI PIZZA | pale mozzarella with black-pepper flecks, 27 darker spaced slices (slightly tilted), charred crust | size (3), crust (2) | crust blotches coarser than the photo; photo has herbs | **VERIFIED PASS** |
| FAJITA PIZZA | golden oily cheese, 20 larger chicken pieces, wider green/red/purple strips (the "onion" was nearly white), charred crust | size (3), crust (2) | photo is denser with toppings | **VERIFIED PASS** |
| ALFREDO | chicken fan larger, sauce pool raised so it shows at the foot of the nest, ribbons kept off the bowl wall | protein (3) | photo's sauce covers more of the noodles; no herb flecks on the chicken | **VERIFIED PASS** with notes |
| ARRABBIATA | the penne are golden, not saturated red (the material colour was multiplying the per-piece tint), plus 46 glossy dark ragu clumps | spice (3), add (2) | spice levels change nothing visible; the fork is separate in the photo, resting here | **VERIFIED PASS** with notes |
| PESTO | duller olive fusilli, tomatoes and shavings kept | protein (2) | photo is two-tone (green and yellow) fusilli with roasted tomatoes | **VERIFIED PASS** |
| CARDAMOM BUN | unchanged | serve (2) | model plate is larger and plainer than the photo's | **VERIFIED PASS** with notes |
| CINNAMON ROLL | camera raised so the glazed spiral top shows (it read as a plain drum before) | warm (2), glaze (2) | glaze is opaque white; the photo's is thin with cinnamon showing | **VERIFIED PASS** with notes |
| MATCHA FINANCIER | exterior is now dark matcha-brown (it was golden), green crumb inside | serve (2) | photo's cake is more rustic and speckled | **VERIFIED PASS** |
| ALMOND CROISSANT | unchanged | serve (2) | glossier than the photo | **VERIFIED PASS** |
| SAN SEBASTIAN | cut face is pale cream, not yellow | serve (3) | the photo's top is rougher; the sauce streaks are stylised | **VERIFIED PASS** |
| WARM FUDGE BROWNIE | unchanged | serve (3) | photo's top is more cracked and rustic | **VERIFIED PASS** |
| CLASSIC TIRAMISU | unchanged | portion (2) | mint is brighter than the photo's | **VERIFIED PASS** |
| FRENCH BUTTER CROISSANT | not changed, **not promoted** | n/a | the photograph shows a croissant cut open (honeycomb crumb); the model is a whole croissant | stays `TILT VIEW`; model **NEEDS MODEL IMPROVEMENT** (it needs a cut-open version) |

Phase 2 matrix (`docs/3d-audit/matrix14`): 14 products x 7 widths = **98 rows, 98 pass** (identity, labels, hint, no
overflow, one canvas, whole and centred, clear of controls, solid from every side). Fallbacks (`audit-fallback`): WebGL off
and model file blocked, all 13 promoted products, **26 of 26 pass**. Options: **41 selections, 0 mismatches**.

#### Lime soda 375px finding (carried from phase 1)

The one flagged row was not a visibility defect. Removing the loose garnish did not change the score (0.43), because the
matrix measured only pixels that differ from the background and the lime soda's glass and drink are nearly colourless:
it was measuring the lime wheels, which turn edge-on. Moving the garnish closer made framing worse and was reverted. The
rotation check now uses width (a flat card collapses to a sliver; a solid piece keeps its width, 0.94 here) with an area
floor of 0.25 instead of 0.45. All 63 phase 1 rows still pass under it (lowest width ratio 0.54, lowest area 0.44), and
lime soda passes at all seven widths.

### Phase 3: burgers, rolls, sides and the cut-open croissant (10 products)

Inventory from the catalogue: 3 burgers, 3 rolls and wraps, fries, tenders, garlic bread, plus the butter croissant. All
10 are now `3D VIEW`. Comparison frames: `docs/3d-audit/p3/`; option frames: `docs/3d-audit/variants10/`. **One photograph
each; every unseen side is a reconstruction.**

| Product | What changed | Options (what each changes) | Differences from the photo | Status |
|---|---|---|---|---|
| SMASH BURGER (first model) | lumpy lacy-edged beef (blob + three scales of crag), cheese draped over each patty, sauce drip, pickles at the rim, flatter amber bun with less gloss, camera starts level so the layers read | meal: fries carton added, whole scene refitted; **extra: `+ CHEESE` adds a slice and `+ PATTY` adds a third patty with cheese (both were previously wired to nothing)** | photo's cheese is far more melted and the bun more glossy; pickles are plain discs | **VERIFIED PASS** with notes |
| ZINGER | craggy fillet at three scales, darker coating, wider shredded lettuce, mayo drips shortened so they sit on the fillet | meal (fries, refitted), spice (chilli flakes 0/34/90) | coating is more uniform than the photo's; lettuce thinner; no big sauce drip | **VERIFIED PASS** with notes |
| BBQ | thick glazed lumpy patty, darker finer lettuce, onion rings sit on the bacon | meal (fries, refitted) | lettuce still looks cut-paper at close range; a small gap remains under the bun | **VERIFIED PASS** with notes (weakest of the burgers) |
| TIKKA ROLL | filling recoloured dark chargrilled brown (it was orange) | spice, cheese (cheese layer shows) | photo shows one wrapped roll with coriander; the model is two cut halves | **VERIFIED PASS** with notes |
| BEHARI ROLL | unchanged | spice (rings on the filling) | kraft paper is plainer | **VERIFIED PASS** |
| CRISPY WRAP | unchanged | spice | wrap lettuce and tomato less colourful | **VERIFIED PASS** |
| TRUFFLE FRIES | thinner (0.022), paler, 190 pieces | dip (cup colour, second cup) | basket paper is cream, not kraft; fries are straighter than the photo's | **VERIFIED PASS** with notes |
| TENDERS | ten strips piled in a heap (was a row of six), three scales of coating crag, lighter golden coating | spice, dip | strips are flatter than the photo's thick pile | **VERIFIED PASS** with notes |
| GARLIC BREAD | unchanged | cheese: extra cheese adds a few strands of pull only, which is subtle | cut faces are plain; photo's cheese stretch is longer | **VERIFIED PASS** with notes |
| FRENCH BUTTER CROISSANT | **new cut-open model**: a segment of the pastry (spine 0.5 to 0.8) with the cut across it, closed with a displaced honeycomb of air cells in a thin shell, and a second cut face at the back so it is solid from every side | serve (as is / warmed: steam only) | photo's shell shows flaky layers; here it is a smooth ridged skin, the cells are less open, and the underside is pale pink | **VERIFIED PASS** with notes |

Phase 3 matrix (`docs/3d-audit/matrix10`): 10 products x 7 widths = **70 of 70 pass**. The three burgers were re-run after
the option fixes (`matrix3b`): **21 of 21 pass**. Fallbacks (WebGL off, model file blocked): **20 of 20 pass**. Options:
**35 selections, 0 mismatches**, one canvas each. Resources (40 cycles, ten products): 0 canvases left, 4 live GL
contexts throughout, heap 135.5 MB then 123 MB (sawtooth); same caveats as before.

Bugs found by the option check and fixed: the burger `meal` option pushed the fries out of frame (now fitted and centred),
and the hidden fries had been skewing the burger off-centre even without the meal (the fries are now added only when chosen).

### Phase 4: final fidelity pass, the Ethiopia bag, options and rendering lifecycle

#### Ethiopia Yirgacheffe: promoted from PHOTO ONLY to `3D VIEW`

What the product photograph actually shows (`public/assets/menu/bag-yirgacheffe.webp`): a charcoal stand-up pouch with
the "brewns / COFFEE HOUSE" mark, a copper "slow roast" script title, a round emblem, **ETHIOPIA / SINGLE ORIGIN**, a
mountain-and-sun-and-acacia landscape standing on a flat sand panel, and the house copy under it (CRAFT ROASTED IN ...,
FLAVOR NOTES CARAMEL / BROWN SUGAR / ROASTED ALMOND, 250 G, WHOLE BEAN, **ROASTED IN COPENHAGEN**). The model's previous
Ethiopia label (jasmine, bergamot, "grown at 2,100 m") was **not in the photograph** and has been removed (a test pins that).

- **Geometry:** the existing bag model with its gusseted sides, zip band, crimped top and base; no new geometry was needed
  and nothing is wrapped from the photograph.
- **Artwork:** the title, emblem, ETHIOPIA / SINGLE ORIGIN, the copy and the panel are drawn into the bag's print atlas, as
  for Slow Roast; the **landscape (three ridges, a pale sun, an acacia) is redrawn as vector shapes** reconstructed from the
  photograph, not cut from it. The panel is flat-topped with the landscape on it, as photographed.
- **Verified:** front label legible at 1440 and at 375 px; rotation shows the back (a mirror of the printed face, the bag's
  own design) and side gussets; no stretching; matrix **7 of 7 widths pass**; WebGL-off and blocked-model fallbacks pass.
- **Missing information, documented rather than invented:** the photograph shows a tribal diamond pattern down the side
  gussets, and its fine detail cannot be read. The model's gussets stay plain charcoal; the side pattern is **not
  reproduced**. The "COPENHAGEN" roasting line is printed as the photograph says although the house label elsewhere says
  Lahore: **the business should confirm which is right**. The roast date is date-driven (as for Slow Roast), not the
  photograph's 12/06/24.

#### Defects fixed

| Product | Defect (from phase 3) | Fix | Result |
|---|---|---|---|
| BBQ burger | lettuce read as cut paper; gap under the top bun | two lobed, frilled, drooping leaves on a polar grid, painted with veins and a pale base fading to green; bun seated on the rings | **VERIFIED PASS** (lettuce convincing at close range; rings are still flatter than the photo's) |
| Smash and Zinger | sauce was thin tube ribbons | thick matte creamy lobes hanging off the edge with a fat joint where they leave the sauce on top; no beads or ribbons | improved; **still much less melted than the photographs**: VERIFIED PASS with notes |
| Butter croissant | smooth shell, pale-pink underside | layered, flaked shell (displacement faded to zero at the cut edges so the shell still meets both cut faces), blistered flake highlights, golden-brown underside; the pink was grazing clearcoat reflecting the white floor, removed at rest | **VERIFIED PASS**; interior unchanged and checked from four angles |
| Croissant warming | steam only | warmed: glossier, deeper shell, less steam (10 particles); room temperature: dry and paler | change visible in frames |
| Garlic bread extra cheese | a few nearly invisible strings | a second thick melt over each piece (on the pieces' own tilt), lumps, and four heavier strings | clearly more cheese |
| Zinger and tenders spice | flakes buried in the bun dome / crust | flakes placed on the surface and enlarged; 0 / some / many now read | confirmed by eye |
| Arrabbiata spice | nothing visible | larger, brighter chilli rings (0 / 12 / 34) | all values differ |
| Lime soda style | SALTED / MIXED looked like SWEET | coarse salt crystals on the rim for SALTED and MIXED | all values differ |
| Tumbler lid | slide vs 360 lid looked alike | the 360 lid's raised ring is larger and higher | all values differ |

Phase 4 regression run (`docs/3d-audit/matrix4`): 11 modified products x 7 widths = **77 of 77 pass**; fallbacks **22 of 22**;
options **46 selections, 0 mismatches, one canvas each** (repeated selection creates no duplicate canvases or geometry
visible in the DOM; the smash `+ CHEESE` / `+ PATTY` options were re-run).

#### Option audit across the catalogue (`scripts/audit-optdiff.mjs`)

Every option group of every 3D product was rendered per value and compared pixel-wise with the others
(`docs/3d-audit/opt/`). The metric misses small features (text, flake counts), so every hit was then checked by eye.
Remaining options that **do not visibly change the model, by design or limitation**:

- Milk type and temperature on drinks (latte, cortado, flat white, iced matcha, iced latte, cappuccino OAT, mango milk), peach
  tea sweetness REGULAR, nitro size: tint-level or size-level in life too; the price and order data are unaffected.
- Beans: grind and subscription plan (slow roast, Ethiopia) are not visible properties of a sealed bag.
- Espresso shots: changes the printed label text only (verified legible at 2x in phase 2).
- Tikka, behari and crispy wrap spice: MEDIUM looks like one of its neighbours.

None of these was changed; they are documented rather than made to look different by invention.

#### Rendering lifecycle (`scripts/audit-raf.mjs`)

Measured in headless Chrome with software WebGL (so a ceiling, not a GPU figure), reduced motion:

| State | rAF callbacks | Main-thread time |
|---|---|---|
| shop page, nothing open | the shared site ticker (`initBrewns.ts` `tick`), ~18/s measured idle, 60/s when busy | 5-17% of one core (the hero and page scenes, not the product viewer) |
| product open, Photo view | the same ticker, 60/s | 3-8% |
| product open, 3D view | ticker 2/s | **0.6-0.8%** |
| viewer closed again | ticker 60/s | as page |

Findings: the product viewer's own loop is **stopped and its renderer, textures and observers disposed on close and on
switching to Photo** (`destroy()` -> `stop()`, `renderer.dispose()`, `forceContextLoss()`); with reduced motion the open
viewer renders on demand and costs under 1% of a core; with motion on the idle spin runs only after about 2.5 s of
inactivity. The residual cost is the site-wide ticker and the hero / page scenes behind the product page, which keep
running while a product is open. Pausing those is an engine-level change outside "verified viewer defects"; I did **not**
change it. **Not measured: GPU time and GPU memory** (no GPU run). Heap over 40-cycle open/close runs showed a sawtooth
with no canvases left, which is evidence, not proof, of no leak.

### Phase 5: release-readiness pass

Status vocabulary used below: **VERIFIED PASS**, **VERIFIED FAIL**, **NOT VERIFIED**, **BLOCKED**, **OWNER CONFIRMATION REQUIRED**.

#### Content integrity: OWNER CONFIRMATION REQUIRED

| Item | What the repository says | What was changed | Status |
|---|---|---|---|
| Ethiopia roasting city | The Ethiopia photograph prints "ROASTED IN COPENHAGEN". `lib/catalog.ts` says Slow Roast is "ROASTED IN LAHORE" and gives **no** roasting city for Ethiopia; the house copy elsewhere says Lahore. Nothing in the repository establishes which is true for the Ethiopia coffee. | The model **prints no roasting city** for Ethiopia (the cell and its divider are left off). The Slow Roast bag is unchanged ("ROASTED IN LAHORE", from the catalogue). | **OWNER CONFIRMATION REQUIRED**: say where the Ethiopia coffee is roasted, and whether the photograph's Copenhagen is a stock-image leftover. |
| Roast date on both bags | Both product photographs print `12/06/24`. The model used to compute a date from today's clock, which claims a roast that never happened. | The printed date is the **photographed** `12/06/24` for both bags (`ROAST_DATE_AS_PHOTOGRAPHED`); nothing is derived from the system date any more, and a test fails if that returns. | **OWNER CONFIRMATION REQUIRED**: a real pack carries a real roast date; a 2024 date on a 3D hero is visibly old. Either confirm it as a placeholder or give the intended wording (for example no date). |
| Ethiopia flavour notes | Photograph: CARAMEL / BROWN SUGAR / ROASTED ALMOND (the same as Slow Roast). Catalogue notes for Ethiopia: JASMINE / BERGAMOT / WHITE PEACH. | The bag prints what the photograph shows. The catalogue's notes still show on the product page, so the two disagree. | **OWNER CONFIRMATION REQUIRED**: the photograph may be a Slow Roast bag re-titled; the label copy should match the product. |

Not touched: the catalogue text itself (`lib/catalog.ts`), pricing and checkout.

#### Visual fixes this pass

| Product | Defect | Fix | Status |
|---|---|---|---|
| Smash and Zinger sauce | thin lobes, too few, too clean | larger creamy lobes that join a wider irregular pool on top; deeper cream-orange, matte | improved; **still plainer than the photographs' melted cheese and sauce**: VERIFIED PASS with notes |
| Nitro cold brew | ice invisible (fully hidden inside the drink); milky tinted skin | cubes sit between the drink and the wall; **cubes are opaque** because a transparent cube is lost in the glass's transmission pass; skin made nearly clear; dark glossy amber ice | ice now visible: VERIFIED PASS with notes (fewer, smaller cubes than the photo) |
| Cortado | heart dimmed and viewed too low | foam at full strength, camera higher | VERIFIED PASS with notes |
| Pesto | single flat green | two-tone fusilli (green and yellow-green), as photographed | VERIFIED PASS |
| Alfredo | sauce thin; noodles grey-beige | golden noodles, flat cream clumps over them (an earlier, taller version read as white pebbles and was reduced) | improved: VERIFIED PASS with notes (the photograph's sauce still covers more of the pasta) |
| Cinnamon roll | glaze covered the whole top | thinner, smaller glaze so the bun shows round it | improved; the cinnamon swirl in the photograph is still not reproduced: VERIFIED PASS with notes |
| Cardamom bun warming | steam only | warmed is glossier and deeper, with less steam | visible |
| BBQ lettuce, croissant | reviewed again | no further change needed | unchanged from phase 4 |

Reviewed and **left as they are** (satisfactory in the normal camera, remaining differences are minor or caused by one photograph): the
cheesecake and brownie surfaces (cracked top, smoother crust than the photos'; no change judged worthwhile).

#### Options: classification

Every option is at minimum an **order option**: its value is stored in the cart line, shown in the bag and the bill, and kept
across reload. This was verified on the real page for **all 42 products** (`scripts/audit-cart.mjs`,
`docs/3d-audit/cart/run.log`): a non-default value in every group is stored as chosen, appears in the bag drawer text, the
same selection added twice merges into one line (qty 2), a different selection is a separate line, and the bag is identical
after reload. **42 of 42 pass.** No control is dead or fake, and no option, price or product was invented.

| Class | Options |
|---|---|
| **Visual** (the model changes; deterministic and reversible, verified by repeated selection with one canvas each: 58 selections in this pass, 0 mismatches) | size where the cup, glass or pizza scales; pizza crust; smash `+ CHEESE` / `+ PATTY`; meals (fries); burger and roll spice, tikka cheese; tender dip; truffle-fries dip; lime-soda style (salt rim); tumbler colour and lid; garlic-bread cheese; croissant, cardamom-bun and cinnamon-roll warming; pasta proteins and arrabbiata spice and add-ons; americano, spanish-latte and mocha temperature where a cup shows it |
| **Order only** (no honest visible difference, deliberately left unchanged) | bean grind and purchase plan (a sealed bag); drink milk type (latte, cortado, flat white, iced matcha, iced latte, mango, cappuccino OAT) and temperature (latte, cortado, flat white); espresso shots and style (printed label text only, legible at 2x); nitro size (scaled with the cup only); peach tea REGULAR sweetness; tikka, behari and crispy-wrap MEDIUM spice |
| **Unsupported** | none found |

The product page does not currently say which options are visual; I did not add UI text, because that is a design change
outside this pass. `scripts/audit-optdiff.mjs` produces the per-option table (`docs/3d-audit/opt/`).

#### Regression run

13 products changed or affected x 7 widths (`docs/3d-audit/matrix5`): **91 of 91 pass**. Fallbacks (WebGL off, blocked model):
**26 of 26**. Option selections: **58, 0 mismatches**. Ethiopia checked again against `bag-yirgacheffe.webp`: copper
"slow roast", ETHIOPIA / SINGLE ORIGIN, highlands, copy and gussets all present; the **side-gusset diamond pattern is still
not reproduced**; front, side and rear rotate correctly.

#### Lifecycle (measured again, `scripts/audit-raf.mjs`)

Unchanged from phase 4: product-viewer loop stopped and disposed on close and on Photo; ~2 callbacks/s and 0.6-0.8% of a core
with a reduced-motion 3D viewer open; the 60/s is the site-wide ticker and hero scenes. Measured in headless Chrome with software
WebGL. Not measured: GPU time or memory. No lifecycle code was changed.

### Phase 6: content consistency and evidence cleanup

**Decisions applied (supersede the Phase 5 "owner confirmation" rows where noted):**

| Item | Decision and result | Status |
|---|---|---|
| Roasting city | Not printed on the Ethiopia bag. The Slow Roast bag still prints "ROASTED IN LAHORE", which matches the catalogue entry for that product. | VERIFIED PASS (label render + test); city itself remains unestablished |
| Roast date | **Removed from the reusable bag artwork on both designs (and the hero bag).** The `ROAST DATE` field stays as an empty stamp line. No date is derived from the clock; `12/06/24` is no longer in the code (a test fails if it, `roastDate(` or `new Date(` returns). Photographs still show it: they are evidence, unchanged. | VERIFIED PASS; a real date needs batch data, which this repository does not have |
| Ethiopia flavour notes | The label prints the **catalogue's** notes: JASMINE / BERGAMOT / WHITE PEACH. The label's description lines were also changed from the photograph's house blurb to the catalogue's own facts (washed heirloom varieties, smallholders in Yirgacheffe, 2,100 m). A test compares the label's notes with `lib/catalog.ts`. | VERIFIED PASS |
| Photograph / catalogue conflict | `bag-yirgacheffe.webp` prints the Slow Roast notes (caramel, brown sugar, roasted almond), "ROASTED IN COPENHAGEN" and `12/06/24`. It may be a re-titled Slow Roast bag. The photograph is preserved unchanged as evidence; `lib/catalog.ts` was not edited. | **OWNER CONFIRMATION REQUIRED**: is the Ethiopia photograph the right packaging? |
| Identity | Charcoal bag, copper "slow roast" title, ETHIOPIA / SINGLE ORIGIN, mountain, sun and acacia are unchanged. The "slow roast" title on an Ethiopia pack is itself taken from the photograph. | unchanged |

Browser verification (real pages, `docs/3d-audit/p6/`): both bags rendered and rotated through 0/90/180/270, label legible,
no date, no city; matrix **28 of 28** (4 products x 7 widths), WebGL-off and blocked-model fallbacks **4 of 4**, option -> cart
**4 of 4**. The product-page notes and the 3D label now agree (both JASMINE / BERGAMOT / WHITE PEACH): checked by the label
test and by eye on the render, not by an automated DOM comparison of the page text.

**Evidence directory** `docs/3d-audit/` went from 132 MB to **24 MB**. Classified before deleting:

| Class | Where | Action |
|---|---|---|
| Matrix and test outputs | `matrix*/` (`matrix.jsonl`, `run.log`), `cart/`, `opt/`, `*.log`, every `variants*.json` | kept all |
| Comparison and contact sheets | every `strip-*.png`; new sheets for `variants4`, `variants5` | kept all |
| Latest per-product captures | `p6/`, `drink/`, `food/`, `tumbler/`, `behaviour/` (fallback screenshots), `eth375/`, `ls375/` | kept |
| Loose per-frame 2x captures of phases 4 and 5 | `variants4/`, `variants5/`, `p4/`, `p5/`, `v4/` (212 PNG files) | **removed**: regenerable with `audit-variants.mjs`, `audit-compare.mjs`; the sheets and `variants.json` remain |
| Original reference images | `public/assets/menu/*` (outside this directory) | untouched |
| Temporary files | Chrome profiles | already in the OS temp directory, not here |

Removal used explicit directories, non-recursive, and only non-`strip-*` PNG files, checked to be under `docs/3d-audit/`.
Some intermediate states are therefore no longer viewable frame by frame; they can be regenerated against the code of that
phase only if the code is checked out again.

### Fallbacks (`audit-behaviour`, espresso, 1440)

- WebGL unavailable: no canvas, photo shown, "3D VIEW UNAVAILABLE . SHOWING THE PHOTO", Photo button still works.
- Model file blocked: same result. (The shared hero model also reports its own load failure banners on the page; that is
  the site's existing behaviour, not this viewer.)
- Both fallback paths are **not** run for the other seven 3D products; the code path is shared.

### Interaction (espresso, emulated)

Drag, arrow keys, `+` and wheel all change the render; the wheel does not scroll the page; one canvas after six rapid
Photo/3D toggles; reduced-motion was on for all captures. **Not tested**: pinch zoom, visible focus ring appearance,
non-reduced-motion idle spin, reset-zoom behaviour (no reset control was found to test), double-tap.

### Resources (`audit-resources`)

Re-run for the nine drinkware pieces (45 open/close/variant cycles, `IDS=` env): viewer canvases left behind 0; live WebGL
canvases constant at 4; heap 109 -> 123 MB then **108 MB at cycle 35** (sawtooth), final 113 MB. Same caveats as below.


15 and 45 open/close/variant cycles across espresso, smash burger, americano, slow roast:

- Viewer canvases left in the DOM: **0** every time. Live WebGL canvases: constant (4) from cycle 5 to cycle 45, and
  none belong to the viewer (the viewer's context is released: `destroy()` calls `renderer.dispose()` and
  `forceContextLoss()`, disconnects its observer and disposes its variant engine, environment and fx).
- JS heap after forced GC: 109 -> 135 MB over 35 cycles, then **122 MB at cycle 40**; a sawtooth, not a straight climb.
  This is consistent with caches filling and being collected. It is **not proof of no leak**: it is one machine, one
  browser, 45 cycles, and GPU memory was not measured.
- Pixel ratio is capped at 1.5 in the viewer. Model/snapshot loading is cached by `getSnapshot`; variant changes call
  `updateVariant`, which reprints textures and does not rebuild the scene.
- `requestAnimationFrame` calls were counted at about 60/s on the shop page even with the viewer closed, and about 0/s
  while it was open. The viewer's own loop runs through the engine's scheduler, which this counter did not wrap, so the
  counter cannot say whether a hidden viewer keeps rendering. **NOT VERIFIED**; the ~60/s page-wide loop is not the
  viewer and was not investigated.

## Checks (this checkout)

- `npm run typecheck`: clean. `npm run lint`: 0 errors, 1 existing warning (`components/console/Live.tsx`, untouched).
- `bun test` (via `npx bun@1.4.2`; bun is not installed here): **103 pass, 0 fail** (unchanged from phase 5: phase 6 rewrote the Ethiopia content test rather than adding one) (93 -> 94 latte print -> 97: drinkware
  policy, faceted-glass and print-from-photo, garnish-rests-on-floor tests).
- `next build --webpack`: compiled successfully. Turbopack is not used because `node_modules` in this worktree is a
  link to `F:rewns-clean
ode_modules` (left in place).
- Fallbacks (`audit-fallback`): WebGL off: all nine show the photo and "3D VIEW UNAVAILABLE . SHOWING THE PHOTO", Photo
  button works. Model file blocked: all nine still render (their pieces are procedural, they do not use the file).

## Still unverified or open

- Phase 6: roasting city and a real roast date remain unestablished (nothing printed); whether the Ethiopia photograph shows the right packaging needs the owner. No real-device or GPU testing.

- **OWNER CONFIRMATION REQUIRED** (see Phase 5): Ethiopia roasting city, the roast date printed on both bags, and the Ethiopia flavour notes.
- Phase 5: smash and zinger sauces, Ethiopia's side pattern, cinnamon swirl; options are order-only where listed. No real-device, GPU, pinch or focus-ring testing; touch is emulated.

- Phase 4: Ethiopia's side-gusset pattern is not reproduced; the roasting city and roast date need business confirmation; smash and zinger sauces are still plainer than the photographs; the hero and page scenes keep rendering behind an open product page (measured, unchanged); no real-device, GPU, pinch or focus-ring testing.

- Phase 3: none of the ten is photographic. Weakest likenesses: BBQ burger (lettuce), the smash and zinger sauces, the cut croissant's shell. No real-device, GPU, pinch or focus checks.
- Decision for you: all 42 catalogue products now have a viewer except the Ethiopia bag. AI image-to-3D was never needed and nothing was downloaded.

- Phase 2: none of the 13 is photographic; unseen sides are reconstructions. Weakest likenesses: alfredo (sauce coverage), cinnamon roll (glaze), pesto (two-tone fusilli), the cheesecake and brownie tops. Real-device, GPU, pinch and focus checks not run. Resources: 36 cycles over nine of the food models, heap sawtooth (134.6 MB then 121.9), 0 canvases left, same caveats as before.

- Drinkware (phase 1): none is photographic; unseen sides are reconstructions. Cortado and nitro are the weakest likenesses
  (small heart, faint ice). Real-device, GPU and pinch/focus checks were not run for them either.

- No real-device test of any kind; no GPU test; GPU memory.
- Latte still differs from the photo (clear cup).
- Cappuccino, Spanish latte, Americano: ICED temperature has no visual effect on the model; cappuccino art differs.
- Ethiopia bag model is not accurate to its photo (kept as photo-only).
- TILT extremes and the 32 relief products were checked by script, not by eye beyond the 1440 front frames.
- Pinch zoom, focus ring look, zoom reset, idle spin with motion enabled, hidden-viewer rendering.
