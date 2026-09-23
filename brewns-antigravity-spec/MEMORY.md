# MEMORY.md — Project Working Memory

## Reference

Reference URL: `https://brewns-coffee.vercel.app/`
Reference identity: `brewns — Specialty Coffee House in San Francisco`
Reference technology publicly tagged by Templify: Next.js + Three.js.

## Observed page content

Navigation:
- Shop
- Menu
- Our Story
- Locations
- Order Online
- Bag 0

Hero:
- Specialty Coffee House
- COFFEE FOR YOUR / moment
- Short sourcing/brewing statement
- Opening hours
- Street address
- In-the-bag product label
- Slow roast / $18.00 shown in rendered text

Later content:
- Our Menu / Favorites Made Daily
- The Shop / Take Brewns Home
- 07 Products
- Clock visual
- Iced latte visual
- Three location rows in the reference copy
- Our Philosophy
- Matcha/café imagery
- Order #00025 visual text
- Order-ahead CTA
- Footer contact and legal links

## Publicly described interaction system

1. Drawn cup fills and pours away into opening sequence.
2. Bag + cup of beans form a lit 3D studio; user can grab/spin the scene.
3. Four product cards lean toward the user's hand/cursor.
4. Iced latte turns on a clock face as the user scrolls.
5. Coffee beans drift behind a tilted cup.
6. Thermal printer feeds a receipt from its slot.

## Known reference assets observed through public asset URLs

- `assets/menu/menu-receipt.webp` — thermal-style receipt graphic.
- `assets/locations/clock.webp` — white clock face with 12 numbers and tick marks.
- `assets/locations/cup.webp` — iced latte in transparent cup.
- `assets/order/bg-table.webp` — dark table/café food photography.
- `assets/order/printer.webp` — metallic printer slot strip.
- `assets/order/matcha-cup.webp` — iced matcha cup.

These are reference evidence only. Do not ship them as target-brand assets unless licensing/ownership is established independently.

## Source limitations

The live page exposes rendered DOM/text and public asset URLs. The original source repository is not publicly exposed by the reference page. Exact internal animation code, exact CSS token values, exact model topology, and exact timing curves are therefore not treated as known facts.

## Target implementation decisions

- Use original café branding.
- Use Next.js App Router + React + TypeScript.
- Use React Three Fiber for maintainable React-integrated 3D.
- Use GSAP ScrollTrigger for choreographed scroll sequences.
- Keep all content in typed data modules.
- Use dynamic imports and scene visibility gates for WebGL.
- Provide static/reduced-motion equivalents.

## Current status

- [x] Foundation
- [x] Intro
- [x] Hero (3D Models with Draco + PBR Lighting)
- [x] 3D studio (Constrained orbit + pointer tilt)
- [x] Menu (Tilt & Parallax)
- [x] Shop (Filterable 7 products)
- [x] Clock (Scroll-driven rotation)
- [x] Bean field (Instanced 3D drifting beans)
- [x] Story (Editorial layout + staggered reveals)
- [x] Locations (Live wait time badges)
- [x] Receipt (Thermal printer + physical tear-off gesture)
- [x] Next-Level Experiential Features:
  - Synthesized Web Audio API Ritual Soundscape (zero mp3s; cup clinks, bean clatter, paper ratchet, paper tear, liquid drops, soft clicks, haptic vibration)
  - Animated Header Sound Toggle Pill with persistent audio state
  - "Find Your Pour" Interactive Taste Calibrator Modal (3-step quiz, accord matching engine, direct Add to Bag)
  - Parabolic Liquid Droplet Cart Fly-in Animation with spring-physics bag counter bump
  - Interactive Receipt Tear-Off with downward drag resistance and audio rip
  - Time-aware SF café live wait badges
  - Universal PDP 3D Variety Rendering Engine (3D Cinnamon Roll with rising steam & high-gloss glaze expansion, transparent cold glasses with floating ice, real-time option updates)
- [x] QA & Verification (Zero console errors, verified via Puppeteer on Edge across all interactive states)

- [x] Dev Server live on http://localhost:3000

## Known engineering lessons to preserve

- Never use React keys that remount a WebGL player/scene during ordinary source changes.
- Never rely on identical URLs as animation triggers when a state transition must be observable; use explicit state/progress instead.
- Avoid hidden lifecycle contention from multiple scene instances.
- Keep high-frequency interaction data outside React render state.
- In animation loops, declare animation frame IDs (`let tickRaf = 0;`) in the outer scope before `requestAnimationFrame(tick)` to avoid Temporal Dead Zone `ReferenceError` during recursion.
- When generating markup files with TypeScript exports (`export const BREWNS_MARKUP = ...`), mutate the raw HTML and serialize with `JSON.stringify()` rather than naive string replacement in TS files to guarantee proper quote escaping.

