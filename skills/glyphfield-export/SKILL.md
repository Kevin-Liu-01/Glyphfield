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
- Use the browser print workflow for Brand Book PDF.

Read [references/export-verification.md](references/export-verification.md) before motion export or when correctness matters more than a quick preview.

## Export rules

- Call the active Studio adapter's `describe()` before invoking a format-specific action.
- Run GIF and MP4 exports serially. They share live canvases and browser encoders.
- Use `mode: "shader-sequence"` only with GIF or MP4.
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

## Completion

Confirm non-empty bytes, filename, MIME, extension, dimensions, and expected transparency. For GIF/MP4 inspect multiple frames, motion continuity, text color stability, shader movement, and final-loop closure. For MP4 with audio, inspect the audio stream rather than assuming UI state was muxed.
