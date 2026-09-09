---
name: scripts-lib-skill
description: Native Safari regression helpers and input-delivery diagnostics.
---

# glyphfield / scripts/lib

## Purpose
<!-- agent-docs:fill:purpose -->
Support `scripts/check-safari-canvas.mjs` with repeatable native browser checks,
separating product failures from WebDriver input or focus failures.

## Mental model & key files
<!-- agent-docs:fill:model -->
`safari-native-click.mjs` measures trusted pointer delivery.
`safari-tab-checks.mjs` checks project/tool navigation and retained edits.
`safari-shader-check.mjs` checks shader controls and draw-submission cadence.
`safari-frame-export-check.mjs` checks pause, exact-frame capture, grain and still exports.
`safari-frame-motion-check.mjs` decodes native MP4 output and checks its range and paused pose.
`safari-control-check.mjs` checks first-click color, select, range, and numeric-field interactions.
`safari-artboard-export-check.mjs` checks native artboard/map dragging, origin-clean text/SVG paint exports, and portable project/font round trips.

## Patterns to follow / invariants
<!-- agent-docs:fill:patterns -->
- Accept the runner's harness; do not create another driver or browser session.
- Use real W3C input and public Studio source APIs, never app storage/internals.
- Clean up owned instrumentation and listeners in `finally` blocks.
- Record timing coverage honestly; do not count a delayed switch as a pending-edit race.
- Do not silently retry missing native clicks or suppress unexpected exceptions.

## Common tasks → first action
<!-- agent-docs:fill:tasks -->
Run syntax checks first. Start an owned Safari driver only after the user enables
Remote Automation, then run the relevant `GLYPHFIELD_SAFARI_ONLY` case filter.
Close owned sessions and the driver afterward; preserve all unrelated browsers.

## Gotchas
<!-- agent-docs:fill:gotchas -->
Safari WebDriver can return without delivering pointer events, and some versions
do not execute native text Undo even in bare controls. Report those limitations
explicitly. Foreground cadence samples are invalid after focus loss; compare to
the same browser's empty-page baseline before attributing throttling to the app.
