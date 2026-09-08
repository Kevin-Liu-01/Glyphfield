# Shader frames: native motion, exact saved appearance

Implementation contract and verification record, 2026-09-07.

## Product contract

The live shader is an engine-rendered animation, not a flipbook of saved images.
A saved **shader frame** is a lossless PNG of the actual ready renderer together
with its editable recipe and any supported native time anchor. These solve
different problems: the PNG preserves the appearance that the user chose; the
recipe enables future editing. A timestamp alone is not an exact saved image.

Save, duplicate, undo/redo, reload, layer previews, and still export must agree
about which representation owns the visible result. Reopening a saved frame must
not regenerate an approximate pose, reset the material to time zero, or replace
it with the default centered composition. Resuming live editing is an explicit
change of representation, not something that happens during save or hydration.

## What the renderers actually support

`src/lib/shaderMotionCapabilities.ts` classifies every canonical material without
loading a renderer or starting a graphics context. The metadata deliberately
does not advertise unverified seamless periods.

| Renderer | Time model | Editable time seeking | Repeat contract |
| --- | --- | --- | --- |
| Original GLSL materials and Glyph field Canvas2D | Direct-time rendering with fixed other inputs | Yes | No established period |
| Animated Paper families | Procedural output evaluated at a native time | Yes, with the provider anchor and speed mapping | No universal period |
| Time-independent Paper families | Static output | No time control needed | Static, not an animation loop |
| Prismatic sphere | Direct-time, configured circular noise path | Yes, once lighting and the draw are ready | Uses the host's `loopDurationMs`; full visual closure still needs pixel verification |
| Fluid Energy | Stateful velocity/dye feedback and pointer input | No timestamp-only reconstruction | No established period |

All providers can supply a PNG from an authentic ready canvas. This does not
mean that an unavailable WebGL context, failed asset, tainted canvas, or loading
skeleton is a valid capture. Capture errors must remain errors.

The nine static Paper families in the pinned 0.0.78 implementation are Dot Grid,
Fluted Glass, Halftone CMYK, Halftone Dots, Image Dithering, Paper Texture,
Static Mesh Gradient, Static Radial Gradient, and Waves. Their fragment output
does not consume time; Halftone Dots declares `u_time` but never uses it.
A zero-speed preset alone is not evidence of a static shader.

`continuous` in the capability metadata means **no supported repeat period is
known**. It is not a mathematical assertion that a shader can never repeat.
Likewise, independent time seeking does not promise identical pixels on another
GPU or after changing a texture, pointer uniform, resolution, color pipeline, or
provider version. Exact visual persistence uses the PNG.

### Paper time is not a frame index

