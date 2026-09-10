---
name: glyphfield-icon-leaves
description: Independently bundled aliases for shared Studio icons.
---

# Shared icon leaves

Keep each public alias in its own module, imported from the supported Phosphor
per-icon SSR entry. Re-export it from ../SolidIcons.tsx for compatibility.
The local package.json marks only this directory side-effect-free for bundling;
keep initialization pure and do not add CSS imports or runtime registrations here.
weightedIcon preserves the existing default weight, explicit overrides, SVG refs,
and display name; do not replace artwork or drop supported weights to save bytes.
Run ../__tests__/SolidIcons.test.tsx after changes. The parent components/SKILL.md
owns contribution and accessibility rules.
