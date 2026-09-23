---
name: threejs-cafe-interactions
description: Build performant tactile Three.js/React Three Fiber scenes for café products, including constrained drag, pointer parallax, scroll-linked rotation, instanced coffee beans, PBR materials, and stable scene lifecycles.
---

# Three.js Café Interactions

## Core constraints

- Keep the canvas mounted while ordinary React state changes.
- Use refs for per-frame values.
- Avoid React renders from pointer/scroll frame updates.
- Cap DPR and use device capability checks.
- Pause offscreen scenes.
- Instance repeated geometry.
- Dispose models/materials/textures on permanent unmount.

## Interaction patterns

### Pointer parallax
Map normalized pointer coordinates to small rotation/position targets and smooth with lerp/damping.

### Drag/orbit
Use constrained orbit or custom drag rotation. Clamp polar angle. Add damping. Return toward a preferred orientation when interaction ends.

### Scroll-linked scene
Use a single normalized `progress` from ScrollTrigger. Convert progress into object/camera targets. Smooth only the target-to-current interpolation; do not disconnect scene motion from scroll progress.

### Bean field
Prefer `InstancedMesh`, seeded transforms, independent phases, and shallow depth distribution.

## Visual rule

Physicality comes from lighting, contact shadow, scale, inertia, roughness, and composition—not from extreme rotations.
