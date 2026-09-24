# brewns

Website for **brewns**, a specialty coffee house in San Francisco: menu, a shop
with interactive 3D product views, three locations, and order-ahead with a
thermal-printer receipt.

Next.js 16 · React 19 · three.js · Lenis smooth scroll · Bun

## Getting started

```bash
bun install
bun run dev        # http://localhost:3000
```

| Command | What it does |
|---|---|
| `bun run dev` | Dev server (Turbopack). Writes to `.next/dev`, so it can run alongside a build. |
| `bun run build` | Production build. Type-checks, then prerenders every route as static. |
| `bun run start` | Serve the production build. |
| `bun run typecheck` | `tsc --noEmit` with TypeScript 7. |
| `bun run lint` | ESLint 9 with `eslint-config-next/core-web-vitals`. |
| `bun run build:models` | Regenerate the shop's glTF models (see [3D](#3d-product-views)). |

## How it works

The whole site is one client component that injects static markup and then
brings it to life.

```
app/page.tsx
└─ components/brewns/BrewnsApp.tsx      injects the markup, runs the engine
   ├─ brewnsMarkup.ts                   every section's HTML, as one string
   ├─ initBrewns.ts                     behaviour: motion, shop, bag, checkout
   │  ├─ pdp3dEngine.ts                 3D models for the product pages
   │  ├─ TasteCalibrator.ts             the "find your pour" taste quiz
   │  └─ lib/audio-ritual.ts            the café sound toggle
   └─ app/globals.css                   all styling
```

Sections, top to bottom: `#hero`, `#menu`, `#shop`, `#locations`, `#story`,
`#reviews`, `#order`, then the footer `#ftr`.

### Motion is declarative

Markup opts into behaviour with data attributes, and `initBrewns.ts` wires them
all up once the markup is in the page. To animate something new, add an
attribute rather than writing code.

| Attribute | Effect |
|---|---|
| `data-iv="rise\|print\|fade\|zoom\|rule-x\|rule-y\|script"` | Reveal when scrolled into view. `data-d` sets a delay in ms, `data-y` a rise distance. |
| `data-te="lines\|words"` | Split text into lines or words and reveal them in sequence. |
| `data-dr` | Roll each digit into place, like a counter. |
| `data-rise` | Simple fade-and-rise, used for list items. |
| `data-ul`, `data-cta` | Link underline and CTA arrow hover effects. |
| `data-pulse` | Pulsing status dot. |
| `data-swirl` | The brush-stroke fill behind light sections. |
| `.lean` wrapper | The card tilts toward the cursor. |
| `data-header-theme="light\|dark"` | Header colour while this section is under it. |

With reduced motion on, the engine skips the animations and sets each element
to its final state. Elements that start at `opacity: 0` in CSS (`.card`,
`.rev-slip` and others) are also listed in the `prefers-reduced-motion` rule in
`globals.css` as a fallback. If you add another, add it to that rule too.

### Where the content lives

Data is defined inline in `components/brewns/initBrewns.ts`:

| Constant | Drives |
|---|---|
| `PRODUCTS` | The shop grid and product pages: prices, options, 3D model. |
| `ALL_MENU_CARDS` | The menu section's cards. |
| `FULL_MENU_SECTIONS` | The full café menu dialog. |
| `REVIEWS`, `RATINGS`, `OVERHEARD` | The reviews section: slips, rating bars, ticker. |
| `RECEIPT_ITEMS` | The sample order printed on the receipt. |
| `LOCS` | Shop addresses. |
| `COLUMNS` | Footer navigation. |

Prices appear in `PRODUCTS` as numbers (`4.2`) and in `ALL_MENU_CARDS` and
`FULL_MENU_SECTIONS` as strings (`"$4.20"`). Change a price in all of them.

Opening hours, tax and pickup lead time are the checkout's `OPEN_MIN`,
`CLOSE_MIN`, `TAX` and `PREP_MIN`. The footer's "Open now / Closed" and the
receipt's ready time read the same values, so they can't disagree with the
checkout.

## 3D product views

Every product page has a 3D view. `createProduct3DModel` in `pdp3dEngine.ts`
chooses a model by product id:

- **Most products** are built procedurally in `pdp3dEngine.ts`, from three.js
  primitives and canvas-painted textures.
- **The iced drinks and the cinnamon roll** use real glTF assets:
  `public/assets/shop/iced-cup.glb` and `cinnamon-roll.glb`. Only the product
  that needs one downloads it, and both iced drinks share one file.
