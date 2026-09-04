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

Subscribe before activating because the active adapter is replaced.

```js
if (studio.activeTool() !== 'material') {
  const ready = new Promise((resolve) => {
    window.addEventListener('glyphfield:studio-api-ready', resolve, { once: true });
  });
  studio.activate('Design Lab');
  await ready;
  studio = window.glyphfield.studio;
}
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

Design Lab additionally exposes sequence and PNG/JPG/GIF/MP4 export actions. Always use `describe().actions` as the live list. Run motion exports serially.

## Failure recovery

- `TypeError`: input shape or source is malformed; correct it before retrying.
- `RangeError`: action/control is absent; call `describe()` and `controls()` again.
- Tool switch race: wait for `glyphfield:studio-api-ready`, then re-read the global.
- WebGL or codec error: preserve the source and report the capability failure. Do not silently change the requested output.

The complete current contract is available from `/docs/reference/browser-api.md` on the running Glyphfield origin.
