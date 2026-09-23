# DESIGN.md — Reference Extraction + Target Design System

## 1. Source evidence

The live reference currently renders a minimal navigation with Shop, Menu, Our Story, Locations, Order Online, and Bag 0. Its main hero copy uses an editorial “COFFEE FOR YOUR / moment” treatment with short supporting copy, opening hours, and an address. The page then presents a featured menu, a shop section, a clock/latté visual, locations, philosophy/story content, an order/receipt moment, and a compact footer.

The public Templify page describes the motion system as:

- drawn cup fills and pours away to open the page
- bag and cup of beans in a lit, draggable/spinnable studio
- four product cards lean toward the cursor
- iced latte turns on a clock face while scrolling
- coffee beans drift behind a tilted cup
- thermal printer feeds a receipt out of its slot

Known publicly accessible reference assets include a receipt graphic, clock face, iced latte cup, dark café table photograph, printer slot strip, and iced matcha cup. These are reference-only observations; do not reuse them as target brand assets.

## 2. Visual system

### Base palette

Target direction, not a claim about exact CSS values in the reference:

```text
Paper       #F4F1EB
Ink         #11110F
Espresso    #2B211B
Roast       #5C3826
Milk        #E8DDD0
Caramel     #A96B3F
Muted       #77736C
White       #FFFFFF
```

Tune values against the actual target café brand once supplied.

### Typography

Use two families:

1. Editorial display serif — high contrast, large, expressive.
2. Neutral grotesk/sans — navigation, labels, prices, addresses, body.

Suggested scale:

```text
Display XXL: clamp(4rem, 11vw, 11rem)
Display XL:  clamp(3.25rem, 8vw, 8rem)
H1:         clamp(2.75rem, 6vw, 6.5rem)
H2:         clamp(2.25rem, 4.5vw, 5rem)
Body:       1rem–1.15rem
Meta:       0.68rem–0.8rem
```

Do not force all headings to the same size. Contrast is part of the rhythm.

## 3. Grid

Desktop:
- 12-column conceptual grid
- 24–32px outer gutter at common widths
- larger gutters can be used at very large screens

Tablet:
- 8-column grid

Mobile:
- 4-column grid
- 16–20px side padding

Allow selected objects to visually escape the text grid while remaining inside a containing section.

## 4. Header

### Desktop

Left: logo/wordmark.

Center/right: numbered navigation labels.

Far right: order CTA + bag count.

Use hairline separators only where useful.

### Mobile

Wordmark + menu button.

Full-screen menu uses:
- large numbered links
- staggered entrance
- close affordance
- background preserved in the brand palette

## 5. Intro animation

### Timeline

`T0` blank/paper stage.

`T0 + 0.1s` cup stroke begins.

`T0 + 0.6s` liquid fill begins.

`T0 + 1.2s` cup/steam completes.

`T0 + 1.6s` liquid/pour transition begins.

`T0 + 2.2–2.8s` hero is fully visible.

Do not treat these as exact reference timings. They are target choreography values to tune by visual testing.

### Physical language

- SVG stroke reveal
- liquid clip/mask
- slight surface ripple
- pour-away movement
- paper/warm background continuity

## 6. Hero composition

Use an oversized editorial headline and a quiet object composition.

Layout:

```text
[meta]                         [3D / visual field]

BIG HEADLINE                   [product object]
BIG HEADLINE

supporting copy                [small metadata]

open hours                     [CTA]
address
```

The object should not obscure the primary text.

## 7. 3D coffee studio

### Scene

Objects:
- coffee bag
- ceramic cup
- saucer
- 6–20 loose beans
- matte surface

### Lighting

- large warm key
- soft neutral fill
- minimal rim
- soft contact shadow

### Camera

- 45–55mm equivalent perspective feel
- 6–12° idle drift
- limited orbit
- no dramatic zoom

### Pointer behavior

```text
pointer.x -> object.rotation.y + camera offset
pointer.y -> object.rotation.x + camera offset
```

Clamp all rotations.

### Drag behavior

- target angular velocity from pointer delta
- damp to rest
- constrain vertical orbit
- small inertial overshoot only

## 8. Menu cards

Four featured cards is the correct reference pattern.

Card structure:

```text
[image]

01 / ESPRESSO
short description

PRICE                 + ORDER
```

Hover:
- scale 1.01–1.02
- rotate 2–5° total range
- image parallax 6–18px
- shadow shift
- small CTA motion

Do not use large perspective distortion.

## 9. Shop composition

The reference text indicates a `07 PRODUCTS` shop block. Preserve the idea of a seven-product catalog, but the exact product lineup belongs to the target café.

Make the shop feel like an editorial product shelf rather than a marketplace dashboard.

Recommended composition:
- 1 hero product
- 2 supporting products
- 4 smaller products or horizontal list entries

## 10. Coffee clock

### Visual

The known reference clock asset is a sparse white clock face with 12 numbers and fine tick marks. The center is available for the iced latte composition.

Target:
- large circular clock
- central 3D or cutout cup
- text orbiting or positioned along the circumference

### Motion

```text
scrollProgress 0 → 1
clockAngle      0° → 360° or 720°
cupAngle        proportional but slightly delayed
textPhase       segmented by time band
```

Create inertial smoothing so the latte does not snap when scrolling stops.

## 11. Bean field + tilted cup

Use 30–100 instanced beans on desktop, fewer on mobile.

Each bean has:
- seeded random scale
- seeded rotation
- independent drift phase
- different Z depth

Do not synchronize every bean on one sine wave.

Large cup:
- rotation.z around a small tilt
- scroll-linked position
- subtle mouse parallax

## 12. Story / philosophy

Use a magazine-like spread.

Possible arrangement:

```text
// OUR PHILOSOPHY

[large image]            [small image]

               BIG STATEMENT

body copy                caption
```

Image reveals should use clip/mask + scale reduction rather than a plain fade.

## 13. Locations

Use text-first rows.

```text
01  CAFÉ NAME
    full address
    OPEN DAILY 07:00–22:00                       → MAP
```

On hover:
- row expands slightly
- number and CTA sharpen
- others reduce contrast very slightly

Do not hide addresses behind hover.

## 14. Order/receipt visual language

The known reference has a small metallic printer slot asset and a receipt treatment with thermal-paper typography, separators, item rows, totals, status, barcode, and web/contact footer.

Target receipt:
- warm white paper
- monospaced type
- 1px/2px dashed separators
- realistic slight shadow
- paper depth/perspective

Printing motion:
- slot activates
- top edge appears
- paper grows downward
- content reveals in sync with paper
- final settle

## 15. Footer

Large brand statement followed by compact contact and legal information.

Use a repeated brand phrase as a typographic close, but keep original copy.

## 16. Responsive behavior

### Desktop
Full motion suite.

### Tablet
Reduce scene density and scroll length.

### Mobile
- dedicated layout
- no custom cursor
- touch interaction only
- fewer beans
- lower DPR
- fewer post effects
- no giant pinned scenes that fight native scrolling

## 17. Reduced motion

Replace:
- 3D idle drift → static pose
- cursor tilt → static card
- scroll rotation → static centered cup
- long reveals → short opacity/translate
- printer choreography → short paper reveal

Do not remove content.

## 18. Quality target

The visual bar is:

`art direction > layout polish > motion polish > 3D realism > micro interaction > novelty`

A simpler animation executed perfectly is preferable to five noisy animations.