- **The coffee bag and hot cup** come from `public/assets/hero/models.glb`. Their print
  (the dark edition: matte black stock, gold wordmark and rules, cream type) is
  not the file's own texture. `dressPackaging` in `pdp3dEngine.ts` draws it at
  runtime, per product, for the hero, the shop and every product view. Change
  a product's name, notes or size on the pack in `PACKAGING_LABELS`.

The glTF assets are generated from source, not hand-modelled. They are not
meant to be edited directly:

```bash
bun run build:models    # scripts/build-models.mjs + scripts/lib/model-kit.mjs
```

This writes the geometry (surfaces of revolution, a swept spiral for the roll,
rounded-cube ice), then Draco-compresses it. The files carry geometry only. The
engine binds materials and textures to their nodes by name (`Cup`, `Liquid`,
`Lid`, `Straw`, `Ice_0`…, `Roll`, `Glaze`…), which is how one cup serves both
the matcha and the latte.

**After regenerating, bump `MODELS_VERSION` in `initBrewns.ts`.** It's in the
model URLs, so browsers can't keep serving a stale cached copy.

When writing a revolved profile in `model-kit.mjs`, walk it so the solid stays
on your left. Walk it the other way and the surface comes out inside-out, and
you can see straight through it.

## TypeScript and linting

- **TypeScript 7 and 6 are installed side by side.** TypeScript 7 has no
  programmatic API yet (planned for 7.1), and `typescript-eslint` needs one. So,
  [as the TypeScript team recommends](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/),
  `typescript` is 6.0 and 7 is installed as `@typescript/native`. Both ship a
  `tsc` binary, so `bun run typecheck` calls 7 by path. (`typescript` used to be
  the `@typescript/typescript6` compatibility build, but Bun resolves that
  package's own `typescript@6` dependency back to itself, leaving an empty
  module that crashes ESLint.) Drop 6 once `typescript-eslint` supports 7.
- **ESLint is pinned to 9.** `eslint-plugin-react`, which `eslint-config-next`
  includes, doesn't work with ESLint 10 yet.
- **`initBrewns.ts` and `pdp3dEngine.ts` are `// @ts-nocheck`,** so the compiler
  doesn't check them. That includes duplicate declarations: a second
  `const money` passes `tsc` and then Turbopack fails to compile the page, which
  renders blank. Lint catches it with `@typescript-eslint/no-redeclare`, so run
  `bun run lint` after editing either file.

## Layout

```
app/                 layout (metadata, fonts), page, global CSS, icon
components/brewns/   the site (see "How it works")
lib/                 audio-ritual.ts
public/assets/       fonts, images and 3D models, by section
public/draco/        Draco decoder for compressed models
scripts/             model generator, QA scripts, one-off patchers
brewns-antigravity-spec/   product spec, design notes, task list
```

About `scripts/`:

- **Maintained:** `build-models.mjs` and `lib/model-kit.mjs`.
- **QA:** `verify-*.mjs` and `test-*` drive headless Microsoft Edge through
  `puppeteer-core` to screenshot and check the site. They hard-code the Edge
  path and an output folder from the machine they were written on. Adjust both
  before running them elsewhere.
- **One-off patchers:** `build-brewns-*`, `update-markup*`, `inject-*`,
  `append-*`, `fix-*`, `prepare-css`. These have already been applied and are
  kept for history. Don't re-run them. They patch `brewnsMarkup.ts` by string
  matching and would duplicate or clobber what's there now.

## Before going live

This is a working demo, not a trading site:

- **Ordering is client-side only.** "Place order" saves the order to the
  browser's `localStorage` and makes no network request. Nothing reaches the
  café. A real launch needs an ordering backend and payments.
- **Some content is placeholder.** The reviews and their names, the 4.9 rating
  and its breakdown, the press quote and the "LIVE WAIT ~4 MIN" badges (which
  follow the time of day) are all invented. Replace them with real data before
  publishing. Invented reviews presented as genuine are a legal problem, not
  just a style one.
- **Products aren't indexable.** Product pages are `#shop/<id>` hash routes, and
  there is no sitemap or social-share image.

## Troubleshooting

**`bun run typecheck` or `bun run lint` fails with `bun: unknown error`** on
Windows with Smart App Control / Application Control on. The policy blocks the
`.exe` launchers Bun puts in `node_modules/.bin`. Run the same tools through
Bun directly:

```bash
bun x tsc --noEmit
bun x eslint .
```
