# Shader preview and rendering reliability

Updated: 2026-09-09

## Landing and Animation Studio lifecycle

The hero uses the real Animation Studio. Its eager idle delay is now 600ms,
not 3600ms; held pointer gestures still defer the initial mount. Once ready,
one editor remains mounted for the page visit, preserving edits and play/pause
intent. Its prepared native shader pauses outside the viewport rather than
recompiling or resetting phase on return. Other distant landing fields retain
their bounded prewarm/release policy. The hero no longer overrides the native
60fps preview target with a 30fps stepper.

The brand rail no longer speculatively prefetches every example project and
folder route during hero startup. A recorded WebKit trace showed 23 overlapping
Studio/docs RSC requests. The primary Open Studio link still prepares its editor
on pointer/focus intent; example links retain their original navigation targets.

Animation Studio gates its clock and audio on tool, project, viewport, and
document visibility. Resume resets elapsed time, so an offscreen interval cannot
jump the playhead. Explicit tool deactivation still stops playback. Gallery
previews unsubscribe from their shared clock while their workspace is hidden.

Blue manipulation controls only describe the selected paused scene's hold.
They disappear during playback, transitions, other scenes, and inactive views;
selection remains available when the user returns. Only the small selection
boundary subscribes to playhead changes, not the complete editor.

Inspector shader thumbnails request a rendering slot only near the viewport.
They wait for actual renderer readiness and composite the same filter/grain
presentation as export before encoding once. Leaving the workspace cancels
pending captures; cached thumbnails are bounded to 32 variants per page visit.

Repeatable checks (use a local production server):

```sh
GLYPHFIELD_BROWSER_BASE_URL=http://localhost:3018 pnpm test:browsers e2e/landing-animation-performance.spec.ts e2e/animation-selection.spec.ts e2e/landing-prefetch.spec.ts
GLYPHFIELD_PERF_BASE_URL=http://localhost:3018 pnpm test:performance --landing-only
```

The scroll benchmark now waits for the loaded editor, and `--landing-only` also
checks real shader pixels before viewport entry. Browser regression attachments
record navigation-to-editor readiness and native clock updates per display
opportunity. Neither callback timing nor clock advancement proves GPU completion
or monitor presentation FPS.

### 2026-09-09 local production-build verification

- All 1,384 unit tests in 183 files, full lint, the production build/type check,
  and the agent-docs doctor pass. Thirty final landing, selection, and prefetch
  browser checks pass across Chromium, WebKit, and Firefox. Fifteen real
  GIF/MP4 export and unsupported-Fluid checks also pass across those engines;
  downloaded motion was decoded and checked against the paused presentation.
- Final navigation-to-editor **DOM mount** samples were 1,237ms in Chromium,
  1,281ms in WebKit, and 1,139ms in Firefox. These are not complete GPU-load or
  internet download measurements. The settled startup network checks recorded
  seven RSC requests, with no speculative example-project/folder requests,
  compared with 23 overlapping requests in the earlier WebKit trace.
- A separate untraced foreground Chromium probe observed **60 actual shader
  draw frames/second** over 4,016.6ms at 554×166/DPR 1, with a 17.4ms p95 draw
  gap and the same retained native canvas. This instruments native drawing
  calls, not just the animation clock; it still does not measure GPU completion.
- The final loaded-editor landing scroll run passes the unchanged budgets:
  p95 17ms, p99 17.7ms, maximum 25.1ms, no dropped frames, long tasks, long
  animation frames, or layout shift. Returning to the top retains the same
  canvas/node counts (19/1,788). The offscreen shader painted in 504ms,
  with 25 sampled colors, before entry and without replacing its nearby canvas.

Keep the limitations visible: an earlier WebKit mount sample was 4,250ms;
three isolated repeats passed at 1,646–1,944ms before the final prefetch change.
An earlier scroll probe also saw a 67.3ms maximum gap. Other browser/test jobs
were running on the shared machine, but those failures are not attributed to
them without proof. No timing budget was relaxed. The broader interaction run
still found a separate cold **Design Lab** entry spike (114ms task/140.3ms long
animation frame) and a project-switching cadence failure. This change does not
declare those unrelated startup paths or every device lag-free.

## Experience contract

