---
name: visual-quality-gate
description: Audit premium frontend implementations against a design specification using browser screenshots, responsive checks, animation inspection, accessibility checks, and console/build verification.
---

# Visual Quality Gate

Before declaring a visual section complete:

1. Run the app in a real browser.
2. Inspect first-load behavior.
3. Inspect the section at desktop and mobile widths.
4. Check typography wrapping and whitespace.
5. Check WebGL interaction and scroll coupling.
6. Check reduced motion.
7. Check console errors and hydration warnings.
8. Check horizontal overflow.
9. Capture before/after screenshots when refining.
10. Record concrete evidence in the task/PR.

Do not accept a visually plausible first pass when the design spec calls for physical motion or 3D depth.
