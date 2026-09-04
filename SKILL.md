---
name: glyphfield-skill
description: How to work in this repository. Read before editing here.
---

# glyphfield — working here

## Purpose

Use this skill when changing Glyphfield. It keeps the visual Studio, portable
documents, deterministic API, agent Browser API, docs, and exports aligned.

## Mental model & key files

One identity flows through public tools in `src/lib/studioCatalog.ts`. Each tool is
rendered by `StudioToolWorkspace.tsx` and persists project-scoped state. Rich
layered work uses CanvasDocument (`canvasDocument.ts`); Design Lab adapts its UI
state through `designLabDocument.ts`. Agent discovery/generation lives in
`agentApi.ts`, `agentCatalog.ts`, and `agentGeneration.ts`. Browser parity lives in
`studioAutomation.ts`. Human and machine guidance share `content/docs`.

Read the directory skill before working deeply in `src/app`, `src/components`,
`src/hooks`, `src/lib`, or `scripts`.

This is the contributor skill. For tasks that operate Glyphfield as a product,
load the appropriate package under `skills/`: create, API, Studio, or export.

## Patterns to follow / invariants

- Treat catalog IDs and current serialized source as authoritative.
- Keep preview, saved source, autosave, and export on one state model.
- Preserve stable element/asset IDs and unknown source fields.
- Add accessible labels before relying on generic Browser API control automation.
- Use a tool-specific Browser API action for long-running/export behavior.
- Keep deterministic HTTP output independent of browser-only APIs.
- Add documentation as part of the feature, including agent completion rules.

## Common tasks → first action

- Add/change a Studio tool → inspect `studioCatalog.ts` and `StudioToolWorkspace.tsx`.
- Change Design Lab layers → inspect `ShaderLabStudio.tsx`, `designLabDocument.ts`,
  `canvasDocument.ts`, and saved-design tests together.
- Change an export → inspect preview renderer, export helper, Browser API action,
  MIME/filename checks, and artifact docs.
- Change agent HTTP generation → inspect `GET /api/generate`, validation helpers,
  manifest/OpenAPI, examples, and tests before implementation.
- Change docs → update MDX metadata/order, run Fumadocs generation, and confirm both
  the page and `/llms-full.txt`.
- Diagnose UI behavior → reproduce in the browser, identify the state owner, then
  add a focused regression test before or with the fix.

## Gotchas

`material` is the public Design Lab ID while `logo-shader` is a legacy storage
scope. Project/nav state uses localStorage; Design Lab saved designs and converted
assets use IndexedDB with recovery support. WebGL previews may degrade to a static
representative image, but authentic motion export must never be claimed from that
fallback. Browser exports share renderer resources and should not run concurrently.
