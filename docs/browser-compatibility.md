# Canvas browser compatibility

## Contracts

- Native range inputs own their thumbs. Never call `setPointerCapture` on a
  range input: WebKit can deliver pointer moves without any native value changes.
  Design Lab uses gesture-scoped window release/cancel/blur listeners instead.
- Keyboard and assistive range changes commit immediately; pointer previews stay
  lightweight and the final visible native value is the committed value.
  Completing a primary pointer gesture focuses the shared range without scrolling
  or canceling native dragging. Installed Safari removes early pointerdown focus
  during its mousedown default action, so focus belongs at completion; keyboard
  tests must not hide the gap with an explicit test focus.
- Canvas shortcuts must respect inherited editors, including
  `contenteditable="plaintext-only"`. A focused editor owns Shift-click, native
  undo, and its text context menu. Layer selection/drag handles remain separate.
- DOM-only style previews belong to the selected layer in the owning active
  artboard. A retained or hidden workspace must never receive another editor's
  preview.
- Optional GPU/editor initialization waits for the end of held pointer gestures
  plus the quiet delay. It must not begin halfway through the first drag.
- Source replacement and direct-manipulation gestures have distinct history
  boundaries. The idle debounce can coalesce one edit, but must never make Undo
  remove a newly added layer instead of undoing its subsequent move.
- The entire project tab surface activates its project. Rename inputs and close
  icons keep their own actions. Pointer release outside the tab bar, cancellation,
  and window blur end a drag; a later hover must never start one.
- Retained editors keep their document state but do not own the active Studio API
  or control lookup. Project/tool round trips must resolve source and controls
  from the visible workspace, regardless of the order editors were mounted.
- Color pickers retain HSV coordinates while editing white, gray, or black;
  converting through HEX must not reset the hue or saturation the user selected.
  Text fields retain their DOM identity, Enter/blur commits valid drafts, and
  Escape cancels the focused draft without dismissing its containing picker.
- Popover dismissal flushes pending edits before unmounting fields. A nested
  dropdown that consumes Escape must not also dismiss its parent menu.
- Tool-header actions such as Pause, Save, and Export preserve the selected layer
  and inspector. Leaving the editor still dismisses its canvas selection.
- Numeric shader zoom uses the same native-range ownership and final-commit
  contract as other Studio sliders. Escape cancels the draft before blur runs.

## Repeatable engine checks

