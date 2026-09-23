# RULES.md — Non-Negotiable Build Rules

## 1. Reference fidelity rules

1. Reproduce the **interaction principles**, not the Brewns brand.
2. Preserve the observed sequence of interactions where appropriate:
   - cup draw/fill/pour
   - 3D grab/spin
   - cursor-leaning products
   - scroll-driven coffee clock
   - floating beans + tilted cup
   - thermal receipt print
3. All brand copy, products, imagery, logos, prices, locations, and model textures must be original to the target café.
4. Never pretend an implementation detail is known when it was not observable.
5. Distinguish `OBSERVED`, `INFERRED`, and `TARGET IMPLEMENTATION` in notes when analyzing behavior.

## 2. Visual rules

- Premium editorial composition over generic restaurant template.
- Warm neutral paper/cream base is the default direction.
- Black/espresso typography with restrained accent colors.
- Large display type, small metadata, generous whitespace.
- Prefer asymmetry and intentional negative space.
- Avoid excessive rounded cards.
- Avoid generic glassmorphism.
- Avoid purple/blue AI gradients.
- Avoid decorative motion that has no narrative function.

## 3. Motion rules

- Every animation needs a purpose: reveal, depth, physicality, navigation, or storytelling.
- No random continuous animation on every DOM element.
- Hover rotations stay small.
- DOM transform/opacity should be preferred over layout properties.
- Scroll should drive progress continuously; avoid unrelated threshold-triggered jumps.
- Use one motion system per concern. GSAP for choreographed timelines; R3F refs for per-frame 3D motion.
- Respect `prefers-reduced-motion`.

## 4. Three.js rules

- No React state updates per render frame.
- No expensive post-processing unless the visual gain is clear.
- Cap DPR.
- Use instancing for many repeated beans.
- Avoid rebuilding geometries/materials in render.
- Dispose resources on unmount.
- Do not remount the main 3D canvas on product/scene changes.
- Keep drag/orbit limits constrained and physically plausible.

## 5. Interaction rules

### Desktop
- Custom cursor is allowed, but keep it small.
- Product cards respond to pointer position with a few degrees of rotation.
- Buttons may use a modest magnetic effect.

### Touch
- Never require hover to understand content.
- Replace hover-only behaviors with tap/drag or passive motion.
- Keep drag surfaces generous.

## 6. Content rules

- No Lorem Ipsum.
- No placeholder business claims presented as real.
- All pricing and opening hours must come from project data.
- All images need alt text unless intentionally decorative.

## 7. Engineering rules

- TypeScript strict mode.
- Small focused components.
- Prefer data maps over repeated markup.
- No `any` unless there is a documented integration reason.
- No secrets in client code or repository.
- No unexplained `setInterval` loops for animation.
- No arbitrary giant z-index values.
- No disabling ESLint/TypeScript checks to make the build pass.

## 8. Quality gate rules

Before marking any phase complete:

1. Run lint/typecheck.
2. Run build.
3. Run browser smoke tests.
4. Visually inspect the affected section.
5. Check mobile width.
6. Check reduced-motion mode.
7. Check console for warnings/errors.
8. Record evidence in the task/PR description.

## 9. Git rules

- Work on feature branches.
- One coherent feature per commit where practical.
- Use conventional commit style.
- Keep commits reviewable.
- Never commit generated secrets or `.env` values.
- PR descriptions must state visual behavior changed and verification performed.

## 10. Agent behavior

- Read `PRD.md`, `ARCHITECTUE.md`, `DESIGN.md`, `TASKS.md`, and `MEMORY.md` before substantial changes.
- Prefer an implementation plan before coding a large animation.
- Reuse existing abstractions instead of introducing duplicates.
- Measure before optimizing.
- When a browser issue appears, diagnose the lifecycle/state root cause before patching symptoms.
