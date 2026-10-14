# Studio Browser API reference

## Wait for the adapter

```js
await new Promise((resolve) => {
  if (window.glyphfield?.studio) resolve();
  else window.addEventListener('glyphfield:studio-api-ready', resolve, { once: true });
});

let studio = window.glyphfield.studio;
console.log(studio.describe());
console.log(studio.controls());
```

## Switch tools safely

The Browser API covers only the active tool's workspace, so `studio.activate()` cannot click the Studio sidebar. Load the tool's URL instead, or click the sidebar with the browser driver. Each tool installs its own adapter, so read `window.glyphfield.studio` again after the switch.

```js
// Navigate the browser driver to /studio?tool=material&project=<project id>, then:
await new Promise((resolve) => {
  if (window.glyphfield?.studio?.activeTool?.() === 'material') resolve();
  else window.addEventListener('glyphfield:studio-api-ready', resolve, { once: true });
});
studio = window.glyphfield.studio;
```

## Exact source round trip

```js
const descriptor = studio.describe();
if (!descriptor.source.read || !descriptor.source.apply) {
  throw new Error('The active tool does not expose editable source.');
}

const before = JSON.parse(studio.readSource());
// Change only the intended fields; preserve everything else.
await studio.applySource(before);
const after = JSON.parse(studio.readSource());
```

Do not assume every tool uses CanvasDocument. Each active adapter owns its validator and source shape.

Source support does not depend on the source drawer being open. All 15 navigable tools have a persistent read/apply boundary. Brand book source holds only presentation edits; its content derives from the active identity.

## Controls

```js
const controls = studio.controls();
const target = controls.find((control) => control.label === 'Artboard name');
if (!target) throw new RangeError('Artboard name is unavailable in the active tool.');
studio.set(target.label, 'Launch composition');
```

Use Boolean values for checkboxes and valid discovered values for selects. Inputs dispatch the same events as the UI.

## Authorized local file

```js
const file = await authorizedFileHandle.getFile();
studio.set('Choose logos for the canvas', file);
```

Never attempt to synthesize a local path into a browser file input.

## Actions

Standard actions include:

```text
source.read
source.apply
controls.list
control.activate
control.set
artifact.download
```

Every tool adds its own actions. Brand identity, Brand elements, Moodboard, Animation, Lottie, Design Lab, OpenGraph, Terminal card, Partnership lockup, Blog cover and Slide templates return export artifacts as Blobs. Color tokens and Typography return token text (`colors.tokens.read`, `typography.tokens.read`), and Component library returns code (`components.code.read`). Brand book's `brand-book.print` opens the browser print dialog and returns `null`. Inspect `describe().actionContracts` for exact input and output, and use `describe().capabilities.exports` to see whether each export is a Browser action (`browser-action`), a visible control (`browser-control`) or HTTP output (`http`). Always use `describe().actions` as the live list. Run motion exports serially.

Control enumeration, matching, and activation stay inside this adapter's active workspace. A same-named control in another retained project or tool is never a fallback target.

## Failure recovery

- `TypeError`: input shape or source is malformed; correct it before retrying.
- `RangeError`: action/control is absent; call `describe()` and `controls()` again.
- Tool switch race: wait for `glyphfield:studio-api-ready`, then re-read the global.
- WebGL or codec error: preserve the source and report the capability failure. Do not silently change the requested output.

The complete current contract is available from `/docs/reference/browser-api.md` on the running Glyphfield origin.
