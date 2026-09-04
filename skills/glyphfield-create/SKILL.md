---
name: glyphfield-create
description: Create or revise brand-system compositions in Glyphfield, especially layered Design Lab work with shaders, text, marks, images, stickers, converters, artboards, and saved designs. Use when the requested outcome is a visual Glyphfield composition rather than only an API payload or final-file export.
---

# Glyphfield Create

Build the requested artifact in the real Glyphfield state model and leave it editable.

## Route the work

- For a new repeatable composition, generate a `design-sequence` through the HTTP API, apply it in Design Lab, then refine it there.
- For an existing browser design, read its current source and make the smallest source-preserving edit.
- For local fonts, uploads, WebGL materials, direct placement, or visual judgment, work in `/studio` through `window.glyphfield.studio`.
- Treat export as a separate final step. Use `$glyphfield-export` when it is available.

Read [references/design-lab.md](references/design-lab.md) before changing a layered composition or saved design.

## Composition workflow

1. Establish the intended identity, output dimensions, still or motion outcome, and whether the user means a new or existing design.
2. Open Design Lab and call `describe()` before relying on actions. Its public tool ID is `material`.
3. Read the current source for existing work. Preserve unknown fields, page IDs, element IDs, asset records, metadata, and ordering.
4. Add or update only the required artboards and layers. Design Lab supports multiple text, logo, image, sticker, shader, and converter layers.
5. Keep shader layers behind authored content unless the requested composition says otherwise. Use `page.elementIds` as the authoritative back-to-front order.
6. Use opacity and blend modes on the actual layer. A Bayer, ASCII, halftone, or posterize converter should have intentional foreground and background colors.
7. Apply through the Studio adapter, re-read source, and confirm the intended values and order survived.
8. Inspect the authentic rendered canvas at the requested frame. Save a named design when the user wants a reusable or restorable result.

When the result must survive the current browser profile or origin, follow `/docs/artifacts/backup-and-restore`: copy the normalized current source and retain original non-embedded assets. A named browser save alone is not an off-device backup.

## Design decisions

- Start from Gem Smoke when a shader background is useful; use no background when the brand mark alone is stronger. Do not resurrect legacy Holo defaults.
- Preserve legibility. A white mark on a white sticker border needs a contrasting fill, outline, shadow, surface, or border color.
- Shader size is visual zoom from `0.1` to `10`; do not misuse canvas zoom to change exported geometry.
- Frame history is authored state. Save the selected frame/timeline settings with the design rather than treating the gallery thumbnail as canonical.
- Do not add a surface, background, sticker, or effect merely because the tool supports it.

## Completion

Do not stop at a successful source application. Re-read the source, inspect the canvas, and verify that visible placement, layer order, identity, frame, and saved state match the request. If an export was requested, verify it independently.

If restore or migration is involved, read `/docs/reference/version-compatibility` and store the normalized source returned after application.
