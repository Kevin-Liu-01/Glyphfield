# Glyphfield user journey and experience contract

Updated: 2026-09-05. This review combines the conversation history, current product
source, and local browser walkthroughs. It is a working product specification;
the verification section distinguishes observed results from targets.

## The experience we are building

Create an identity once, use it across useful outputs, experiment freely, and
return to work exactly where it was left. A user should understand what they are
editing, see an immediate result, undo a mistake, and trust the saved artifact.
The document owns the design. Selection, zoom, tabs, and loading are views of it.

The repeated requests in the conversation establish these priorities:

1. Preserve the design: moving between artboards, duplicating, saving, reopening,
   and exporting must preserve placement, shader settings, and captured state.
2. Keep editing direct: automatic previews, smooth live motion, usable keyboard
   undo, stable controls, and no flashing when selecting or dragging.
3. Make previews truthful: authentic material images, full frames, correct colors,
   and no loading frame presented as a finished render.
4. Keep the interface legible: appropriate density, subtle borders, correct icons,
   unclipped labels, readable API paths, and responsive canvas space.
5. Make motion serve the work: native shader playback, explicit capture/scrub,
   offscreen work suspended, and reduced motion for decorative UI.
6. Keep the marketing promise connected to the product: real interactive demos
   and a clear path into the same Studio tools.

## Primary journey

| Stage | User intent and action | Experience contract | Main owner |
| --- | --- | --- | --- |
| Discover | Explore the landing demos, open Studio or a brand example | Previews appear before they are needed; offscreen demos do not compete with the active work; links open the named destination | Marketing sections, Studio route |
| Orient | See the current project and choose a tool | The selected project/tool, URL, title, navigation, and visible editor agree; startup does not briefly expose another project | StudioApp, project tabs, command palette |
| Establish identity | Adjust name, logo, colors, typography | Changes propagate through tools; typing is immediate; switching away does not lose the most recent edit | BrandSettingsStudio, shared draft state |
| Compose | Open Design Lab, add text/image/material, arrange layers | The active artboard fits on entry; add/replace is understandable; selection and zoom never change output geometry | ShaderLabStudio, CanvasViewport, EditableCanvasLayer |
| Refine | Drag controls, play a shader, capture a look, scrub | Pointer work stays responsive; native motion is smooth; captured state remains stable; keyboard controls work too | Shared controls, live renderer, motion timeline |
| Recover | Undo/redo, change artboards, switch project/tool | One user action maps to one undo action; inactive editors suspend work; restoring never overwrites newer edits | History adapters, workspace activation, persistence hooks |
| Preserve | Save a named design or rely on draft recovery | Saving reflects actual persistence; queued edits survive navigation; recovery works when the main store is unavailable | DesignVersionControls, savedDesigns, autosave |
| Produce | Open export, inspect PNG/JPG/GIF/MP4, download | Wait for fonts/assets/renderer readiness; stills match the captured appearance; progress/errors are visible; export does not damage the editor | Design Lab export, shared export preview/encoders |
| Return/share | Reload a URL, reopen a design, use source or an agent | The same project/tool/document returns; source, preview, and export agree; local storage limitations are clear | URL state, portable CanvasDocument, Browser API |

## Key decisions

- Keep the rich tool set, but make each step expose its next useful action.
  Identity → composition → refinement → save/export is the main path; source and
  agent controls are available without being prerequisites.
- Start Design Lab with the artboard in view. Keep the artboard guide available
  on demand instead of automatically covering the initial composition.
- Distinguish a live material, its representative library thumbnail, and a
  captured frame. A thumbnail is not evidence of the current authored appearance.
- Treat material cut sequences as an optional motion feature. Do not make them
  necessary to save a single shader look.
- Keep existing shared controls and restrained Studio styling. Additional
  transitions must explain a state change and remain interruptible; avoid
  decorative motion on high-frequency editing actions.
- Keep warm editors only when their state/resource cost is bounded. A hidden
  project must not initialize each newly selected heavy tool.

## Findings and repairs in this pass