| Before | Now |
| --- | --- |
| A thumbnail can inherit logo sizing and expose an unrelated gradient. | The authentic image owns its full-frame dimensions. Only one image is mounted for the selected material. |
| Different shader placeholders imply artwork that was never rendered. | One static `ShaderSkeleton` serves Studio, thumbnail loading/errors, the sphere's asset wait, and landing demos. It uses no image downloads, canvas, timers, or animation. |
| Frame counts collide with timeline actions. | Counts reserve digit-based width, the scrubber flexes, and actions remain separate at narrow widths and enlarged text. |
| Landing quality is fixed regardless of sustained slow frames. | Auto can reduce resolution; High/Low are explicit overrides in the shader palette. Authored Studio settings and exports are unchanged. |
| A mounted canvas can be mistaken for a finished shader. | Captures wait for renderer readiness, and the regression runner reads real canvas pixels. Prismatic sphere waits for its environment and lit draws. |
| A global canvas fade briefly hides already-rendered shader pixels. | Readiness and the shared placeholder own the handoff; finished pixels do not fade from transparent. |

Loading is not a shader frame. Never persist, export, or describe the skeleton as
authentic artwork. A captured frame remains a real image of the rendered shader;
the live animation clock remains native rather than a playback of thumbnails.
Paper signals initial readiness after its asynchronously installed native canvas
has received its first layout/draw. The sphere's separate camera easing is
disabled: a fixed captured time must not keep changing because a camera is
still settling. The sphere's shader clock and the app's zoom smoothing remain.

## vgpu-inspired additions

