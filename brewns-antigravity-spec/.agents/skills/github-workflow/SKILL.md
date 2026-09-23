---
name: github-workflow
description: Apply disciplined GitHub delivery to the café website project, including feature branches, coherent commits, CI verification, visual evidence, and review-ready pull requests.
---

# GitHub Workflow

## Branching

Use `feat/<area>` for features and `fix/<area>` for corrections.

## Commit discipline

Make commits narrow and meaningful. Include the user-visible feature in the subject.

## Verification

Before a PR:
- lint
- typecheck
- build
- browser smoke tests
- responsive checks
- reduced-motion check

## PR evidence

For animation/3D work, include screenshots or a short recording and describe the motion model, performance measures, and accessibility fallback.

Never state CI passed unless the actual check completed successfully.