| Before | After | Why / evidence |
| --- | --- | --- |
| A draft edit can be replaced by older storage during the 120 ms write debounce | Read pending edits before persisted storage | Reproduced by switching away and back before the queued write |
| A reopened canvas can hydrate while its prior instance still has writes in flight | Serialize writes per workspace and wait before hydration | Adverse-timing hook test holds an older write open across remount |
| A valid recovery journal is ignored when IndexedDB fails | Read recovery independently and preserve it until migration succeeds | Storage failure regression tests |
| A transient read error can overwrite the saved design with the initial canvas | Suspend writes until loading succeeds; retry recovery | Adverse-timing hook regression test |
| Saved can remain visible while a changed snapshot awaits debounce | Show pending save state immediately | Hook lifecycle regression test |
| Blurring a checkpoint rename disables Save before its click fires | Save current source and commit the name without swallowing either action | Real rename → Save → restore/reload check; atomic metadata-write tests |
| Opening another checkpoint during fork persistence can select the wrong saved record | Serialize checkpoint-changing actions through persistence and source restoration, with an explicit Opening state | Deferred-write and deferred-restore DOM regression tests; rename remains nonblocking |
| Failed clone restoration can select the copy while the prior canvas remains visible | Activate a stored clone only after its source applies successfully | Rejected-restore test preserves original selection/source and leaves the copy available to retry |
| Saved-design rows are covered by the timeline and layer dock | Anchor the toolbar popup outside editor stacking contexts; keep panel layout inline | Hit-testing, keyboard entry/return, outside-rename commit, and screenshot verification |
| A checkpoint popup can remain over another retained workspace | Close and commit its focused name when either owning project or tool becomes inactive | Ownership/keyboard regression tests |
| Hidden warm projects follow global tool selection and initialize heavy editors | Only the visible project activates/mounts a newly selected editor | Workspace activation tests and source review |
| Reordering tabs also moves editor trees and global font styles | Keep retained editor/font order stable independently of tab order | Production pointer-up attribution and retention regression tests |
| Navigation leaves the launch query stale | Reflect visible tool/project/folder in the URL without adding history noise | Reload/deep-link verification |
| Search can hide its active keyboard result and lose focus on close | Modal focus handling and active-result scrolling | Command-palette interaction tests |
| Initial Design Lab artboard sits off-center and can be clipped | Focus the restored active artboard once on entry | Browser baseline at desktop sizes |
| Default framing and selection briefly paint before restored framing | Present canvas and selection only after document hydration and first focus resolve | Entry LayoutShift attribution, 0.03756 → 0 in development and 0 in the subsequent production probe |
| Initial fit synchronously measures the newly committed editor tree | Let the first browser layout deliver geometry before revealing the final fit | No geometry reads before ResizeObserver readiness; subsequent user focus remains immediate |
| Timeline minimum columns overrun narrow workspaces | Container-responsive layout with a full usable scrub track | Compare narrow and wide editor screenshots |
| Body-portaled selection borders cover the inspector when panned or resized | Clip individual and group affordances to the viewport without changing layer geometry | Browser hit-testing and resize regression tests |
| Keyboard scrubbing does not reliably stop live playback | Pause/capture when any scrub input begins | Keyboard walkthrough |
| Canvas undo requires mouse hover | Accept keyboard focus inside the canvas, ignore hidden/handled events | Keyboard-focused history check |
| Live still export jumps to a rounded timeline frame | Capture the native frame anchor before controlled export | Compare paused/exported appearance |
| Asynchronous Sphere lighting can be read before readiness | Expose readiness and wait before still/motion capture | Renderer readiness tests and browser check |
| Renderer cleanup can destroy a retained canvas during development remounts | Cancel pending WebGL release before reusing the canvas | Reproduced Sphere context-loss loop; stable browser verification |
| Prismatic Sphere's extra renderer code loads with ordinary materials | Load its renderer on demand | Separate dynamic provider boundary |
| Hidden-page and paused renderers can continue unnecessary work | Separate mounting from activity and stop unused render loops | Renderer lifecycle checks |
| Paused Fluid keeps injecting simulation state during redundant draws | Sleep until an edit/resize/capture invalidates the frame | Stable paused pixel hash and zero WebGL draws over 700 ms |
| Exact frame-interval comparisons skip vsync-rounded frames | Use frame deadlines tolerant of vsync rounding | Cadence regression test |
| Offscreen or failed renderers can silently export fallback art | Mount for controlled capture and reject unavailable renderers | Capture/readiness regression tests |
| Landing prewarm fetches code but disables actual offscreen renderer creation | Prepare the paused renderer within the warm range; retain it across the nearby active boundary | Real lifecycle regression tests replace the old source-string assertion |
| Hiding a browser tab invalidates the warm mounting range | Keep geometric proximity separate from visibility/activity | Real IntersectionObserver and document-visibility tests preserve the same prepared canvas |
| Agent-demo timers, drags, measurements, and shader continue offscreen | Suspend autonomous work and pause the nearby renderer without resetting control values | Timer, interruption, canvas-retention, and resume tests |
| Agent connector SVG stays mounted after the demo leaves view | Remove inactive connector DOM, retaining control values and nearby canvas | Exact DOM-count teardown/resume regression |
| Reduced-motion CSS hides canvases but their runtime can continue | Subscribe to preference changes; pause landing shaders and cancel autonomous agent work | Real matchMedia change-event tests, retained canvas, no background timers |
| Decorative glyph field parses hundreds of unique font-size strings per frame | Reuse one font with continuously scaled glyph transforms | Replay of 748 actual glyph operations: first submission 8.1 ms → 1.3 ms; mean byte delta 0.071/255 |
| Footer reveal animates large-text letter spacing, causing repeated layout | Keep final typography fixed; reveal with opacity and transform only | Same settled typography, no layout-property transition |

