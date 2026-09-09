---
name: e2e-skill
description: Isolated Chromium, WebKit, and Firefox Studio regression tests.
---

# glyphfield / e2e

## Purpose
<!-- agent-docs:fill:purpose -->
Exercise the browser-native canvas and project navigation contracts with real
pointer and keyboard input against a dedicated local production server.

## Mental model & key files
<!-- agent-docs:fill:model -->
`playwright.config.ts` runs all three engines serially. Canvas tests cover editing,
history, exports, and retained workspaces; project-tab tests cover hit areas,
interrupted gestures, reordering, and closing. `docs/browser-compatibility.md`
records repeatable commands and measurement limits.

## Patterns to follow / invariants
<!-- agent-docs:fill:patterns -->
- Use a fresh context per test and the public Studio source API for fixtures.
- Never seed app storage or React internals, or use a person's browser profile.
- Use real input for behavior tests; synthetic events are diagnostic-only.
- Scope selectors to visible/active workspaces; retained editors remain mounted.
- Decode exports and verify pixels, not just successful promises.

## Common tasks → first action
<!-- agent-docs:fill:tasks -->
Run `pnpm test:browsers --project=webkit --grep '<case>'` for a focused repro,
then all engines. Set `GLYPHFIELD_BROWSER_BASE_URL` for an explicit test server.
Keep failures' screenshots/traces in the ignored reports directory.

## Gotchas
<!-- agent-docs:fill:gotchas -->
WebKit is not installed Safari; use `pnpm test:safari` for native Mac checks.
Run only one browser/GPU workload at a time. Animation callbacks are not GPU
presentation FPS. Wait for lazy editor readiness without swallowing other errors.
