# Canvas browser compatibility

## Contracts

- Native range inputs own their thumbs. Never call `setPointerCapture` on a
  range input: WebKit can deliver pointer moves without any native value changes.
  Design Lab uses gesture-scoped window release/cancel/blur listeners instead.
- Keyboard and assistive range changes commit immediately; pointer previews stay
  lightweight and the final visible native value is the committed value.
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