Use a dedicated production server and run browser tests serially. Do not run a
second GPU benchmark concurrently or point the fixture suite at a user's saved
browser profile. Each Playwright test creates a fresh context and seeds designs
through the public Studio source API, never by writing app storage or React state.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium webkit firefox
pnpm exec next build --webpack
pnpm start --port 3014
# In a second terminal:
pnpm test:browsers
```

Set `GLYPHFIELD_BROWSER_BASE_URL` to test a different running server. Use
`--project=webkit`, `--project=chromium`, or `--project=firefox` to focus a run.
Failures retain screenshots and traces in ignored `reports/browser-results/`;
the JSON summary is `reports/browser-results.json`.

The regressions use real mouse and keyboard input for range dragging, text
selection/undo/redo, context menus, layer geometry, rapid artboard changes,
project/tool round trips, tab hit areas, interrupted tab gestures, reordering,
closing, and persistence. Still-export checks decode actual PNG/JPG bytes and compare their
rasterized glyph bounds against the canvas's resolved font. Both sides use the
same antialiasing threshold; continuous TextMetrics bounds can differ from the
painted ink in WebKit. Shader interaction checks retain the native canvas and
record browser callback cadence separately from GPU rendering.

`e2e/animation-toolbar-files-history.spec.ts` covers Animation's canvas-dock
Undo/Redo and compact saved-history control, header save status, and real project
downloads and file choosers. Its portable-file round trip compares paused frame
pixels and authored timing across projects, verifies embedded fonts are privately
namespaced on import, and rejects malformed files without changing the open
animation. These cases run through the same Chromium, WebKit, and Firefox matrix;
they do not replace installed Safari verification.

`e2e/control-interactions.spec.ts` additionally checks first-click color pickers,
achromatic hue changes, HEX-to-picker and picker-to-select transitions, checkbox
keyboard input, slider commits, numeric Escape, and a typed artboard size followed
immediately by another action. These checks assert the public source as well as
the displayed controls; a visual-only preview does not count as a committed edit.

The September 8 verification used the webpack production build because the
default Turbopack command stalled in this environment. The default build script
was not changed. Document-wide print selectors were moved out of the locally
scoped BrandBook CSS module so webpack's pure-selector check also succeeds.

WebKit automation is not installed Safari. Native Safari checks require macOS
and Safari's **Settings → Developer → Allow remote automation**. The native
runner owns only its WebDriver session and does not change browser security
settings or use an existing user tab.

```sh
/usr/bin/safaridriver -p 4445
# In a second terminal, with the app running:
pnpm test:safari
```

`GLYPHFIELD_SAFARI_BASE_URL` selects the app server and `SAFARI_WEBDRIVER_URL`
selects the driver endpoint. The script reports the actual Safari/macOS version,
uses an isolated automation session, and deletes that session on completion.
Stop the driver process you started after testing.
Set `GLYPHFIELD_SAFARI_ONLY='native shared controls first-click'` for the focused
native color/select/range/numeric journey. It uses the same isolated text fixture
and trusted pointer delivery checks as the canvas suite.
Keep its Safari window in the foreground during cadence measurements. A focus
or visibility interruption invalidates that sample and is reported as a failure,
not as Glyphfield shader performance.

The native runner preflights text Undo in an isolated plain textarea and editor.
Safari 26.4 WebDriver delivered trusted, unprevented Command-Z events but did not
execute Undo in either bare control. In that environment, the report explicitly
marks native text Undo as unsupported and checks only that Glyphfield delegates
the shortcut. This does not count as a native Undo pass; WebKit engine tests
separately exercise actual text Undo/Redo. Canvas action Undo is fully exercised
by both runners.

## Measurement limits

Browser callback cadence is not GPU-completion or presentation FPS. The broad
input-stall assertion catches regressions; it is not a promise of 60 FPS on every
Mac, artwork, or display. Use `pnpm test:shader-cadence` for actual draw submission
cadence and `pnpm test:performance` for the existing interaction budgets.

## Artboard navigation and portable export checks

The navigation regression covers surface drag/selection, double-click entry,
Space/middle-button panning over content, canceled gestures, pending text at a
board switch, map dragging, same-zoom centering, and resize anchoring. The map
renders geometry only; it must not create preview images or shader contexts.
Below 300px canvas height the map starts collapsed, with a visible toggle.
Explicit user toggles override automatic resizing; a manually expanded compact
map has a smaller drawing area. Artboard capture handlers must leave portaled
layer move/resize handles alone, even when React events bubble through a board.

Still export follows the painted content, not the selection rectangle. The
overflow regression compares decoded PNG ink against the actual canvas screenshot
for tiny-height and tiny-width text, gradient text, SVG images, and fitted logos.
It excludes navigation chrome from the screenshot and retains the same authored
pixel tolerance across engines. SVG viewport fitting and raster-buffer rounding
must not stretch the artwork; selection bounds remain editable and unchanged.

Project-file tests verify real JSON downloads and file choosers, embedded fonts
and inactive-board images after the original blob URL is revoked, reloads,
malformed-file rejection without mutation, and typography-only Undo/Redo.
Imported font faces remain local to the Design Lab workspace. Source/history and
the shared brand asset writer must not leak those private families to other tools.

```sh
GLYPHFIELD_BROWSER_BASE_URL=http://localhost:3016 pnpm test:browsers \
  e2e/artboard-navigation.spec.ts e2e/design-lab-overflow-export.spec.ts \
  e2e/project-files.spec.ts e2e/project-typography-history.spec.ts

# With the owned Safari driver already running:
GLYPHFIELD_SAFARI_BASE_URL=http://localhost:3016 \
  GLYPHFIELD_SAFARI_ONLY='native artboard project export' pnpm test:safari
