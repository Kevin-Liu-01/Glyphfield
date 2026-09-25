# Glyphfield tool audit — September 25, 2026

Audited the 14 public tools beyond Design Lab, plus shared Studio controls,
project workflows, documentation, and HTTP generation. The scope is behavior,
state persistence, accessibility, and exported artifacts. This is not a new
whole-app frame-rate benchmark or a guarantee for arbitrarily large projects.

## Issues corrected

| Issue | Cause and correction | Regression evidence |
| --- | --- | --- |
| Animation GIF/MP4 export fails after a partial frame import | A background-only frame override leaves text metrics undefined. Merge frame defaults before rendering, restoring history, and importing artboards. | Partial-frame unit test and decoded GIF/MP4 shader exports, including frame overrides. |
| Lottie frame-zero PNG export times out | Seeking to the already-rendered initial frame emits no new render event. Capture after load and the synchronous seek; export the player's actual frame rather than throttled inspector state. | Export frame 0 and frame 120, check filenames, decode dimensions, and check nonblank pixels on the later frame. |
| Brand book prints blank or incomplete PDFs | Retained workspace layers and root overflow clip print layout. Reset active print containers, hide inactive workspaces, and omit the final page break. | A 51-page Chromium PDF matches the 51 book pages; reader restoration is checked in all engines. |
| Export preview loses keyboard ownership | The overlay neither focused a control nor wrapped Tab, and portal events could reach the editor. Focus the close control, wrap Tab, handle Escape, stop editor shortcut propagation, and restore prior focus. | Focus, Shift+Tab/Tab wrapping, and Escape checks across exported tool artifacts. |
| Shared sliders have missing or changing accessible names | A nested output can own the implicit label; whole-label fallback includes the changing value. Explicitly associate each input with its label text. | Every visible slider has a name at desktop and medium widths; repeated `studio.set('Speed', ...)` retains the same label. |
| Automation advertises closed color-picker controls | Native popovers remain mounted while closed. Exclude controls inside closed popovers from discovery and lookup. | HEX control absent while closed and available after opening the picker. |
| Browser API setters fail to commit controlled input values | Direct assignment updates React's value tracking before the input event, suppressing the change. Use the native input/textarea/select setter before dispatching input/change. | Set a textarea and repeatedly change a slider through the public API, then verify document state. |

Existing project-import checks were also updated for the current error-detail
control and to wait for the export preview before dismissing it.

## Tool coverage

| Tools | Checks |
| --- | --- |
| Brand identity, Brand elements | Edit, source reapply, JSON export, navigation, reload; explicit identity save. |
| Moodboard, Open Graph, Terminal, Blog, Slides, Partnership | Edit or apply portable source, decode PNG output, check dimensions and pixel variation, navigate away/back, reload. |
| Colors, Typography, Buttons | Edit, source reapply, navigation, reload; color token output and explicit typography save. |
| Lottie | Playback settings, source reapply, initial and sought-frame PNG export, keyboard controls, navigation, reload. |
| Brand book | Read/next/previous, print preparation, reader restoration, actual Chromium PDF page count, visual inspection of the first PDF page. |
| Animation | Frame selection, toolbar history/files, imported frame overrides, decoded shader GIF/MP4 output, timeline following. |
| Shared Studio | Header/File-menu layout at 1440 and 1024 pixels, sliders, color pickers, export dialogs, project creation/import/duplication/tabs, retained editor ownership, print isolation. |

Fixtures use the public Studio API and fresh isolated browser contexts. They do
not modify app storage or React internals. Interactive investigation used
`agent-browser`; repeatable regressions are in `e2e/tool-workflows.spec.ts` and the
existing browser suites.

## Documentation and API checks

The local production server returned successful, nonempty responses with the
expected content types for `/docs`, `/docs/getting-started`, `/llms.txt`,
`/llms-full.txt`, `/openapi.json`, `/api/agent`, `/api/catalog`, `/api/labs`,
`/api/materials`, `/api/identities`, `/api/elements`, `/api/generate`, and
`/api/docs/reference/browser-api`.

All four examples published by `GET /api/generate` succeeded: background, brief,
design sequence, and slide. JSON bodies were parsed; the slide SVG was parsed as
XML. An unknown top-level request field returned HTTP 400 with `unknown_field`.
These checks do not replace browser-rendered export verification.

## Validation

- **132 browser checks passed**, with no failures, skips, or retries: 90 tool,
  export, import, and interface checks; 39 selection, project-tab, duplication,
  and timeline checks; and three print-isolation checks. Each suite ran serially
  across Chromium, WebKit, and Firefox against the local production build.
- **1,933 unit tests in 214 files passed**. The 12 automation ownership/scope
  checks also passed after the final setter refactor.
- Production build and its TypeScript check passed; both lint passes passed.
- Documentation doctor passed all four checks, with no warnings.
- The final generated Chromium PDF has 51 pages and a verified visible cover.

Repeat against a dedicated production server on port 3014:

```sh
pnpm test:browsers e2e/tool-workflows.spec.ts e2e/studio-interface.spec.ts e2e/animation-shader-export.spec.ts e2e/create-project.spec.ts e2e/animation-toolbar-files-history.spec.ts
pnpm test:browsers e2e/animation-selection.spec.ts e2e/project-tabs.spec.ts e2e/project-duplication.spec.ts e2e/timeline-follow.spec.ts
pnpm test:browsers e2e/canvas-interactions.spec.ts --grep 'print rules'
```

The first browser sweep reproduced Animation export failures and stale test
expectations. New artifact checks subsequently reproduced the Lottie, printing,
and automation bugs above. Failed intermediate runs remain diagnostic evidence;
they are not counted as passing final checks.

## Limits

WebKit coverage is not installed Safari coverage. This audit does not establish
mobile-device, every GPU/codec, or every uploaded-file behavior. Brand book's
actual PDF is checked in Chromium; WebKit and Firefox check print preparation
and reader restoration. Performance results for the earlier Design Lab work
remain documented separately in [browser compatibility](browser-compatibility.md).
No production deployment is implied by these local checks.
