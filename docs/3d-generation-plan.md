# Real-3D plan for the 32 remaining products: feasibility and strategy

Status: **phases 1-4 built and verified; every catalogue product with a viewer is now a verified 3D model; nothing downloaded.** The AI downloads in section 3 are still unapproved and unused.

## Phase 6 result (content consistency and cleanup)

Ethiopia bag: catalogue notes and facts printed, no roasting city, no roast date on either bag design, photograph kept as
evidence and its conflict with the catalogue documented (owner confirmation still needed on which packaging is right).
Evidence directory trimmed 132 MB -> 24 MB (regenerable frames only). 103 tests, typecheck, build clean; lint unchanged (one
pre-existing warning in `components/console/Live.tsx`). Browser: bags verified at 4 angles, 28/28 matrix, 4/4 fallbacks, 4/4 cart.

## Phase 5 result (release readiness)

42/42 products pass the new options -> cart -> bag -> reload audit; 91/91 matrix rows, 26/26 fallbacks, 58/58 option
selections. Visual fixes: nitro ice (it was invisible), cortado heart, pesto two-tone, alfredo, cinnamon glaze, sauces,
bun warming. Content integrity: the Ethiopia bag no longer prints a roasting city (the photo says Copenhagen, the catalogue
says Lahore for the other bag and nothing for this one) and both bags print the photographed roast date instead of one made
from the clock. **Three items need the owner**: Ethiopia's roasting city, the roast date wording, and Ethiopia's flavour
notes (photograph and catalogue disagree). No product was downgraded, none newly promoted, nothing downloaded.

## Phase 4 result (final fidelity pass)

Ethiopia Yirgacheffe is now a verified 3D bag (reconstructed artwork, gussets plain; 7/7 widths). BBQ lettuce and bun gap,
sauces, croissant shell and underside, and the options that did nothing (garlic-bread cheese, croissant warming, zinger /
tender / arrabbiata spice, lime-soda salt, tumbler lid) were fixed; 77/77 matrix rows, 22/22 fallbacks, 46/46 options,
103 tests, build clean. **No product is on TILT VIEW or PHOTO ONLY any more**, but that is "every model passes the quality
gate with documented differences", not "every model matches its photograph": see the audit's open items. The lifecycle
review found the viewer disposes correctly; the residual idle cost is the site-wide ticker and hero scenes (unchanged).
Nothing was downloaded and no AI tooling was used.

## Phase 3 result (burgers, rolls, sides, cut croissant: 10 of 10)

All ten are procedural `3D VIEW` and **VERIFIED PASS** (70/70 matrix rows, burgers re-run 21/21, 20/20 fallbacks, 35/35
option selections; per-product notes in `docs/3d-product-audit.md`). The butter croissant got a real cut-open model, and the
smash burger's `+ CHEESE` / `+ PATTY` options, which previously did nothing, now change the model. **No product remains
on TILT VIEW.** Procedural modelling was sufficient everywhere, so the TripoSR escalation in section 3 was not needed and
stays unapproved and unused. Weakest results (BBQ lettuce, sauces, croissant shell) are listed in the audit.

## Phase 2 result (plated food and bakery, 13 of 14)

3 pizzas, 3 pastas and 7 of 8 bakery items are now real 3D (`3D VIEW`), all procedural, no AI and no new dependency; all
**VERIFIED PASS** (98/98 matrix rows, 26/26 fallbacks, 41/41 option selections; notes in `docs/3d-product-audit.md`). The
butter croissant stays `TILT VIEW` because its photo is a cut-open croissant. **10 products remain on TILT VIEW**: 3
burgers, 3 rolls and wraps, fries, tenders, garlic bread, and the butter croissant. Proposed next category: burgers, rolls
and sides (9), the group that would need the TripoSR approval in section 3 if hand-built models do not match; the butter
croissant needs a cut-open model.

## Phase 1 result (drinkware, 9 of 32)

Mint margarita, peach iced tea, mango smoothie, lime soda, cortado, nitro cold brew, flat white, mocha and the ceramic
tumbler are now real 3D (`3D VIEW`), all procedural, no AI and no new dependency. All nine: **VERIFIED PASS** (with the
notes in `docs/3d-product-audit.md`). 23 products remain on TILT VIEW: 3 burgers, 3 pastas, 3 rolls and wraps, 3 pizzas,
fries, tenders, garlic bread and 8 bakery items. Proposed next category: **plated food and bakery (14)**, which also needs no
download; the burgers, rolls and sides (9) are the group that would need the TripoSR approval.

## 1. What exists

- 42 products. 10 are done: espresso, latte, slow roast, iced matcha, iced latte, cappuccino, Spanish latte, Americano
  have real models that pass; Ethiopia bag is PHOTO ONLY; gift card is its own view.
