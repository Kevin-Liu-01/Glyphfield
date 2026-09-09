# Shader pause, capture, and export

Status: implementation and focused browser verification complete, including
native Safari. Implemented from `07c79dc` in `codex/shader-capture-export`.
All evidence below comes from the local production build, not glyphfield.com.

## Requested outcome

- Remove the unexplained "operation is insecure" and frame-save failures.
- Pause freezes the currently displayed shader without requiring persistent storage.
- PNG/JPG export uses the currently viewed frame and leaves the editor paused.
- Only an explicit Capture/Save action creates a durable shader PNG; repeated
  pause/export does not accumulate unreferenced frame assets.
- Time seeking, resume, saved appearance, and motion exports have consistent
  semantics across providers and browsers, with particular verification in Safari.

## Baseline evidence

- Chromium on the unchanged production build at localhost:3014 returned a
  644,447-byte PNG, then `design.motion.describe` reported `paused: false` and
  increasing time. `exportStill` explicitly resumed playback in `finally`.
- Both Pause and Capture called `saveCurrentShaderFrame`, coupling ordinary
  transport to PNG encoding, secure hashing, and IndexedDB writes.
- Still export used that same durable capture path. Restricted/unavailable frame
  storage could therefore prevent downloading otherwise readable pixels.
- `applyShaderFrameCaptures` retained superseded, unreferenced frame assets;
  portable serialization embedded the entire accumulated map.
- The exploration window automatically extended as live time increased.
- Native Safari's first diagnostic session failed before navigation while
  connecting to Safari. This is not evidence that the app passed or failed.
- WebKit reproduced `UnknownError: Error preparing Blob/File data to be stored
  in object store` at `IDBObjectStore.put`. The updated frame store writes PNG
  ArrayBuffer bytes and still reads legacy Blob records. Actual Capture, named
  Save and cold reload now pass the isolated WebKit test.
- WebKit reproduced `SecurityError: The operation is insecure` when the shared
  SVG-filter grain image was drawn through a CanvasPattern and read back. This
  occurs even on secure localhost without remote images. Preview and export
  now share a pre-rasterized lossless PNG tile. Native Safari and WebKit both
  pass the actual grain-plus-converter PNG/JPG export regression.
- Ordinary pause, PNG/JPG decoded-download parity and deterministic time seeking
  pass the focused WebKit checks on the intermediate build. Still export does
  not resume playback or add saved-frame assets.
- Initial GIF frame comparison used inconsistent resizing paths (raw native
  buffer versus composited/exported output). Comparing both actual downloaded
  files through the same decoder yields mean channel error 1.588/255 between
  the paused PNG and GIF first frame. This is not proof of all motion providers.
- Native Safari automation connects after launching Safari normally:
  Safari 26.4 on macOS 26.4 (25E246), without insecure-certificate or autoplay
  bypass settings. Four focused tests pass with real pointer input: Capture,
  named Save and reload; live-to-PNG with stable paused pixels; repeated saved
  PNG/JPG exports; and grain plus Bayer converter exports. The first batch's
  unfocused clicks are not counted as passes. Agent-owned sessions were closed.
- A live-source regression on the intermediate build reproduced the timestamp
  bug with same-ID source replacement: after importing 1,250 ms, the paused UI
  reported 1,434 ms but the native shader phase corresponded to only 184 ms.
  The authored 1,250 ms offset was missing, without any browser or readiness
  error. The new restore test is red-capable against this baseline.

## Implementation and remaining findings

- Source restore now seeds the authored timeline at the source boundary, then
  releases ready renderers together to native playback. The installed Paper
  React wrapper has a second initialization effect which overwrote the seed
  with the preset frame. The vendor prop now retains the initial resolved frame;
  readiness reapplies the latest controlled draw before exposing capture.
  Two lifecycle tests failed before this fix and pass afterward. Subsequent
  scrubs remain imperative instead of rebuilding image uniforms every tick.
- Design sampled motion now reads the native canvas instead of a retained PNG
  during the saved-frame handoff, and rejects unfinished shader/effect edits.
  Actual decoded GIF/MP4 motion from both native-paused and saved-PNG entry
  states passes WebKit, including restoration to the original paused pixels.
- An intermediate WebKit check detected different repeated PNG hashes.
  The native canvas dimensions and full pixel hash stay identical. Decoded
  exports differ by exactly one channel level in 3,691 channels (mean error
  0.00534/255). Raw transient PNG bytes also matched exactly, isolating the
  discrepancy to final compositing. Decoded immutable PNGs now request a
  software-backed grain scratch surface; live native canvases remain accelerated.
  The rebuilt app passes the unchanged exact repeated-PNG assertion.
- Opening Review originally encoded twice because pausing changed the saved
  settings signature. Both exporters now record that signature after the
  synchronous pause. The rebuilt app passes the one-encode regression and
  refreshes exactly once when the user changes the export width.
