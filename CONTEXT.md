# Design Lab vocabulary

- **Canvas**: the open workspace for ideas. Loose layers can occupy any position.
  The canvas has no output size or background, and it is never exported. Portable source
  stores it under `workspace.canvas` with the internal ID `artboard-canvas`
  (`DESIGN_CANVAS_ID` in `src/lib/designWorkspace.ts`). That ID is an editor
  handle. It never names an artboard.
- **Artboard**: a named, sized output surface on the canvas. Its layers are
  exported; loose layers elsewhere in the workspace are not.
- **Loose layer**: an ordinary editable layer owned by the canvas instead of an
  artboard. Moving it into an artboard changes its owner. It keeps its ID
  unless the destination already uses that ID.
- **Effect layer**: a layer that processes every layer beneath it in its artboard.
  It runs a built-in converter (Bayer, ASCII, halftone or posterize) or a
  Shaders.com image effect, which needs WebGPU. Effect layers belong to an
  artboard; the loose canvas cannot hold one.
- **Editing surface**: the canvas or artboard whose layers the shared editor is
  currently editing. The term is implementation vocabulary. It names neither a
  tool nor a user-facing mode.

Layer editing, appearance, grouping, history, and project persistence are shared
across editing surfaces. Viewport movement never changes document coordinates.