Rows describe the implementation under review. The verification record below is
the authority for what has actually been exercised end to end.

## Acceptance targets and verification route

Use a production build on a fixed viewport, then record the device/browser and
route. FPS varies with GPU, monitor refresh, and shader complexity; do not promise
zero lag from a unit suite or a development-server recording.

- Entry: visible shell within 200 ms for a warm route transition; Design Lab ready
  within 600 ms of the measured entry flow; cold loading reported separately.
- Editing: respond within one display frame where practical; no synchronous
  storage or full-document serialization on each pointer movement.
- Switching: exactly one active project/editor; bounded retained DOM/canvases;
  input under 200 ms; no lost edit after fast navigation.
- Rendering: ordinary playback follows native cadence; zero unnecessary redraws
  while a provider is paused; hidden work does not start new heavy providers.
- Layout: no clipped toolbar controls at 1280/1440 desktop widths; initial active
  artboard fits; view-only actions leave source geometry unchanged.
- Persistence: edit → switch → return, edit → immediate reload, named save →
  reopen, and unavailable IndexedDB recovery all retain the latest valid state.
- Output: inspect a real nonempty decoded artifact, including MIME and dimensions;
  a capture must wait for readiness rather than guessing an arbitrary delay.

Run `pnpm test:performance` against a production server for landing scroll,
Studio entry, continuous shader zoom drag, project switching, project-tab drag,
and horizontal rails. The landing lifecycle check separately verifies real dither
pixels 300px below the viewport, nearby canvas retention, and distant release.
Use `--landing-only` for loaded-editor scrolling and shader prewarming; the scroll
probe waits for the real hero editor rather than measuring its placeholder.
Set `GLYPHFIELD_PERF_TRACE_PATH` to an
absolute JSON path to collect a diagnostic Chrome trace (tracing adds overhead).
The test uses public UI navigation instead of mutating internal localStorage.
Studio readiness waits for the restored canvas framing, not just library cards.
It does not by itself prove shader frame quality or every export codec.

## Verification record

Browser checks (local Chromium through agent-browser):

- Design Lab at 1440×900 and 1280×900: restored artboard centered; no automatic
  guide covering it; narrow timeline stays within its column.
- Individual and two-layer selections: outlines clip at the inspector boundary;
  visible handles respond, clipped handles do not intercept inspector clicks.
- Native Paper capture: sampled pixel hash `391037860` remained unchanged over
  500 ms, after applying its serialized source, and after PNG export. The output
  decoded as `image/png`, 960×540, 321,623 bytes, with nonempty varied pixels.
- Logo keyboard movement: `x=-20, y=-10` persisted unchanged after reload.
- Sphere: paused colors update through the actual color field; the loaded image
  remains stable. Fluid: after keyboard scrub committed frame 24, its hash
  `4226845957` stayed unchanged with zero `drawArrays` calls over 700 ms.
- Navigation: tool/project URLs track visible state and restore on reload.
  Search opens modally, Escape restores launcher focus, and keyboard traversal
  keeps the last result in view without reflowing the sidebar.
- Named checkpoints: rename while focused → Save commits both source and name;
  restore reopens the saved artboard; Fork captures current edits with lineage;
  Clone creates an independent copy and leaves the original intact. Names and
  frame 28 survive a full reload after outside-click dismissal of the popup.
  Autosave preserves the working draft; “Unsaved changes” refers to the named
  checkpoint, not to missing draft recovery.

