---
name: Chrome UI ghost/duplication fix
description: Root cause and fix for duplicated/ghosted UI elements in Chrome mobile
---

# Chrome UI Ghost / Duplication Bug

## The Rule
Never apply `backface-visibility: hidden` or `will-change: transform` to the `*` selector (all elements) in CSS.

**Why:** On Chrome (including Chrome mobile), applying `backface-visibility: hidden` to every element forces the GPU compositor to create a new stacking context for each element. This manifests as ghost/duplicated paint artifacts — UI content appears rendered twice, stacked with a slight offset, in the paint output. The bug is visually severe on mobile Chrome.

**How to apply:** Only add `will-change: transform` and GPU acceleration hints to genuinely animated elements (`.animate-spin`, `.animate-pulse`, `canvas`, etc.). See `src/index.css` for the correct pattern.

## Additional fixes applied
- `ParticleBackground.tsx` had a React rules-of-hooks violation: an early return before `useEffect` caused hooks to run conditionally. Fixed by computing the Chrome-mobile check inside `useEffect` instead of before it.
- `animation-duration: 0s !important` applied to `[class*="motion-"]` on Chrome mobile killed all Framer Motion transitions. Removed.
- Mobile `backdrop-blur` override was injecting `background-color: rgba(9,9,11,0.97)` on ALL backdrop elements — this made sidebars and modals render as solid near-black. Replaced with targeted `nav.backdrop-blur-xl` and `header.backdrop-blur-xl` selectors using the proper CSS variable.

## Files
- `src/index.css` — contains warning comment block about this constraint
- `src/components/ParticleBackground.tsx` — hooks violation fixed