- The other 32 currently show **TILT VIEW** (photo in relief, a few degrees only). Per the brief they stay labelled
  TILT VIEW, or PHOTO ONLY, until a real model passes inspection.
- Each has **one photograph** (26 webp in `public/assets/menu`, the rest under `public/assets/kitchen`); 23 catalogue
  entries are cutouts. One view means unseen sides can only be inferred, never exact.
- Existing procedural models live in `foodModels3d.ts`, `kitchenModels3d.ts`, `bakeryModels3d.ts`, `glassModels3d.ts`,
  `drinkModels3d.ts`, `cupModels3d.ts`. They are the hand-built shapes the audit found do not look like the photos.
  Only two GLBs exist besides the hero (`cinnamon-roll.glb`, `iced-cup.glb`).

## 2. Groups and the proposed method per group

| Group | Products | Method | Why |
|---|---|---|---|
| Rotational drinkware | cortado, nitro cold brew, mint margarita, peach iced tea, mango smoothie, lime soda, flat white, mocha, ceramic tumbler | **Procedural lathe geometry** matched to each photo's silhouette (profile traced from the cutout), glass/ceramic/chrome materials, real artwork or logo mapped where printed (tumbler wordmark) | Surfaces of revolution are exact from one view; no AI needed |
| Plated rotational food | 3 pastas, 3 pizzas, 8 bakery items, cheesecake, tiramisu, brownie | **Procedural base** (plate, pizza disc, bun) with **photo-sampled top texture** for the visible face; AI mesh only for irregular parts if it passes review | Plates and discs are exact; toppings are the hard part |
| Stacked food | 3 burgers, 3 rolls/wrap, fries, tenders, garlic bread | **AI image-to-3D start mesh** (section 3), then fixed by hand: proportions, layers, bun, texture | Irregular organic shapes; hand-modelling in code did not match the photos |
| Packaging | none left (both bags done) | n/a | |

Every result is compared with its photo (front, 3/4, side, rear screenshots, side by side), rotation is tested, and a
product that fails stays TILT VIEW or PHOTO ONLY. Rear and side surfaces will be flagged as inferred, never exact.
Extra reference photos (back/side of the burger, wrap, etc.) would improve fidelity most; I will list which ones help.

## 3. AI image-to-3D: practical here?

Machine: Windows 11, 31.8 GB RAM, **Quadro T1000 4 GB VRAM**, Intel UHD, no CUDA Python stack installed (no torch),
Python 3.12, **F: 9.7 GB free, C: 17.1 GB free**.

Candidates (figures are from memory and **must be re-checked on the model pages before downloading**):

| Tool | Licence (to verify) | Weights / install | Fit for this machine |
|---|---|---|---|
| **TripoSR** | MIT | ~1.7 GB weights; torch (~2.5 GB CUDA wheel or ~0.2 GB CPU wheel) plus rembg (u2net ~170 MB, not needed: photos are cutouts) | Designed for low VRAM; 4 GB is marginal, **CPU run is feasible** (slow, minutes per object). Output is a coarse mesh with per-vertex colour; back is hallucinated. **Best fit.** |
| InstantMesh / TRELLIS / Hunyuan3D | Apache-2 / MIT / restricted-region licence | 10 GB+ weights, 12-24 GB VRAM | **Not practical** on 4 GB; would need cloud GPU |
| Cloud API image-to-3D services | paid, terms vary | none local | Sends product photos to a third party; needs your approval and a key. Not recommended without your say |

Estimated footprint for TripoSR: about 4-5 GB on C: (torch + weights + caches), none in the repo besides the final GLBs.
Run it in an isolated Python virtual environment in a new empty folder, scripts kept elsewhere, as the safety rules for
downloaded code require. I would pin versions, read the repo's code before running it, and keep everything out of `F:\brewns-clean`
except the exported meshes.

Expected honest quality: TripoSR meshes of food are blobby and low-resolution. They are a **starting point**, not final;
the texture will need re-projection from the real photo for the front and careful treatment elsewhere.

## 4. Proposed order (one category at a time, review after each)

1. Drinkware (9): procedural lathe, fastest and most reliable, verify, ship.
2. Plated food and bakery (14): procedural base plus photo texture.
3. Burgers, rolls, sides (9): AI start meshes, repaired, only if they pass.
4. For each: comparison sheet, rotation test, matrix run, audit doc row, status; failures stay TILT VIEW.

## 5. Needs your approval before I proceed

- Create a Python venv and install CPU PyTorch (about 0.2 GB) and TripoSR's dependencies.
- Download TripoSR weights (about 1.7 GB) from Hugging Face.
- Disk use on C: of roughly 4-5 GB; nothing on F: beyond exported GLBs.

Categories 1 and 2 need **none of this**, so they can start now.
