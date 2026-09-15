# Design Lab vocabulary

- **Canvas**: the open workspace for ideas. Loose layers can occupy any position;
  it has no output size or background and is not itself an export.
- **Artboard**: a named, sized output surface on the canvas. Its layers are
  exported; loose layers elsewhere in the workspace are not.
- **Loose layer**: an ordinary editable layer owned by the canvas instead of an
  artboard. Moving it into an artboard changes ownership, not its identity.
- **Editing surface**: the canvas or artboard whose layers the shared editor is
  currently editing. This is implementation vocabulary, not a separate tool or
  user-facing mode.

Layer editing, appearance, grouping, history, and project persistence are shared
across editing surfaces. Viewport movement never changes document coordinates.