The [vgpu performance guidance](https://vgpu.sh/docs/guides/performance-playbook)
and [measurement guide](https://vgpu.sh/docs/guides/measuring) informed three
bounded changes, implemented on our existing renderers:

- **Opt-in diagnostics:** custom draw callbacks report CPU timing separately
  from asynchronous WebGL GPU timer queries. Unsupported extensions, disjoint
  queries, and uninstrumented native providers are reported honestly. Normal
  rendering does not enable the timing queries or diagnostic frame loop.
- **Actual-pixel checks:** a fixed-size, fixed-time shader route exercises real
  rendering and readiness. Mock graphics commands are not proof of visual output.
- **Landing quality:** one shared sampler watches visible moving demos. After
  warm-up and two sustained poor-cadence windows, Auto lowers resolution once per
  visit; it never oscillates back up. Hidden/offscreen/reduced-motion states do
  not drive sampling. Manual preferences are best-effort local persistence.

Frame cadence is a user-experience signal, not a GPU measurement. It can reflect
CPU contention or browser scheduling; use the opt-in GPU diagnostics for graphics
attribution. A low-resolution landing demo must never rewrite a saved design.

## WebGPU decision

Considered, but not introduced as a production shader provider in this change.
[vgpu uses WebGPU and WGSL](https://github.com/vercel-labs/vgpu); the current
catalog uses Paper/WebGL, Three/ShaderGradient, and custom GLSL/Canvas renderers.
It is not a compatible drop-in replacement, nor evidence that the same saved
composition will look identical. [WebGPU also requires capability detection](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API).

A future optional provider should first prove all of the following:

1. An isolated, explicitly selected shader with an existing-renderer fallback.
2. Adapter/device failure and device-loss recovery without changing saved data.
3. The same authored time, dimensions, color interpretation, and captured-frame
   round trip across preview, save, duplicate, still export, and motion export.
4. Real-pixel regression coverage and measured startup/GPU benefit on supported
   browsers, including a no-WebGPU path.

No vgpu dependency, WGSL migration, or saved-source schema change is included.

## Live 60 FPS target

Live playback and exported/stored frame counts are separate contracts. Paper and
Sphere retain their native animation clocks. Custom renderers use a shared
display-timestamp pacer that carries fractional timing between refreshes rather
than resetting the deadline after every draw. This avoids rounding a 60 FPS
target down to 45 FPS on 90 Hz or 48 FPS on 144 Hz displays. Missed deadlines are
skipped, not replayed in a catch-up burst; edits and fixed-time captures still
invalidate immediately. The [browser animation clock follows display refresh](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame),
so 60 FPS is a target, not a guarantee on every device or composition.

Landing fields now target 60 FPS instead of their previous 14–24 FPS caps. Auto
quality still changes only resolution. Its two-window assessment now detects
sustained missed-60-FPS cadence (average over 19.17ms and at least 20% of frames
over 22.5ms), following a two-second warmup. It ignores occasional missed frames,
pauses, hidden/offscreen activity, and reduced motion. The page-latched downgrade
and explicit High/Low overrides prevent quality oscillation. Native clocks,
motion speed, saved frame anchors, and export rates are not rewritten.

`pnpm test:shader-cadence` opens an explicit
`/shader-preview?diagnostics=1&live=1&materialId=…` benchmark mode. It measures
actual native WebGL/Canvas drawing calls once per display opportunity, separately
from browser callbacks, for four seconds after warmup. It does not substitute an
rAF-only counter for renderer activity, enable GPU queries, or read pixels each
frame. The regular capture route and pixel checks remain paused/deterministic.
The report distinguishes draw submission cadence from GPU completion or screen
presentation. Use `GLYPHFIELD_SHADER_CADENCE_REPORT_PATH` to save results, and
`--materials=id,id` for a focused run. Run browser benchmarks serially.

### 2026-09-07 verification

The production build passed 869 unit tests across 135 files, full lint,
type checking, and documentation checks. Seven representative native renderers
measured 59.85–60 actual draw frames per second at 640×360/DPR 1 in foreground
Chromium. Their p95 draw gaps were 17.7–18ms, and their maximum gaps were
18.4–24.9ms. These four-second samples establish the tested cadence, not a promise
for every device or larger multi-layer composition. All seven fixed-time pixel
checks also passed after the pacing change, with identical paused pixels and
different pixels at a different phase.

The serial full interaction run passed landing scrolling, shader dragging,
project switching, tab dragging, and the horizontal rail with CLS 0 and no long
tasks/long animation frames in those probes. Landing p95 was 18.3ms (maximum
25ms); shader dragging p95 was 17.1ms (maximum 18.2ms). Cold Studio entry remains
over budget: one 90ms task, a 106.3ms long animation frame with 49.4ms blocking,
and editor readiness at 499.6ms. The suite therefore still exits with a failure;
the existing startup issue described below has not been declared fixed or hidden
by changing thresholds.

The 60 FPS target does not disable the existing CPU-overload safeguard for
composition converters: they lower preview resolution first and may fall back
to 30 FPS if the minimum-size conversion still consumes excessive CPU. Native
shader playback, deterministic capture, and authored export settings remain
separate from that converter-specific protection.

The beta deployment was also checked after publication. An initial visible-but-
inactive browser target was throttled down to 1 FPS, so the cadence runner now
explicitly brings its own page to the foreground through CDP, matching the
interaction benchmark. With foreground scheduling restored, custom dithering,
Gem Smoke, and Prismatic sphere measured 59.63–60 draw FPS and passed the gap
budgets. The throttled runs remain diagnostic failures, not shader/GPU timing.

## Verification commands

Start a production build on port 3013, then run these serially so browser
contention does not distort the measurements:

```sh
pnpm build
pnpm start --port 3013
pnpm test:shaders
pnpm test:shader-cadence
pnpm test:performance
```

`test:shaders` checks seven representative materials at 1600ms and 2300ms,
including the asynchronous prismatic sphere. `--catalog` opts into every
catalog material; `--materials=id,id` selects a focused set.
`GLYPHFIELD_SHADER_BASE_URL` selects a different running server. Pixel hashes
are same-environment repeatability evidence, not cross-GPU golden hashes.
The second timestamp deliberately avoids advancing by the sphere's 1600ms
loop period; two equal phases are not a valid test of motion changing pixels.

For an individual render, open
`/shader-preview?materialId=paper-gem-smoke&diagnostics=1`. The opt-in
`window.glyphfieldShaderPreview` harness exposes `ready()`, `read()`, and
`setTime(milliseconds)`. `read()` reports pixel summaries, hashes, comparisons,
and supported GPU/CPU diagnostics; normal previews do not expose the harness.

### Verification evidence

Local production build, Chromium 151 on macOS, 640×360 at DPR 1:

- Seven representative renderers passed actual RGBA readback. Both fixed-time
  samples stayed byte-identical while paused; changing to a different phase
  changed the pixels for all seven. These are within-session guarantees, not
  cross-device hashes or timestamp-only reconstruction of stateful fluid.
- Readiness from diagnostic-harness mount ranged from 106–289ms for the six
  lighter renderers and 1142ms for the sphere including its environment load.
  This does not measure the page's preceding navigation/bundle transfer.
- Thumbnail files exist for every material returned by the current catalog.
- Blocked thumbnail downloads show the same neutral skeleton in light/dark
  themes. Loaded dock thumbnails exactly fill their content rectangle.
- Timeline checks at 1120/1280/1440 and 125% zoom retain 8–12px between frame
  counts and actions, including both ends of a 240-frame timeline.
- Manual High→Low→High retained the same palette canvas: 302×416 → 256×352 →
  302×416. Its authored colors and animation timing did not change.
- All 845 unit tests across 133 files passed, along with lint, type checking,
  the production build, and the repository documentation checks.

### Remaining performance work

The full interaction benchmark is **not an all-green result**. In two serial
current-build runs, landing scrolling and continuous shader dragging passed with
CLS 0, no long tasks, and no long animation frames. Dragging retained the canvas
through 45 distinct values; p95 frames were 16.7–16.8ms. Landing p95 was 17.4ms.
Cold Studio entry still recorded 63–66ms tasks and 72.6–75.3ms long animation
frames (19.2–22.6ms blocking). One project-switch run exceeded the dropped-frame
budget, at 0.03 against 0.02. These budgets have not been relaxed.

An isolated production build of the exact preceding commit, `7f99591`, was run
once on the same machine with the same benchmark and dependency versions. It
also reproduced the cold-entry cost: a 79ms task, 101.4ms long animation frame,
and 36.1ms blocking, with CLS 0. The baseline additionally exceeded landing and
project-switch budgets. This confirms the startup issue predates this change;
one baseline run does not establish a statistical speedup.

The benchmark also exposed a separate attribution bug: late-delivered observer
entries could belong entirely to the preceding probe. Such entries are now
retained as diagnostics but excluded from the current probe's budget. Entries
overlapping or ending exactly at probe start retain their **full** duration.
Seven focused tests cover these boundaries. This does not exclude the real
cold-entry costs above.

## Deployment ownership

`glyphfield.com` and `www.glyphfield.com` belong to the existing Vercel project
`general-translation/glyphfield`. The separate `kl01s-projects/glyphfield`
deployment serves the beta alias; a successful push there does not establish
that the public custom domain has been updated. Always resolve the domain's
deployment, verify the intended project, and verify the public alias afterward.

On 2026-09-07, the public team's enforced Git-source policy blocked automatic
production deployment from `Kevin-Liu-01/Glyphfield`: only repositories under
`generaltranslation` are allowed. The separate beta project accepted and deployed
the commit. Updating the public release requires an owner-approved, project-only
repository exception or an approved production source. Do not switch upload
mechanisms to sidestep a known repository restriction. See
[Vercel deployment policies](https://vercel.com/docs/deployments/deployment-policy).

### Preview release published 2026-09-06

| Field | Verified value |
| --- | --- |
| Public URL | [glyphfield.com](https://www.glyphfield.com/) |
| Target / state | Production / READY |
| Deployment | `dpl_Xer3KzYCw89WHMPG2Va7weirxbHn` |
| Deployment URL | `glyphfield-l6x97hyyy-general-translation.vercel.app` |
| Framework / build | Next.js / 60 seconds |
| Source | Working-tree changes based on `7f99591`; this release is not a new Git commit |

The staged build was verified before promotion. Resolving `www.glyphfield.com`
after promotion returned this exact deployment. The apex redirects to the WWW
domain, which returns HTTP 200 and the new shared skeleton and quality control.
The published sphere thumbnail's bytes match the local authentic capture.
All seven actual-pixel checks passed again against the public domain, including
both paused-time checks and the different-phase check. The published Studio at
1280×900 showed one decoded thumbnail filling its 160×55 content area, 8px of
separation between the frame counter and action, and no browser errors.
The deployment-scoped
error-log query for the preceding ten minutes returned no entries; this is not
a claim that log drains or ongoing monitoring are configured. Documentation and
the benchmark-attribution-only fix were finalized locally after the app upload.
