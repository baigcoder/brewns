# ARCHITECTUE.md — System Architecture

> Filename intentionally preserves the requested spelling. Use this as the architecture source of truth.

## 1. Architecture principles

- Server-render as much static business content as possible.
- Isolate client-only WebGL and high-frequency pointer/scroll code.
- Treat animation as a subsystem, not scattered component logic.
- Use data-driven UI for menus, locations, and receipt content.
- Keep 3D assets replaceable without rewriting layout components.
- Never allow a canvas remount just because a prop such as `src`, selected item, or section state changed.
- Prefer CSS transform/opacity for DOM motion.
- Prefer refs / local animation state inside R3F for per-frame motion.

## 2. Recommended stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS or CSS Modules for authored layout styles
- React Three Fiber
- Three.js
- drei
- GSAP + ScrollTrigger
- Optional Lenis for smooth scrolling
- Optional Motion for low-cost component transitions
- Zod only if the eventual ordering/contact APIs need runtime validation
- ESLint + Prettier
- Playwright for visual/browser smoke tests

## 3. High-level component tree

```text
app/
  layout.tsx
  page.tsx
  menu/page.tsx                 # optional extension route
  shop/page.tsx                 # optional extension route
  story/page.tsx                # optional extension route
  locations/page.tsx            # optional extension route
  globals.css

components/
  site/
    SiteHeader.tsx
    MobileMenu.tsx
    SiteFooter.tsx
  intro/
    IntroLoader.tsx
    CupDrawing.tsx
  hero/
    Hero.tsx
    HeroMetadata.tsx
  three/
    ThreeViewport.tsx
    CoffeeStudioScene.tsx
    CoffeeStudioModel.tsx
    CoffeeClockScene.tsx
    BeanFieldScene.tsx
    useThreeVisibility.ts
    usePointerTarget.ts
    sceneConfig.ts
  menu/
    FeaturedMenu.tsx
    MenuCard.tsx
    MenuGrid.tsx
  shop/
    ShopSection.tsx
    ProductProduct.tsx
  story/
    PhilosophySection.tsx
    StoryImage.tsx
  locations/
    LocationsSection.tsx
    LocationRow.tsx
  order/
    OrderCTA.tsx
    ThermalPrinter.tsx
    Receipt.tsx
  motion/
    Reveal.tsx
    ClipReveal.tsx
    MagneticButton.tsx
    CursorProvider.tsx

data/
  menu.ts
  products.ts
  locations.ts
  story.ts
  receipt.ts

lib/
  motion/
    timings.ts
    easings.ts
    scroll.ts
  three/
    loaders.ts
    quality.ts
    dispose.ts
    capabilities.ts

public/
  models/
  textures/
  images/
  fonts/
```

## 4. Rendering boundaries

### Server components
Use server components for:
- metadata
- static headings
- menu data rendering shells
- locations
- footer
- structured business information

### Client components
Use client components only where needed:
- pointer-driven DOM effects
- GSAP timelines
- smooth scroll integration
- 3D scenes
- receipt animation state
- mobile menu open/close state

## 5. Three.js scene lifecycle

Each major WebGL section gets one stable canvas or one intentionally scoped canvas.

Rules:
- Do not set a React `key` that causes the canvas/3D scene to remount on ordinary content changes.
- Use refs for objects that animate every frame.
- Load GLTF/GLB via `useGLTF` or a dedicated loader layer.
- Dispose on permanent unmount.
- Pause or reduce work when `IntersectionObserver` reports the scene is not visible.
- Use `frameloop="demand"` where continuous animation is unnecessary.

## 6. Pointer architecture

Do not put `pointermove` coordinates into React state at frame frequency.

Use:

```ts
const pointer = useRef({ x: 0, y: 0 });

function onPointerMove(e: PointerEvent) {
  pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
}
```

Then interpolate in an animation/render loop or GSAP quickSetter.

## 7. Scroll architecture

Use a single scroll source of truth.

- GSAP ScrollTrigger maps section progress to motion.
- Do not combine multiple independent scroll listeners for the same scene.
- When using Lenis, synchronize it with ScrollTrigger.
- Pinned sections should be rare and intentionally sized.
- Every scroll-driven scene needs a static fallback composition.

## 8. Suggested animation API

```ts
export const motion = {
  fast: 0.35,
  medium: 0.7,
  slow: 1.15,
  hero: 1.25,
  pageTransition: 0.55,
  hover: 0.22,
};

export const easings = {
  smooth: 'power3.out',
  soft: 'power2.out',
  physical: 'power4.out',
};
```

These are starting values, not mandatory literals. Tune against the browser.

## 9. Asset architecture

### 3D
Prefer `.glb`/`.gltf` with:
- baked or compressed textures
- appropriate texture dimensions
- DRACO/Meshopt only when the loader and deployment pipeline support them

### 2D
Use:
- WebP/AVIF for photographic assets when supported
- SVG for line-art/interface marks
- PNG only where alpha quality requires it

### Fonts
Use `next/font` whenever the chosen typefaces permit it.

## 10. State architecture

Keep the prototype mostly local/static.

Suggested state:
- `mobileMenuOpen`
- `reducedMotion`
- `activeLocation`
- `hoveredProduct`
- `receiptPrinted`

Do not introduce Zustand/Redux for simple page-local state.

## 11. Testing architecture

### Unit/component
- motion utility pure functions
- formatting helpers
- data validation

### Browser
- page loads
- navigation anchors work
- mobile menu opens/closes
- order CTA is reachable
- receipt completes
- reduced-motion mode preserves content
- no horizontal overflow

### Visual
Capture screenshots at:
- 390x844
- 768x1024
- 1440x900
- 1920x1080

Compare each major section against the design spec.
