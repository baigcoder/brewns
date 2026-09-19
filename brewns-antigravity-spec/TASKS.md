# TASKS.md — Implementation Plan + Verification Gates

## How to use

Work top-to-bottom. Each task must be small enough to complete, test, and review. Update status directly in this file.

Legend:
- `[ ]` pending
- `[~]` active
- `[x]` verified
- `[!]` blocked

---

## Phase 0 — Repository reconnaissance

- [x] `T000` Inspect existing repository, package manager, Node version, routes, styling, linting, and asset pipeline.
- [x] `T001` Read `PRD.md`, `ARCHITECTUE.md`, `RULES.md`, `DESIGN.md`, `MEMORY.md`.
- [x] `T002` Inspect current Antigravity skills and activate/reuse relevant installed skills.

## Phase 1 — Foundation

- [x] `T010` Establish/normalize Next.js App Router structure.
- [x] `T011` Establish typography tokens and CSS variables.
- [x] `T012` Establish responsive grid and global spacing.
- [x] `T013` Add metadata/SEO/local-business structured data shell.
- [x] `T014` Build static semantic page skeleton with all sections visible without animation.

**Gate:** page is content-complete before WebGL work.

## Phase 2 — Navigation + intro

- [x] `T020` Implement desktop header.
- [x] `T021` Implement mobile full-screen menu.
- [x] `T022` Build SVG cup outline.
- [x] `T023` Animate cup stroke draw.
- [x] `T024` Animate coffee liquid fill.
- [x] `T025` Add steam and subtle liquid motion.
- [x] `T026` Build pour-away transition into hero.
- [x] `T027` Add reduced-motion intro alternative.

**Gate:** fresh load feels complete and intentional before the 3D studio appears.

## Phase 3 — Hero

- [x] `T030` Implement hero editorial composition.
- [x] `T031` Implement line/word clip reveals.
- [x] `T032` Add hero metadata and CTAs.
- [x] `T033` Add subtle parallax layers.
- [x] `T034` Verify mobile hero does not overflow.

## Phase 4 — 3D coffee studio

- [x] `T040` Source/create original coffee bag GLB.
- [x] `T041` Source/create original ceramic cup/saucer.
- [x] `T042` Source/create coffee bean geometry.
- [x] `T043` Build R3F scene and camera.
- [x] `T044` Configure PBR materials.
- [x] `T045` Add warm studio lighting/contact shadows.
- [x] `T046` Add pointer parallax.
- [x] `T047` Add constrained drag/orbit.
- [x] `T048` Add idle physical micro-motion.
- [x] `T049` Add visibility-based pause.
- [x] `T050` Add loading placeholder.
- [x] `T051` Dispose resources correctly.

**Gate:** no remount on ordinary state change; no visible stutter on supported desktop.

## Phase 5 — Menu interactions

- [x] `T060` Create typed menu data.
- [x] `T061` Build four featured menu cards.
- [x] `T062` Add cursor tilt.
- [x] `T063` Add image parallax depth.
- [x] `T064` Add hover CTA behavior.
- [x] `T065` Add touch-safe mobile behavior.

## Phase 6 — Shop

- [x] `T070` Build seven-product data model.
- [x] `T071` Build editorial shop composition.
- [x] `T072` Add product micro-interactions.
- [x] `T073` Add order/cart placeholder behavior.

## Phase 7 — Clock scene

- [x] `T080` Build clock geometry/DOM composition.
- [x] `T081` Add iced latte asset/model.
- [x] `T082` Map scroll progress to rotation.
- [x] `T083` Add smoothing/inertial response.
- [x] `T084` Add time-band copy states.
- [x] `T085` Add responsive/mobile simplified scene.
- [x] `T086` Add static reduced-motion state.

**Gate:** scrolling must feel coupled to the scene, not like a separate autoplay animation.

## Phase 8 — Bean field

- [x] `T090` Implement instanced bean mesh.
- [x] `T091` Add deterministic transforms.
- [x] `T092` Add independent slow drift.
- [x] `T093` Add tilted cup composition.
- [x] `T094` Link cup/camera to scroll.
- [x] `T095` Reduce density on mobile.

## Phase 9 — Story / philosophy

- [x] `T100` Build story layout.
- [x] `T101` Implement image clip reveals.
- [x] `T102` Implement image scale/scroll parallax.
- [x] `T103` Add text stagger.

## Phase 10 — Locations

- [x] `T110` Build typed locations data.
- [x] `T111` Build location rows.
- [x] `T112` Add hover/active states.
- [x] `T113` Add direction/map links.

## Phase 11 — Order + receipt

- [x] `T120` Build order CTA.
- [x] `T121` Build printer housing.
- [x] `T122` Build receipt typography.
- [x] `T123` Animate paper feed.
- [x] `T124` Synchronize content reveal with paper position.
- [x] `T125` Add physical settle/recoil.
- [x] `T126` Add reduced-motion fallback.

## Phase 12 — Accessibility

- [x] `T130` Add prefers-reduced-motion behavior.
- [x] `T131` Keyboard navigation audit.
- [x] `T132` Focus states audit.
- [x] `T133` Alt text audit.
- [x] `T134` Contrast audit.

## Phase 13 — Performance

- [x] `T140` Dynamic import heavy scenes.
- [x] `T141` Cap DPR.
- [x] `T142` Compress/resize textures.
- [x] `T143` Use instancing for beans.
- [x] `T144` Pause invisible scenes.
- [x] `T145` Audit bundle size.
- [x] `T146` Test slow CPU/network.

## Phase 14 — Browser QA

- [ ] `T150` Desktop 1440x900 screenshot review.
- [ ] `T151` Desktop 1920x1080 screenshot review.
- [ ] `T152` Mobile 390x844 screenshot review.
- [ ] `T153` Tablet 768x1024 screenshot review.
- [ ] `T154` Test navigation anchors.
- [ ] `T155` Test menu open/close.
- [ ] `T156` Test drag interaction.
- [ ] `T157` Test cursor card tilt.
- [ ] `T158` Test scroll clock.
- [ ] `T159` Test receipt completion.
- [ ] `T160` Test reduced-motion mode.
- [ ] `T161` Verify no console errors.
- [ ] `T162` Verify no horizontal scroll.

## Phase 15 — GitHub delivery

- [ ] `T170` Create feature branch.
- [ ] `T171` Commit in coherent milestones.
- [ ] `T172` Run CI.
- [ ] `T173` Open PR with screenshots/GIFs and verification summary.
- [ ] `T174` Resolve review comments.
- [ ] `T175` Merge and deploy.
- [ ] `T176` Record deployed URL in `MEMORY.md`.