The installed `@paper-design/shaders` 0.0.78 `ShaderMount` stores milliseconds:
`getCurrentFrame()` returns its time accumulator, and `setFrame()` changes that
accumulator. Rendering passes it to GLSL as seconds. Host speed and preset speed
then determine how authored time maps to provider time. Calling this a finite
sequence of numbered frames conflates time, display cadence, and saved assets.
The dependency is pinned as recommended by the [upstream project](https://github.com/paper-design/shaders).

Three Dithering presets have source-derived periodic candidates in this pinned
version. In `dithering.js`, `t = 0.5 * u_time`:

| Preset shape | Candidate period in provider `u_time` seconds | Basis |
| --- | --- | --- |
| Sine Wave / `wave` | `4π` | Integer-frequency sine/cosine terms in `t` |
| Ripple / `ripple` | `4π / 3` | A `sin(… - 3t)` phase |
| Swirl / `swirl` | `π` | A `4t` angular offset modulo a full turn |

These are not user-facing durations and are not pixel-verified seamless loops.
The catalog candidate requires the original shape; a shape override invalidates
it. The speed conversion and actual pixel output must be checked before use.
Do not extend these three results to every dither preset or Paper noise family.

The sphere separately passes `loop="on"` and `loopDurationMs / 1000` into its
[ShaderGradient provider](https://github.com/ruucm/shadergradient). A configured
noise-path period is stronger evidence than an arbitrary app sequence duration,
but lighting, grain, assets, and camera state still belong in a visual test.

## Implemented flow and acceptance gates

1. **Persistence first.** Introduce a validated, versioned shader-frame record
   holding the PNG asset, actual dimensions, material identity, full editable
   settings/overrides, capture provenance, and a provider-specific anchor when
   available. Reuse CanvasDocument assets and stable IDs. Preserve unknown fields
   and legacy documents; never silently label old thumbnails as exact captures.
   Test serialization, malformed/oversized input, reload, and recovery storage.

2. **Capture the native renderer.** Read the currently displayed ready canvas
   without remounting, resizing, resetting time, or advancing a fake sequence.
   Freeze/copy pixels synchronously at the selected draw boundary before async
   PNG encoding, so encoding cannot race the next live frame. Gather an anchor
   from that same rendered state, not a different animation tick. Wait for source
   textures and the sphere's lit draw; reject fallback/skeleton capture. For
   fluid, save pixels without pretending a time value serializes its buffers.

3. **Save, duplicate, and history.** Keep the frame asset and recipe together.
   Duplicate references/clones the exact selected frame without recapturing a
   later phase. Undo restores both representation and layout. Tests must cover
   save → reload, duplicate, project/tab switching, and undo/redo with positioned
   logos and layers, not only a shader on an empty canvas.

4. **Time UI.** Keep native display motion targeting smooth 60 FPS. An elapsed
   time readout, provider-supported seeking, explicit Capture frame, and explicit
   Resume live replace an invented universal sequence. Hide seeking for static
   and stateful-only materials. Stored frame counts and export FPS do not drive
   live playback. A paused exact frame stays exact until the user edits/resumes.

5. **Export parity.** Still export of a captured frame consumes the stored pixels
   at their documented resolution. Editable deterministic renders may render a
   new resolution but must not be described as byte-identical snapshots. Motion
   export uses the provider's real clock contract; fluid requires serial native
   simulation/replay or honest unsupported reconstruction. Seamless output needs
   an established period and actual boundary checks, not merely GIF loop metadata.

6. **Pixel and performance gates.** In one browser/GPU environment, compare
   decoded PNG pixels to the captured source buffer, then verify that save,
   reload, duplicate, history, and still export preserve those pixels and layer
   geometry. Separately test native → pause → capture → resume and supported seek
   round trips. Loop candidates need multi-phase boundary samples, not only
   `t = 0`. Run real draw-cadence and interaction benchmarks serially on production
   builds; record startup, drag responsiveness, no layout shifts, and no loading
   flashes. Mock renderer calls or a passing schema test are not visual evidence.

## Performance invariants

- No PNG/base64 encoding, GPU readback, history append, storage write, or React
  state update on every live animation frame. Capture is an explicit bounded job;
  autosave reuses the current captured asset until it changes.
- Copy once at a requested draw boundary, encode asynchronously where supported,
  and serialize capture/export jobs. Cancellation must not apply a stale result
  after the selected layer or material changes.
- Prefer shared asset references/Blob persistence internally. A portable data URL
  is a transport choice, not a reason to duplicate image bytes across every
  layer, history entry, or runtime preview.
- Adaptive preview resolution never rewrites authored size, recipe, capture
  provenance, or saved pixels. A snapshot's real dimensions remain inspectable.
- Hidden/offscreen renderers stop unnecessary work. Reduced motion remains
  respected. More stored frames do not solve browser/GPU cadence problems.
- Do not promise universal 60 FPS or bitwise identity across devices. Publish the
  tested viewport, DPR, renderer, device/browser, and observed gaps.

## Runtime and storage implementation

- `liveMaterialClock.ts` and the renderer adapters own native time; the React
  timeline is an elapsed-time readout, not a playback driver. Static-only
  compositions disable exploration. Mixed compositions reject time reconstruction
  when a visible shader is a stateful simulation.
- `captureShaderFrames.ts` freezes and copies every visible shader before any
  asynchronous encoding. `shaderFrameDocument.ts` patches the existing source
  document and active artboard without rebuilding layout from defaults.
- `shaderFrameAssets.ts` stores content-addressed PNG Blobs in IndexedDB, validates
  their signatures/dimensions/hash, and leases bounded decoded-image URLs.
  Portable source and clipboard payloads embed the selected PNG assets. Missing
  or corrupt assets fail explicitly; library thumbnails are never substituted.
- `ShaderFrameImage.tsx` retains the previous representation until its replacement
  is ready. Captured Paper filter/grain presentation is shared with still export.
- Editing a checkpoint mounts its anchored native renderer behind the saved PNG,
  previews the drag without changing the saved recipe, and commits on release.
  Capture during an uncommitted control preview fails explicitly. Paused
  converters redraw on readiness and painted-preview events, not a polling loop.
- Visible converter prefixes are recomposed from the immutable captured PNGs,
  never from a live canvas that could change during asynchronous hydration.
  Committed converter settings and saved shader presentation own that transaction.
  The results become lossless checkpoints for inactive artboards. Their dependency
  key invalidates stale previews after paint inputs change and survives ID remapping.
- Save, duplicate, copy, paste, artboard switches, and still export capture or
  reuse the same checkpoint. Public actions are `design.frame.capture`,
  `design.frame.play`, `design.frame.seek`, and `design.motion.describe`.
- Motion exports remain separate clips. A blended GIF closure is a crossfade,
  not a native period. Timestamp-sampled Fluid clips are explicitly unsupported;
  exact Fluid stills are supported.

## Verification record

The automated browser checks use `agent-browser`, authentic ready renderers,
decoded image bytes, and the public Studio API. They do not inject editor state
through React internals or browser storage.

- Full-catalog native audit: all 134 API-derived shaders passed freeze, exact PNG
  round-trip, and valid resume checks at 640×360, DPR 1 in Chromium on macOS.
  All 133 non-stateful shaders reproduced the saved native anchor with zero
  changed pixels after remount. Fluid passed exact capture and retained-instance
  pause/resume without claiming timestamp reconstruction. Static shaders retained
  unchanged output during playback. Holo Cloth included a non-default pointer.
- Production user journey: all 23 checks passed with physical context-menu
  pointer clicks. Exact live-buffer capture, named Save, reopening, reload,
  isolated-browser portable import, layer/artboard duplication, intermediate
  undo/redo assets, and off-center logo geometry were preserved. Same-document
  and fresh-session clipboard paste retained embedded PNG bytes and the expected
  32-pixel placement offsets. The decoded 960×540 still export had zero changed
  background pixels and the correctly positioned logo. Bayer output matched
  after reload; its inactive duplicated artboard displayed the exact embedded
  converter PNG with unchanged layer ordering and transforms. Immediate sequence
  preview/capture/stop calls also respected the capture boundary.
- Unit/contract suite: 988 tests passed with readiness, effect checkpoint, and
  workspace-switch race coverage. Typecheck, fast lint, and cognitive lint passed.
- Production native cadence: seven representative shaders measured 59.5–60.02
  actual draw opportunities/second in foreground four-second samples after
  warmup at 640×360, DPR 1. All passed the 55 FPS minimum, 35 ms p95-gap and 50 ms
  maximum-gap gates. These are draw submissions, not measured GPU presentation.
- Production interaction benchmark passed all gates. Shader-control dragging
  retained the same native canvas, with CLS 0, no long tasks, p95 frame 16.9 ms,
  and maximum input delay 7 ms. Landing scrolling, tab dragging, and the horizontal
  rail also passed. Studio entry took 344 ms to editor readiness and included one
  53.9 ms long animation frame (0.7 ms blocking), so startup is not hitch-free.
- A frozen Gem Smoke brightness drag changed all 120,120 native pixels while
  the pointer was still down, without changing its saved recipe or PNG. Releasing
  committed the setting, cleared the checkpoint, and retained the same native
  canvas and time anchor, with no browser errors.
- The shared context menu now preserves canvas selection during pointerdown, so
  Copy/Paste is not unmounted before its click. Its regression also confirms
  ordinary outside-canvas clicks still dismiss selection.

The full unit suite was rerun successfully with four workers, separately from
the production build. Two CPU-intensive existing tests failed in a prior
simultaneous build/test run; both passed in the separate full-suite rerun.
No assertions or time limits were weakened.

Reproduce with `pnpm test:shader-frames` (add `--all` for the API-derived catalog),
`pnpm test:shader-frame-journey`, and `pnpm test:shader-cadence`. Point
`GLYPHFIELD_SHADER_BASE_URL` at the production build. GPU checks run serially;
concurrent shader tabs invalidate performance attribution.

These tests establish same-environment capture fidelity, not cross-device native
bitwise identity, universally hitch-free startup, or verified periodic closure
of the analytic loop candidates. The PNG, not an inferred loop index, remains
the authority for the exact chosen appearance.
