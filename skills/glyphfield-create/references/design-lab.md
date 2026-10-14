# Design Lab reference

Use this reference for layered composition, exact source edits, and saved-design work.

## Two source versions

The active Design Lab source is CanvasDocument schema 2 with Design Lab metadata source 4. A `POST /api/generate` request with `kind: "design-sequence"` instead returns response schema 1 containing a compact version-3 compatibility `document`. Apply that document first, then call `readSource()` to get the normalized CanvasDocument before making further edits.

```js
const generated = await fetch(`${baseUrl}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    kind: 'design-sequence',
    identity: { preset: 'gt' },
    ratio: 'wide',
    shader: { materialId: 'paper-gem-smoke', shaderSize: 0.8 },
    texts: [{ value: 'Every language. One source.', weight: 500 }],
    sequence: { cutCount: 8, finalHoldMs: 3000, pace: 'accelerating' },
    export: { width: 1920, fps: 30, quality: 'best', gifLoop: 'seamless' },
  }),
}).then(async (response) => {
  if (!response.ok) throw new Error(await response.text());
  return response.json();
});

await window.glyphfield.studio.applySource(generated.document);
const document = JSON.parse(window.glyphfield.studio.readSource());
```

## Safe targeted edit

Elements are keyed objects, not an array. Their discriminator is `kind`.

```js
const studio = window.glyphfield.studio;
const document = JSON.parse(studio.readSource());
const text = Object.values(document.elements)
  .find((element) => element.kind === 'text');

if (!text) throw new Error('No text layer exists.');
text.content = 'Updated by an agent';
text.style.opacity = 0.88;

await studio.applySource(document);
const applied = JSON.parse(studio.readSource());
if (applied.elements[text.id].content !== text.content) {
  throw new Error('The text edit did not round-trip.');
}
```

Never reconstruct the full document from a remembered example. Never write React state, localStorage, or IndexedDB directly.

## Layer and asset invariants

- `pageIds` orders artboards; `pages[id].elementIds` orders layers back to front.
- Image and logo elements reference asset records. Preserve both the element and asset ID.
- Groups and Design Lab metadata must reference existing element IDs.
- View pan/zoom is workspace state and must not alter exported transforms.
- Saved designs must preserve pages, elements, assets, groups, shaders, timeline/frame, export settings, and stable IDs.

## Layer commands and effect layers

Use the Design Lab actions instead of rewriting geometry or effect settings by hand:

```js
const studio = window.glyphfield.studio;
await studio.invoke('design.layers.arrange', { arrangement: 'horizontal-center', layerIds: ['text-1', 'logo-brand'] });
await studio.invoke('design.layers.lock', { layerIds: ['logo-brand'], locked: true });
await studio.invoke('design.layers.copyStyle', { layerId: 'text-1' });
await studio.invoke('design.layers.pasteStyle', { layerIds: ['text-2'] });

// An Effect layer processes every layer beneath it in the active artboard.
const { layerId } = await studio.invoke('design.effects.add', { effectId: 'shader-effects-engraving' });
const { layers } = await studio.invoke('design.effects.describe');
const effect = layers.find((entry) => entry.layerId === layerId);
if (effect?.status === 'unsupported') throw new Error('Image effects need WebGPU in this browser.');
```

- Alignment needs two layers and distribution three. Locked layers are skipped.
- Built-in converters use `{ kind: 'bayer' | 'ascii' | 'halftone' | 'posterize' }`. Image effect IDs come from `/api/materials` `imageEffects`; `effectProps` holds only changed values.
- Effect layers cannot be added to the loose canvas, locked, arranged, or style-copied.
- Design Lab layers have no rotation; the shader **Rotation** slider rotates the material inside its layer.

## Visual verification

Check more than source text:

- Artboard dimensions and crop.
- Text wrapping, font, contrast, and effect colors.
- Logo/sticker alpha edges and white-on-white separation.
- Shader selection, zoom, frame, and performance.
- Layer order and hidden/opacity state.
- Restored state after saving and reopening when persistence matters.

The complete current contract is available on the running Glyphfield origin from `/docs/studio/design-lab.md`, `/docs/studio/design-lab/layers.md`, `/docs/studio/design-lab/effects.md`, `/docs/studio/design-lab/shaders.md`, `/docs/studio/design-lab/export.md`, and `/docs/reference/source-formats.md`.
