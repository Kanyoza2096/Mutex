---
name: Theme contrast lift
description: Why the dark-mode CSS variables were raised and which pages had raw hex overrides that also needed updating
---

# Theme contrast lift

The dark-mode neutral surfaces were too compressed — page bg, cards, and elevated surfaces were all near-black, making card boundaries invisible.

## The rule
`--color-brand-bg/surface/elevated/border` in `src/index.css` are the **single source of truth** for neutral surfaces. Every page must use `bg-brand-*` / `border-brand-*` Tailwind classes. Do NOT introduce `bg-[#hex]` arbitrary values for neutral backgrounds.

**Why:** Four pages (Dashboard, EmailService, MetaEngine, Monitoring) had bypassed the variables with raw hex overrides. When the variables were updated those pages stayed broken until the hex overrides were swept out.

## Current target values (dark mode)
- `--color-brand-bg: #080B12` — deepest layer / page canvas
- `--color-brand-surface: #0D111B` — cards / panels
- `--color-brand-elevated: #141A29` — tooltips / modals / raised surfaces
- `--color-brand-border: rgba(148,163,184,0.12)` — visible but not distracting
- `--color-brand-text-secondary: #A8BAD0` — slightly lifted for readability
- `--color-brand-text-muted: #718096` — slightly lifted for readability

## How to apply
- New cards/panels → `bg-brand-surface`
- Modals, tooltips, dropdowns → `bg-brand-elevated`
- Status/accent colours → leave at full saturation; they pop MORE once neutrals are lifted
- Never set `bg-[#0_____]` arbitrary values for card backgrounds