```

## September 8, 2026 verification

- 1,063 unit tests across 154 files passed; TypeScript, source lint, and the
  webpack production build passed.
- All 33 engine checks passed without retries: Chromium 151.0.7922.34,
  WebKit 26.5, and Firefox 153.0. Coverage includes real native range drags,
  text selection and Undo/Redo, canvas geometry and Undo/Redo, PNG/JPG text
  pixels, persistence, and artboard changes 16-79ms after the final keystroke.
- The final production interaction benchmark passed all existing budgets.
  Design Lab drag p95 was 16.7ms, maximum input delay 7.4ms, with zero long
  tasks, zero layout shift, and the same GPU canvas retained. Landing scrolling,
  shader prewarming, Studio entry, project switching, tab dragging, and the
  horizontal project rail also passed their budgets.
- Seven representative shader families sustained 59.99-60 draw submissions per
  second in four-second foreground Chromium samples at 640x360, DPR 1. Their
  p95 draw gaps were 16.8-17.4ms. This measures draws, not GPU presentation.
- Six native Safari checks passed on Safari 26.4/macOS 26.4, with one explicitly
  unsupported native text Undo assertion as described above. A foreground
  empty-page control measured 30.05 animation callbacks/s. The paired live shader/Warp drag measured 30.02
  draws/s and 30.02 callbacks/s, p95 34ms, with the original 462x260 GPU canvas
  retained. Foundation's read-only `isLowPowerModeEnabled` check returned true.
  This is consistent with [WebKit's low-power half-speed policy](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/graphics/AnimationFrameRate.cpp),
  not an extra Glyphfield frame cap. The test did not change power settings.
  Recheck with [Automatic Energy Mode](https://support.apple.com/en-us/101613)
  before claiming native Safari 60fps performance.

### Tab-switching follow-up

The expanded suite passed 48/48 checks across Chromium, WebKit, and Firefox,
without retries. All 1,087 unit tests across 157 files passed, along with the
webpack production build, TypeScript, source lint, and documentation doctor.
The new browser cases first reproduced dead tab padding, outside-release drag
lockups, and stale project/tool source ownership, then passed with the fixes.
They also verify real pointer reordering, keyboard reordering, SVG close buttons,
retained edits, and visible-editor control isolation after project round trips.
Focused component tests cover source-drawer delegation across parent rerenders.

Two follow-up production performance sweeps did **not** pass all budgets.
Tab dragging remained at 17.0-17.1ms p95 with no dropped frames, long tasks,
or layout shifts; Design Lab control dragging also passed. Project switching
had zero layout shift and no long tasks but 4-5% dropped frames, with p99 gaps
of 33.9ms and 41.7ms. Cold editor mount took 714-881ms, and landing scroll
also exceeded budgets. Other browser renderer/GPU workloads were active on
the host; that is a measurement constraint, not proof of the cause. Do not
claim this follow-up made the whole app lag-free or replace the earlier
successful measurements with an unqualified performance pass.

Native Safari 26.4 independently passed full-tab padding/bottom clicks and
release-outside/hover cleanup. Its project/tool round-trip rerun could not finish:
the driver lost browser focus and delivered no trusted click events for Add text
and Close source editor. Those two native checks are invalid input-delivery
runs, not passes or demonstrated product failures; complete native Safari
round-trip verification still requires a manual check. The equivalent three
engine runs above passed. The native harness retains click/focus telemetry and
never silently retries a potentially completed action.

Desktop engine coverage does not establish coverage for every historical
browser, iPhone/iPad, extension, or GPU. Keep explicit device/version evidence
with each verification run, and do not add user-agent-specific workarounds when
the shared native interaction contract can be fixed.

### Shared-control first-click follow-up

The focused regressions reproduced achromatic hue resets, a compact HEX draft
being overwritten by the previous hue on its first saturation click, discarded
artboard-size drafts, nested Escape dismissing its parent, numeric zoom committing
on Escape, and Pause clearing the layer inspector. The fixes preserve native
range capture and keep pointer previews separate from final source commits.

Installed Safari 26.4 additionally exposed a focus gap hidden by explicit focus
in the engine harness: its mousedown default action removed pointerdown focus.
The shared range now assigns focus at gesture completion instead, avoiding a
premature blur/commit during the drag. The regression asserts that an arrow key
actually changes the source immediately after the real pointer interaction.

All 1,236 unit tests across 168 files passed, along with source lint, TypeScript,
the webpack production build, and the documentation doctor. The final production
candidate passed all 72 engine checks across Chromium, WebKit, and Firefox without
retries, including the existing canvas, export, native-range, and project-tab
regressions. Native Safari 26.4
passed the full focused journey with trusted pointer/keyboard input: neutral hue
selection, color persistence, dropdown choice, native dragging followed by arrow
keys without test-added focus, and a typed artboard size immediately followed by
Add text. This is control-interaction coverage, not a new whole-app performance
benchmark or a guarantee for untested devices.

### Artboard navigation and editable-project follow-up

The focused export repros exposed intrinsic grid/text overflow, gradient bounds,
SVG viewport fitting, and fractional raster-buffer rounding. The fixes preserve
the live paint geometry without changing the authored selection rectangles.
Direct exports also flush the focused text editor before taking their source
snapshot; the regression invokes export in the final input event's microtask,
before the existing 140ms debounce can run.

All 1,303 unit tests across 175 files, source lint, TypeScript, the webpack
production build, and documentation checks passed. The import regressions reject
remote assets hidden outside the asset registry, non-image payloads masquerading
as image layers, and malformed font enums before changing the active workspace.
The final production candidate passed all 129 browser checks across Chromium,
WebKit, and Firefox without retries. This includes seven canvas-to-PNG overflow
and asset-fitting cases per engine, existing PNG/JPG font checks, immediate-input
export, layer handles, navigation, control/tab interactions, actual project
downloads and file choosers, reloads, and typography-only Undo/Redo.

Installed Safari 26.4 passed trusted surface/map dragging, click-to-center,
same-zoom centering, tiny-text and SVG PNG paint comparisons, embedded-font and
inactive-image project round trips, and the existing native live-shader export
check. At 640×360, all four tested ink edges were within one pixel of the native
preview. The SVG/text outputs were decoded and read back successfully; the
project retained both artboards after the original object URL was revoked.
These are local correctness checks, not a production deployment or a new
whole-app frame-rate benchmark.
