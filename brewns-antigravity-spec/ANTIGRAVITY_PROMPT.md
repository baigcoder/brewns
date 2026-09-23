# ANTIGRAVITY MASTER PROMPT — Premium 3D Café Reconstruction

You are the lead product engineer, creative frontend engineer, WebGL/Three.js engineer, motion designer, and QA reviewer for this project.

You are building an ORIGINAL premium café website inspired by the interaction language of this reference:

`https://brewns-coffee.vercel.app/`

DO NOT copy the Brewns brand, logo, wording, images, proprietary model assets, or source code. Recreate the interaction principles and level of polish with a completely new café identity.

## FIRST: READ THE PROJECT SPEC

Before coding, read:

1. `PRD.md`
2. `ARCHITECTUE.md`
3. `RULES.md`
4. `DESIGN.md`
5. `TASKS.md`
6. `MEMORY.md`
7. `ANTIGRAVITY_GITHUB_SKILLS.md`

Then inspect the existing repository. Do not overwrite an existing architecture blindly.

## AGENT OPERATING MODE

Work in vertical slices.

For each task:

1. inspect
2. plan
3. implement
4. run typecheck/lint/build
5. run browser verification
6. visually inspect
7. fix regressions
8. update `TASKS.md` and `MEMORY.md`
9. commit a coherent milestone

Do not claim a feature is complete without evidence.

## TARGET EXPERIENCE

The site should feel like a physical coffee ritual translated into an interactive digital experience.

Narrative:

CUP DRAWING
→ COFFEE FILLS
→ POUR / REVEAL
→ EDITORIAL HERO
→ TOUCHABLE 3D COFFEE STUDIO
→ MENU OBJECTS RESPOND TO THE HAND
→ SHOP
→ TIME BECOMES A COFFEE CLOCK
→ FLOATING BEANS / TILTED CUP
→ STORY / PHILOSOPHY
→ ORDER CTA
→ THERMAL RECEIPT PRINTS
→ FOOTER

That sequence is the design backbone.

## TECHNICAL STACK

Use the existing project stack where reasonable. Otherwise target:

- Next.js App Router
- React
- TypeScript strict
- Tailwind CSS or authored CSS
- React Three Fiber
- Three.js
- drei
- GSAP + ScrollTrigger
- Lenis only if it improves motion without harming native scrolling
- Motion only for small UI transitions
- Playwright for browser verification

## SECTION REQUIREMENTS

### 1. INTRO CUP

Build a line-art cup in SVG.

Sequence:
- stroke draws
- liquid fills
- steam appears
- liquid/pour transition transforms into hero reveal

Do not use a simple opacity fade.

### 2. HERO

Create an editorial full-height composition.

Use:
- micro eyebrow
- giant display headline
- concise café statement
- opening hours
- location
- primary order CTA
- secondary menu CTA
- one atmospheric visual/3D object

The design must work as a still frame before motion is considered.

### 3. INTERACTIVE 3D COFFEE STUDIO

Create a professional product-photography-style scene:
- coffee bag
- ceramic cup + saucer
- coffee beans
- matte table
- warm key light
- soft fill
- contact shadows

Interaction:
- pointer parallax
- constrained drag/orbit
- damping/inertia
- subtle return-to-rest
- tiny idle physical motion

Use PBR materials and realistic geometry.

Use one stable R3F canvas/scene. Never remount it because content props changed.

### 4. MENU

Create four featured menu cards.

Each card:
- product image
- name
- description
- price
- order CTA

Hover:
- 1.01–1.02 scale
- only a few degrees of rotation
- image parallax
- subtle shadow shift

No exaggerated 3D cards.

### 5. SHOP

Create a `07 PRODUCTS` editorial shop moment.

Use typed product data.

Prefer an asymmetric editorial shelf/composition rather than seven identical tiles.

### 6. COFFEE CLOCK

Create a large clock face with 12 hour markers.

Place an iced latte at the center.

Map scroll progress directly to the scene:

`scrollProgress → clock rotation → cup orientation → copy phase`

Smooth the motion but keep it coupled to user scroll.

It must not feel like an autoplay animation that merely happens while the user scrolls.

### 7. BEAN FIELD

Create an instanced 3D field of coffee beans.

Each bean gets deterministic:
- scale
- rotation
- depth
- drift phase

Use slow independent motion.

Place a large tilted coffee cup through the field.

Scroll controls the cup/camera composition.

### 8. STORY / PHILOSOPHY

Use large editorial photography and oversized typography.

Images enter using:
- mask/clip reveal
- scale 1.05-ish → 1
- slight parallax

Text uses staggered line/word reveal.

### 9. LOCATIONS

Use clean text-led rows with addresses, hours, and directions.

Do not hide essential information behind hover.

### 10. THERMAL RECEIPT

Create a printer slot + receipt.

When section enters view:
- printer activates
- paper appears
- paper feeds down
- text reveals with the paper
- receipt reaches final length
- tiny physical settle

Use monospaced receipt typography, separators, item rows, total, status, barcode, brand/footer.

Do not simply fade the receipt in.

## PERFORMANCE REQUIREMENTS

- HTML and primary typography render before WebGL.
- Dynamic import heavy 3D scenes.
- Cap DPR.
- Compress textures.
- Instance repeated beans.
- Pause invisible scenes.
- Reduce effects on mobile.
- Avoid per-frame React state.
- No unnecessary post-processing.
- No horizontal overflow.

## ACCESSIBILITY REQUIREMENTS

Implement `prefers-reduced-motion`.

With reduced motion:
- no cursor tilt
- no long camera drift
- no continuous bean movement
- no scroll-driven 360° scene requirement
- short/simple reveals only
- receipt can use a quick paper reveal

Content and functionality remain intact.

## MOBILE REQUIREMENTS

Do not merely shrink desktop.

Create a dedicated mobile composition:
- no custom cursor
- touch-safe controls
- lighter 3D scenes
- fewer beans
- lower DPR
- shorter pin durations
- no interaction that blocks native scrolling

## CODE QUALITY

- no `any` without justification
- no monolithic page component
- no duplicated animation code
- no magic-number explosion
- keep motion constants centralized
- use data-driven rendering
- isolate WebGL lifecycle from UI lifecycle
- dispose Three.js resources
- avoid layout thrashing

## VISUAL QA

Before completion inspect:

- 390×844
- 768×1024
- 1440×900
- 1920×1080

Check:
- first-load transition
- hero balance
- 3D realism
- drag feel
- menu tilt
- scroll clock
- bean depth
- receipt printing
- typography wrapping
- mobile overflow
- reduced motion
- console

Take screenshots during the implementation and use them to refine spacing/timing. Do not stop at the first plausible render.

## GITHUB WORKFLOW

- Read the project skill guide in `ANTIGRAVITY_GITHUB_SKILLS.md`.
- Use the project feature branch strategy.
- Commit coherent milestones.
- Run CI before PR.
- PR body must contain:
  - summary
  - sections changed
  - animation/3D changes
  - performance notes
  - accessibility notes
  - verification commands
  - screenshot/GIF evidence when appropriate

## FINAL RULE

Do not deliver a generic coffee template.

The defining quality of this project is the relationship between:

TYPOGRAPHY
+ PHYSICAL OBJECTS
+ 3D DEPTH
+ POINTER INPUT
+ SCROLL PROGRESS
+ EDITORIAL SPACE
+ COFFEE RITUAL

Everything else should support those seven elements.
