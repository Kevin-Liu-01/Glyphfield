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
- `CanvasEditableText` retains native text selection and plain paste, with optional
  rich runs. Range styles use existing inspector controls; layout/effects stay
  layer-wide. Flush pending text before formatting or document undo/redo, and do
  not discard the saved range when focus moves into an inspector control.
- `AnimationStudio.tsx`, `TimelinePanel.tsx`, and audio components own motion.
- `CanvasViewport`, `EditableCanvasLayer`, layer panels, `ColorControl`,
  `StudioSelect`, and range controls are reusable editor primitives.
- `StudioArtboardBar` shares Animation's artboard controls with Design Lab.
  `DesignVersionProvider` owns one saved-design state; split history/file-action
  consumers can sit in different bars without duplicating persistence.
- `SourceCodeDrawer` is the human surface for tool serializers/validators.
  Expose it through `StudioFileMenu`; keep the drawer itself loaded on demand.
- `LiveMaterialCanvas` and adapters own authentic shader rendering.
- `DocsMdx.tsx` owns reusable rich documentation components.

## Patterns to follow / invariants

- Host components own state; shared controls are controlled and semantic.
- Use accessible labels that are unique within the active tool; agents operate them.
- Portaled toolbar menus must link their active trigger with `aria-controls` and
  dismiss when the owning tool/project becomes inactive. Browser API discovery
  follows those links and must never enumerate another workspace's menu.
- Preview and export must consume the same resolved values.
- View zoom/pan never mutates artifact geometry.
- Canvas manipulation emits document/tool coordinates, not screen coordinates.
- Use shared color, select, range, button, scrollbar, header, and panel systems.
- Keep primary output actions visible. Put file/source actions in `StudioFileMenu`,
  project management in `StudioActionMenu`, and copy/fork operations in saved designs.
  Do not bring back parallel rows of file or checkpoint icons.
- `ColorControl` defaults to a compact row with full editing in its picker.
  `LabInspectorSection` is collapsible and keeps children mounted; collapsing is
  presentation state, never a document mutation. Keep heading actions outside it.
- Long-running exports expose progress and a stable Browser API action.
- Pause hidden/offscreen animation and honor reduced motion where applicable.
- The landing hero renders the real editor in initial HTML; do not put its
  primary UI behind idle/admission timers. Presentation mode skips portable
  source/autosave work, not editing or authentic rendering.

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
