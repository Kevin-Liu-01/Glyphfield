# Lottie design gauntlet

September 25, 2026. Rebuilt all seven built-in motion studies and reviewed them
in the real Studio player. The direction is editorial: a warm paper surface,
dark ink, one terracotta accent, larger typography, and an explanatory motion
gesture inside a composition that remains visible throughout the loop.

## Review loop

| Before | After | Why |
| --- | --- | --- |
| Signal relay: faint connectors between small boxes | A curved fan of nine paths carrying three signals from one origin | The silhouette communicates expansion without a miniature dashboard. |
| Decision router: a fork connecting two cards | Two fields of curved paths, with a stronger selected direction | Contrast and motion establish the decision. |
| Source merge: labeled boxes and a central diamond | Fifteen perspectives converge through one aperture | Density resolves into a single focal point. |
| Layer assembly: small stacked outlines | Three large ruled architectural planes with restrained separation | Proportions and overlapping linework make the structure legible. |
| Quality scan: a moving beam over checklist rows | An optical sample field brightens locally as the scan passes | The motion produces a visible result. |
| Network orbit: a diagram with a count in its center | A globe with meridians, latitudes, and a tilted exchange orbit | The network reads as a spatial system; the caption has a clear safe area. |
| Endpoint delivery: three similar cards | Browser, device, and API expressions with paths reaching their actual edges | Each destination is recognizable without relying on a label. |
| Small type, low-contrast details, late entrances | Larger headings, darker secondary text, authored stroke hierarchy, complete first frames | The studies work as posters as well as moving scenes. |

The next review pass corrected fine-line contrast, detached endpoint paths,
an orbit/caption collision, and scan highlights that did not follow the beam.
Light and monochrome palettes preserve the brand mark by tinting its rasterized
alpha mask to the primary artwork color.

Final visual evidence includes all seven scenes in both palettes and direct
canvas recordings covering a complete cycle of each scene. The recordings
composite the native transparent vector surface over the selected paper color;
the timeline is played by the real Studio renderer.

## Renderer defect found during visual review

Replacing a scene through the WebGL player's `load()` could display the new
scene during playback but repaint the original scene when seeking. This was
reproduced with real pointer and keyboard input as well as the Browser API.

Source replacement now disposes the old player and creates a fresh native
timeline and canvas. Palette changes use the same path. Paused playback and
reduced-motion preferences remain respected, and frame export is disabled while
the new source is preparing. The browser regressions switch away and back before
checking every preset, so the default preset exercises replacement too.

Pausing also flushes the player's exact stopped frame into the inspector. The
previous throttled display could lag by one or two frames, making a subsequent
seek to the displayed value do nothing and giving an export the wrong frame name.

## Repeatable checks

`e2e/lottie-gauntlet.spec.ts` checks each preset at frames 0, 75, 150, 225, and
299. Each PNG is decoded and checked for dimensions, content, filename, and
agreement with a screenshot of the native preview. The closing and opening
frames are compared separately; intermediate frames must contain local pixel
changes. Motion is measured locally at 288 × 180 so a small traveling signal is
not averaged away by the surrounding paper.
Another case checks reduced-motion playback.

The final production run passed all 24 gauntlet cases across Chromium, WebKit,
and Firefox: 105 decoded PNG exports, with no retries or skipped cases. The
largest mean preview/export channel difference was 1.882 on a 0–255 scale;
the largest opening/closing difference was 0.037. Nine additional workflow
checks passed for source reapplication, persistence, controlled inputs, and
initial/sought-frame exports. The source workflow waits for the native timeline
to finish loading before reading its normalized source.

The unit suite passed 1,935 tests. Production build, typecheck, lint, documentation
generation, and agent-docs checks passed. These browser results do not measure
GPU presentation FPS, and the WebKit runner is not installed Safari.

```sh
pnpm build
pnpm start --port 3014
# In a second terminal, with no other browser/GPU workload:
pnpm test:browsers e2e/lottie-gauntlet.spec.ts
pnpm test src/lib/__tests__/lottieExamples.test.ts src/lib/__tests__/lottieCanvasDocument.test.ts
```

Pixel checks catch stale scenes, blank output, and broken loop boundaries.
They do not certify visual taste. The composition and motion reviews above are
separate human-readable design decisions. Existing saved compositions retain
their source; choosing a built-in preset again loads its revised design.
