---
name: glyphfield-export
description: Export and verify Glyphfield artifacts as SVG, PNG, JPG, GIF, MP4, PDF, JSON, or Lottie-compatible files. Use when the request is about downloading, rendering, motion loops, audio, dimensions, file integrity, or diagnosing an export that looks different from the Studio preview.
---

# Glyphfield Export

Produce the requested format from the renderer that owns the artifact, then verify the real file.

## Choose the renderer

- Use deterministic HTTP generation for raw template/background SVG and structured briefs.
- Use the live Studio for Canvas/WebGL/local-font/local-file output and Design Lab PNG, JPG, GIF, or MP4.
- Use Animation for authored motion sequences and audio-aware MP4 output.
- Use Lottie for edited JSON or `.lottie` bundles.
- Use `slides.export.pdf` for a slide deck PDF. It returns a Blob.
- Use `brand-book.print` for the Brand book PDF. It opens the browser print dialog and returns `null`, so the user saves the PDF and you cannot inspect its bytes from the action.
- Use `identity.export.kit` for the brand kit ZIP and `brand-element.export.html` for a send-ready HTML email.
- Prefer the direct actions published by `describe()`. Brand identity, Brand elements, Moodboard, Animation, Lottie, Design Lab, OpenGraph, Terminal card, Partnership lockup, Blog cover and Slide templates return Blob artifacts. Color tokens and Typography return token text from `colors.tokens.read` and `typography.tokens.read`, and Component library returns code files from `components.code.read`. Use visible control automation only when `describe().capabilities.exports` marks an export as `browser-control`.

Read [references/export-verification.md](references/export-verification.md) before motion export or when correctness matters more than a quick preview.

## Export rules

- Call the active Studio adapter's `describe()` before invoking a format-specific action.
- Run GIF and MP4 exports serially. They share live canvases and browser encoders.
- Use `mode: "shader-sequence"` only with GIF or MP4.
- Shaders.com materials and image effects need WebGPU. Without it their export throws; report the failure and keep the source.
- Keep filename extension, MIME type, and requested format aligned.
- A GIF never has audio. Use MP4 when the requested motion requires an audio track.
- A loop flag is not proof of a visually seamless GIF. Inspect closure between the last and first displayed frame.
- If MP4 encoding is unavailable, report it and preserve the source; do not silently substitute GIF.
- When a renderer, codec, palette, storage, or download fails, preserve source and follow `/docs/reference/troubleshooting` plus `/docs/reference/browser-support` before changing the requested output.

## Browser API pattern

```js
const artifact = await window.glyphfield.studio.invoke('design.export', {
  format: 'png',
  download: false,
});

if (!(artifact.blob instanceof Blob) || artifact.blob.size === 0) {
  throw new Error('Glyphfield returned an empty export.');
}
```

Call `window.glyphfield.studio.download(artifact)` only after verification when the user requested a saved file.

## UI captures

To set a product screenshot at 16:9 on a shader ground, run two Design Lab actions: `design.capture` builds the artboard and makes it active, then `design.export` renders it.

```js
const studio = window.glyphfield.studio;
await studio.selectTool('material');
const { presets } = await studio.invoke('design.capture.presets');
const capture = await studio.invoke('design.capture', {
  image: 'data:image/png;base64,...', // or a PNG, JPEG or WebP Blob; under 24 MB
  preset: 'purple-grain',             // capy's purple grain; default 'brand-grain'
  width: 1920,                        // 960..3840, a multiple of 16; height is width × 9 / 16; also sets the export width
});
// capture: { artboardId, width, height, materialId, preset }
const artifact = await studio.invoke('design.export', { format: 'png', download: false });
```

Input fields, all optional except `image`:

- `preset`: `purple-grain`, `brand-grain`, `brand-mesh`, `brand-warp` or `brand-dither`. Brand presets build the ground from the active identity's accent, with a tint toward its highlight and a shade toward its ink.
- `materialId`: any id from `/api/materials`. It replaces the preset's material.
- `palette`: `'brand'` or `['#RRGGBB', '#RRGGBB', '#RRGGBB']`, the first being the ground's base. It replaces the preset's palette.
- `settings`: numeric ground settings merged over the preset's. The keys are `amplitude`, `brightness`, `centerX`, `centerY`, `density`, `detail`, `frequency`, `grain`, `rotationX`, `rotationY`, `rotationZ`, `speed` and `strength`. Colors go in `palette`, not here.
- `padding`: 0–0.3 of the height on every side. Default 0.1.
- `radius`: 0–96 artboard px. Default 20. A dark ground also gets a faint light edge on the capture.
- `shadow`: boolean. Default `true`.
- `name`: names the artboard and the capture layer.

Unknown fields, a `height`, an unknown preset or material, and malformed colors throw before anything changes. The action resolves once the new artboard is shown.

Design Lab cannot open a URL. Capture the page with your own browser first, then pass its bytes as `image`.

From a script outside the page, pass a base64 data URL. A PNG export returns a Blob; read it back in chunks through `FileReader`. Verify the PNG's width and height match the capture's `width` and `height` at export width, and that the ground is not black (a shader that failed to render).

## Completion

Confirm non-empty bytes, filename, MIME, extension, dimensions, and expected transparency. For GIF/MP4 inspect multiple frames, motion continuity, text color stability, shader movement, and final-loop closure. For MP4 with audio, inspect the audio stream rather than assuming UI state was muxed.
