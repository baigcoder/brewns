# ANTIGRAVITY_GITHUB_SKILLS.md — Skill Selection + GitHub Workflow

## 1. Current Antigravity skill model

Antigravity uses the open Agent Skills format: a skill is a folder containing a `SKILL.md` with instructions, optional scripts, examples, and resources. Current Antigravity documentation states that Antigravity defaults to `.agents/skills` and retains `.agent/skills` compatibility.

This project therefore keeps its local skills under:

```text
.agents/skills/
```

## 2. Recommended external/community skills for this project

A current public Antigravity-focused catalog exposes focused skills that map directly to this build. Use focused skills rather than enabling a giant generic workflow for every task.

### Creative/frontend

- `brainstorming`
- `frontend-design`
- `ui-ux-designer`
- `web-design-guidelines`
- `tailwind-design-system`
- `frontend-dev-guidelines`
- `react-best-practices`
- `react-nextjs-development`

### Three.js/WebGL

- `threejs-skills`
- `threejs-fundamentals`
- `threejs-interaction`
- `threejs-animation`
- `threejs-geometry`
- `threejs-lighting`
- `threejs-materials`
- `threejs-textures`
- `threejs-loaders`
- `threejs-postprocessing`

### Performance/accessibility

- `web-performance-optimization`
- `performance-optimizer`
- `performance-profiling`
- `wcag-audit-patterns`

### Planning/quality

- `plan-writing`
- `planning-with-files`
- `production-code-audit`
- `testing-patterns`
- `workflow-patterns`

### GitHub/Git

- `git-hooks-automation`
- `git-pr-workflows-git-workflow`
- `github-actions-templates`
- `github-automation`
- `github-workflow-automation`

## 3. Skill activation policy

Use the smallest relevant skill set for each phase.

Example:

### Intro/hero
```text
brainstorming
frontend-design
web-design-guidelines
```

### 3D studio
```text
threejs-skills
threejs-fundamentals
threejs-interaction
threejs-materials
threejs-lighting
threejs-loaders
```

### Scroll clock
```text
threejs-animation
threejs-interaction
frontend-design
```

### Optimization
```text
web-performance-optimization
performance-profiling
performance-optimizer
```

### Release
```text
production-code-audit
git-pr-workflows-git-workflow
github-actions-templates
```

## 4. Local project skill bundles

This repository also contains local focused skills:

```text
.agents/skills/
  cafe-reference-rebuild/
  threejs-cafe-interactions/
  visual-quality-gate/
  github-workflow/
```

Antigravity should discover these automatically from the project skill directory.

## 5. Install/update note

If the team chooses to use the community `antigravity-awesome-skills` library, install it through its documented installer and verify the resulting Antigravity skill directory before relying on exact names. Do not assume an external catalog has the same version as another machine.

Recommended principle:
- keep project-critical local skills in the repository
- use external skills for supplementary expertise
- never make the build dependent on a third-party skill being online

## 6. GitHub workflow

### Branches

```text
main
  ├── feat/intro-cup
  ├── feat/hero-editorial
  ├── feat/three-studio
  ├── feat/menu-interactions
  ├── feat/coffee-clock
  ├── feat/bean-field
  ├── feat/receipt
  └── chore/performance-a11y
```

### Commit style

```text
feat(intro): build cup draw and pour transition
feat(3d): add interactive coffee studio
feat(menu): add cursor-leaning product cards
feat(clock): map scroll progress to latte rotation
feat(order): add thermal receipt printing
perf(webgl): pause offscreen scenes and cap DPR
fix(mobile): remove horizontal overflow in shop section
```

### Pull request checklist

- [ ] PR links the relevant task IDs.
- [ ] Screenshot/video evidence added for visual changes.
- [ ] `npm run lint` or project equivalent passes.
- [ ] `npm run typecheck` or project equivalent passes.
- [ ] `npm run build` passes.
- [ ] Browser smoke tests pass.
- [ ] Desktop checked.
- [ ] Mobile checked.
- [ ] Reduced motion checked.
- [ ] No console errors.
- [ ] No secrets added.

## 7. Agent rule for GitHub operations

Never create a PR or claim CI success until local verification is complete. When GitHub access is available, use the repository's actual default branch, branch names, checks, and review state rather than assuming them.
