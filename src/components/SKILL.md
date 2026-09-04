---
name: src-components-skill
description: Studio editors, shared UI systems, and authentic browser renderers.
---

# glyphfield / src/components

## Purpose

Own interactive Studio editors, shared controls, direct manipulation, authentic
Canvas/WebGL/Lottie rendering, export UI, and documentation presentation.

## Mental model & key files

- `StudioApp.tsx` owns projects, tabs, active tool, and identity selection.
- `StudioToolWorkspace.tsx` is the public tool-to-editor switch.
- `ShaderLabStudio.tsx` is Design Lab despite the historical filename.
- `AnimationStudio.tsx`, `TimelinePanel.tsx`, and audio components own motion.
- `CanvasViewport`, `EditableCanvasLayer`, layer panels, `ColorControl`,
  `StudioSelect`, and range controls are reusable editor primitives.
- `SourceCodeDrawer` is the human surface for tool serializers/validators.
- `LiveMaterialCanvas` and adapters own authentic shader rendering.
- `DocsMdx.tsx` owns reusable rich documentation components.

## Patterns to follow / invariants

- Host components own state; shared controls are controlled and semantic.
- Use accessible labels that are unique within the active tool; agents operate them.
- Preview and export must consume the same resolved values.
- View zoom/pan never mutates artifact geometry.
- Canvas manipulation emits document/tool coordinates, not screen coordinates.
- Use shared color, select, range, button, scrollbar, header, and panel systems.
- Long-running exports expose progress and a stable Browser API action.
- Pause hidden/offscreen animation and honor reduced motion where applicable.

## Common tasks → first action

- Add a control → find the shared control, add a precise accessible label, persist
  through the host state, serialize it, and confirm export consumes it.
- Add a layer type → update render, selection, ordering, duplication/deletion,
  serializer/adapter, saved design, source application, and export together.
- Add a shader behavior → update authentic preview, thumbnail/fallback, shared
  settings, Animation compatibility, catalog metadata, and motion capture.
- Add export → return a typed non-empty artifact, expose it through automation,
  add preview/download UI, and test MIME/filename/state consistency.
- Change docs visuals → use `DocsMedia`, `DocsMediaGrid`, and `DocsFeatureGrid`.

## Gotchas

Design Lab receives internal draft scope `logo-shader` but its automation/public ID
must be `material`. Do not infer render completion from a React state commit. Logo
shadows/outlines must follow alpha rather than rectangular bounds. Avoid independent
preview clocks for gallery cards. Do not run simultaneous GIF/MP4 exports.