- Canvas2D filters are not universally supported ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter)).
  A one-pixel capability probe now verifies actual numeric filter semantics.
  Unsupported engines use ordered, clamped sRGB brightness/contrast/saturation
  following [Filter Effects Level 1](https://www.w3.org/TR/filter-effects-1/).
  Identity filters bypass the probe and readback. Immutable inputs reuse one
  filtered buffer; mutable renderers redraw. Independent CSS-preview comparisons
  against actual downloaded GIF/MP4 pixels pass in all three tested engines.

## Animation export behavior

- Export samples wait for real shader readiness and two following paint frames,
  then resolve the current native canvas rather than caching a loading fallback.
- Direct and composited previews share the same grain/filter presentation as
  GIF/MP4. Presentation on runtime buffers is omitted from persisted source and
  stripped from already-filtered export buffers to avoid double application.
- Export captures temporary native clock anchors, locks user playback and seek
  controls, then restores the original pose before resuming only if the editor
  was playing on entry. No durable PNG assets are created for motion samples.
- Fluid is rejected for timestamp-sampled GIF/MP4 because its simulation is not
  reconstructible from time alone. A future live-recording path is separate.
- Blank Animation text holds preserve their exact content; only navigation
  names fall back to `Frame N`. This fixes an actual blank-page-name exception
  found by the shader-only export fixture; five round-trip tests cover it.
- The rebuilt WebKit app passes direct and override GIF exports, with mean
  RGB errors 1.627/255 and 1.014/255 against the independent visible preview.
  Fluid rejection passes. MP4 produces the correct 10 frames, 320×180 size,
  one-second duration and motion, then restores the paused pose, but its
  presentation error is 8.671/255 direct and 8.107/255 override, above the
  unchanged 8/255 threshold. Chromium and Firefox GIF/Fluid cases also pass.
- The MP4 discrepancy was isolated to color range: Safari emitted H.264 with
  no SPS VUI range flag (inferred limited range by H.264 Annex E) but reported
  full range to the muxer. Changing only MP4 `colr` range metadata, without
  changing encoded pixels, reduced errors to 2.013/255 and 2.609/255.
  The shared exporter now reconciles range from bounded AVCC/SPS parsing before
  muxing. It preserves explicit full range, other metadata, non-AVC codecs and
  malformed/mixed configurations. No per-frame raster work or UA detection is
  added. All twelve focused MP4 cases on the final build pass in Chromium,
  WebKit and Firefox, with unchanged pixel thresholds and no skipped cases.
  Final WebKit Animation errors are 2.096/255 direct and 2.792/255 override;
  both streams are limited-range BT.709, 320×180, ten frames and one second,
  and both restore the exact paused native-canvas hash.
- Paint waits rely on requestAnimationFrame; backgrounding the document can
  suspend export progress until it is foregrounded. This change does not claim
  background-tab motion encoding support.

## Verification on the assembled build

- Production build (`next build --webpack`), TypeScript, full lint, documentation
  generation/doctor, grain-asset reproducibility and diff checks pass.
- All 1,193 unit tests pass.
- All 48 Design Lab browser cases pass across Chromium, WebKit and Firefox,
  with no skips. They include real Pause input; repeated bit-identical PNGs;
  one-encode Review and settings refresh; capture, named Save and cold reload;
  PNG/JPG download parity; deterministic seeking; restored nonzero Paper time;
  grain/converter readback; decoded GIF/MP4 motion and restored paused pixels;
  Canvas2D/ShaderGradient captures; and explicit Fluid motion rejection.
- All nine Animation GIF/Fluid cases pass across those three engines. The
  final MP4 rerun covers twelve cases: Design Lab native-paused and saved-PNG
  entry states, and Animation direct and override shaders, in each engine.
- Native Safari 26.4 passed Capture → trusted UI Save → cold reload with exact
  decoded PNG, positive saved time and paused state; live PNG; frozen PNG/JPG;
  and grain-plus-Bayer PNG/JPG. Earlier actual header and timeline Pause/Resume
  checks passed. A later Pause check froze pixels and time, but Safari lost
  focus during the resume cadence observation; that observation is explicitly
  environment-invalid, not a passing motion check.
- The final native Safari MP4 check passes using the actual Pause button and
  Safari's encoder: 640×360, 14 decoded frames, 1.166667 seconds, limited-range
  BT.709; first-frame error 3.9203/255 against the paused PNG, and first-to-last
  motion error 39.4855/255. Export restores bit-identical paused native pixels
  and does not resume playback or grow saved-frame assets.

## Reproduction and evidence

- `pnpm test`, `pnpm lint`, and `pnpm exec next build --webpack` pass on the
  assembled source. The production preview runs at `http://localhost:3015`.
- Regression test sources: `e2e/shader-frame-export.spec.ts`,
  `e2e/animation-shader-export.spec.ts`, and `scripts/check-safari-canvas.mjs`.
  Tests use public Studio APIs and trusted input; output checks decode actual
  downloaded files rather than relying on a resolved export promise.
- Design Lab matrix: `/tmp/glyphfield-design-matrix-pass-JsHqOB`.
- Animation Chromium/Firefox GIF and Fluid:
  `/tmp/glyphfield-animation-gif-pass-OkHnTA`.
- Final twelve-case MP4 matrix: `/tmp/glyphfield-mp4-matrix-pass-NWT7Zf`.
- Final native Safari MP4 report:
  `/var/folders/yl/sxf0v4tn14n2pkwqmf_21l540000gn/T/glyphfield-safari-canvas-8V8jpu/results.json`.
- The preserved MP4 diagnosis at
  `/tmp/glyphfield-animation-export-codec-9xXnPi` includes actual streams used
  to isolate the metadata-only range error. Failed intermediate PNG evidence
  remains at `/tmp/glyphfield-shader-export-red-wWrqmp` and
  `/tmp/glyphfield-shader-export-raw-proof-gOFWal`; assertions were not relaxed
  to turn those failures green.

## Scope and limits

- This audit verifies the source changes, not deployment. Git and deployment
  records are authoritative for publication; no production verification is claimed.
- Motion encoding needs a foreground document and browser-supported codecs;
  unsupported codecs and non-seekable Fluid exports report explicit failures.
- This focused audit verifies shader transport, persistence and still/motion
  export, not every feature on every browser or every possible shader preset.