Automated checks: 798 tests across 123 files pass, including adverse persistence,
keyboard navigation, renderer readiness, and retained-workspace tests. Both lint
passes and production build/typechecking pass. Agent-docs doctor: 4 checks pass.

Final production performance sample: local macOS Chromium 151 (headless, DPR 1), production server on port
3013, 1440×900 (640×800 for horizontal rails). All probes remained focused and
visible; no thresholds were relaxed. Two consecutive full runs passed. The table
records the second run; these are local observations, not a claim about cold
networks, every device, or every material.

| Scenario | Observed result | Status |
| --- | --- | --- |
| Studio entry | Shell 46.5 ms; restored/framed editor 218.9 ms; p95 frame 17.2 ms; max 33.3 ms; CLS 0 | Pass |
| Continuous shader zoom drag | 45 distinct values; p95 frame 16.7 ms; max 17.5 ms; max interaction 24 ms; canvas retained | Pass |
| Project switching | p95 frame 17.4 ms; max 17.7 ms; max interaction 48 ms; DOM 1618 → 1618; two retained workspaces and one canvas | Pass |
| Project-tab drag | p95 frame 16.8 ms; max 17.6 ms; max interaction 32 ms | Pass |
| Horizontal rails | p95 frame 17.5 ms; max 17.7 ms; max interaction 40 ms | Pass |
| Landing scroll | p95 frame 17.4 ms; max 25.6 ms; max interaction 24 ms; DOM 1023 → 1023; canvases 2 → 2 | Pass |
| Shader prewarm/retention | 25 sampled colors painted in 472 ms while 300 px below view; same canvas on entry and nearby exit; distant canvas released | Pass |

All six timing probes reported zero long tasks and zero layout shift (CLS is
recorded to five decimal places). The five continuous-interaction probes also had
zero long animation frames and zero dropped frames under the existing
cadence-normalized budget. Studio startup recorded one 56.6 ms long animation
frame with zero blocking duration, within its existing 60 ms budget; this is not
a claim of literally zero startup work.

Earlier runs failed landing scroll with isolated frames of 141–283 ms and retained
connector DOM. Trace inspection identified expensive glyph drawing and GPU/raster
stalls; fixed-font glyph transforms, offscreen suspension, real warm-renderer
retention, and connector teardown were then verified. The final first run also
passed (shell 42.1 ms, framed editor 206.7 ms). Keep these measurements scoped to
this tested journey rather than describing the whole app as universally “no lag.”

Screenshots are retained locally in `/tmp/glyphfield-journey-*`,
`/tmp/glyphfield-selection-clipped.png`, and
`/tmp/glyphfield-group-selection-clipped.png`. Additional checkpoint/framing proof:
`/tmp/glyphfield-checkpoint-popup-unclipped.png` and `/tmp/glyphfield-entry-framed.png`.
Final production visual check: `/tmp/glyphfield-final-studio.png` (1440×900).

## Follow-up experience work

- Keep the now-passing landing/Studio budgets in regression runs and repeat them
  on representative lower-powered devices before making broad performance claims.
- Audit every tool's first useful action and blank/import/error states with new
  and returning projects, including keyboard and narrow touch layouts.
- Compare actual canvas pixels with saved/reopened/exported output for each shader
  provider and converter; native frame anchors are provider-specific and should
  not be described as a universal bitmap snapshot. Fluid still needs simulation
  snapshots or deterministic replay for arbitrary timestamp reconstruction.
- Broaden named-checkpoint verification beyond the exercised Design Lab flow,
  including storage failure during rename/save and other tools' source adapters.
- Extend performance coverage beyond zoom to other continuous controls, multiple artboards, large
  imported assets, and long animation projects, with input and memory budgets.
- Refine the scroll-aware prewarm scheduler: it currently waits for scrolling to
  settle before optional GPU creation, so continuous scrolling can postpone the
  live renderer. Keep the immediate fallback and verify any scheduling change
  against both early pixel readiness and scroll-frame budgets.
- Implement a real cross-tool composition handoff if needed; the Animation link
  now explicitly says it opens a separate workspace.

These remain explicit follow-ups until implemented and verified. A broad request
for a better experience is not evidence that every tool and device is now flawless.
