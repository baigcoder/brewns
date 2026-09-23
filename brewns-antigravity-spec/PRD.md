# PRD — Premium 3D Café Website

## 0. Document status

- Status: Build-ready product requirements document
- Reference analyzed: `https://brewns-coffee.vercel.app/`
- Reference source: Brewns landing page + Templify public description
- Target: A new café brand with original copy, identity, imagery, and 3D assets
- Primary implementation target: Next.js + React + TypeScript + Three.js/React Three Fiber
- Motion: GSAP/ScrollTrigger; optional Lenis; Motion for small UI interactions
- Deployment target: Vercel or equivalent

## 1. Product vision

Create a one-page café experience where the website behaves like a physical coffee ritual. The user should progress from opening the cup, to discovering the product, to browsing the menu, to moving through time with a coffee clock, to seeing the café story, and finally receiving a physical-feeling printed order receipt.

The reference's public page describes this core sequence: a drawn cup fills and pours away; a bag and cup of beans sit in a lit studio that can be grabbed and spun; four product cards lean toward the cursor; an iced latte rotates around a clock face as the user scrolls; coffee beans drift behind a tilted cup; and a thermal printer feeds a receipt from its slot.

## 2. Goals

### G1 — Memorable first 5 seconds
The intro must have a recognizable signature: line-art cup → fill → pour-away transition → hero.

### G2 — Physical interaction
3D objects must feel touchable through constrained drag/orbit, pointer parallax, inertia, lighting, and contact shadows.

### G3 — Story through motion
Scroll is not merely a trigger for fade-ins. It drives a continuous visual narrative in selected sections.

### G4 — Premium editorial identity
Typography, whitespace, asymmetry, micro-labels, and photography should communicate a design-led café brand.

### G5 — Business usefulness
The experience must still make ordering, menu discovery, locations, opening hours, and contact information easy to find.

### G6 — Production quality
The site must work on mobile, support reduced motion, protect Core Web Vitals, and avoid making WebGL a hard dependency for content.

## 3. Non-goals

- Copying Brewns branding, logo, exact text, product names, proprietary assets, or source code.
- Building a full POS/checkout backend in the visual prototype.
- Making every section 3D.
- Using 3D merely as decoration with no interaction or narrative purpose.

## 4. Target users

1. First-time café visitors who want a strong impression and menu information.
2. Returning customers who want to order quickly.
3. People discovering the café through mobile/social search.
4. Café owners/marketing staff who need a site that is maintainable without rewriting animation code.

## 5. Information architecture

1. Navigation
2. Intro loader
3. Hero / now brewing
4. Interactive 3D product studio
5. Featured menu / favorites
6. Shop / take-home products
7. Time / coffee clock
8. Locations
9. Philosophy / story
10. Product/atmosphere visual section
11. Order CTA
12. Thermal receipt
13. Footer / contact / policies

## 6. Functional requirements

### FR-01 Navigation
- Desktop links for Shop, Menu, Story, Locations, Order Online.
- Cart/bag count can be `0` in the prototype.
- Mobile full-screen menu with staggered links.
- Anchor navigation must use real links/IDs.

### FR-02 Intro loader
- Draw SVG cup outline.
- Animate liquid fill.
- Add subtle steam.
- Execute a pour-away/cover transition into hero.
- Skip/shorten if the user has reduced motion enabled.
- Do not block page content longer than necessary.

### FR-03 Hero
- Editorial headline.
- One concise value proposition.
- Opening hours and location metadata.
- Primary order CTA.
- Secondary menu CTA.
- Layered ambient/parallax motion.

### FR-04 3D product studio
- Coffee bag, ceramic cup, beans, surface, lights.
- Pointer-reactive composition.
- Constrained drag/orbit interaction.
- Soft physical shadows and PBR materials.
- Idle animation must be subtle.

### FR-05 Featured menu
- At least four featured items.
- Product cards with image, name, description, price, and order affordance.
- Cards subtly lean toward cursor.
- Image and text can move at different depth ratios.

### FR-06 Shop
- At least seven products or a 07 PRODUCTS count in the design language.
- Editorial composition rather than a generic ecommerce grid.
- Quick product information.

### FR-07 Coffee clock
- Large clock face with 12 marks.
- Iced latte composition at center.
- Scroll position directly drives rotation/progress.
- Supporting copy changes by time band.
- Must remain understandable without motion.

### FR-08 Bean atmosphere
- Multiple coffee beans in a lightweight 3D field.
- Slow independent drifting motion.
- Instancing for performance.
- Scroll-linked cup tilt/camera movement.

### FR-09 Locations
- Multiple café locations or one location model that can scale.
- Address, opening hours, directions/map CTA.
- Hover/active state for location rows.

### FR-10 Story / philosophy
- Strong editorial headline.
- Large photography.
- Image mask/clip reveal.
- Scroll-based image scale and text reveal.

### FR-11 Order / receipt
- Order CTA near the end.
- Printer slot visual.
- Receipt feeds out vertically.
- Receipt includes order ID/date/payment/items/total/status/brand CTA.
- Final receipt settles with tiny physical movement.

### FR-12 Footer
- Brand wordmark.
- Contact.
- Locations.
- Hours.
- Privacy/terms.
- Copyright.

## 7. Content model

Use typed data instead of hardcoded repeated JSX.

```ts
type MenuItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image: string;
  featured?: boolean;
};

type Location = {
  id: string;
  name: string;
  address: string;
  hours: string;
  mapUrl?: string;
};

type StoryBlock = {
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  caption?: string;
};
```

## 8. Performance acceptance criteria

- Web content renders before the main 3D scenes finish loading.
- 3D is dynamically loaded and scoped by viewport/section visibility.
- Device pixel ratio is capped.
- Repeated beans use instancing.
- Heavy scenes pause when far outside the viewport.
- Mobile uses reduced geometry/effects.
- No persistent pointer-driven React state updates on every frame.
- No horizontal overflow at any supported viewport.

## 9. Accessibility acceptance criteria

- `prefers-reduced-motion` removes or simplifies heavy motion.
- Keyboard can reach every CTA and navigation link.
- Canvas is not the only source of meaning.
- All business-critical copy exists in semantic DOM.
- Images have meaningful alt text.
- Focus indicators are visible.
- Contrast remains readable on warm/cream backgrounds.

## 10. Definition of done

The product is done only when the full page works from fresh load through receipt, at desktop and mobile widths, with no console errors, no hydration mismatch, no obvious WebGL memory leak, and no major layout shift caused by late assets.
