# Studio library routing

Glyphfield adds a library only when it improves an exported file or a real
interaction. A visual reference does not become a runtime dependency on its own.
The table records each decision. Rows marked "Installed" name the version in
`package.json` on 2026-10-14.

| Studio surface | Route | Decision |
| --- | --- | --- |
| Static terminal and code cards | [Prism](https://prismjs.com/) | Installed (`prismjs` 1.30.0, MIT). The Bash, Python, TypeScript, JSX, TSX and JSON grammars drive both the live preview and the PNG and SVG exports. |
| Interactive terminal or agent console | [wterm](https://wterm.dev/) | Use it when a tool owns a real shell, selection, scrollback, accessibility or PTY transport. A static code card does not need its WASM terminal core. |
| OpenGraph and repeatable social images | [Takumi](https://takumi.kane.tw/) | Revisit for server or agent-driven batch rendering. The site's own OpenGraph images use `next/og`, and the Studio templates render SVG in the browser and through `POST /api/generate`. |
| Static gradient exploration | [FeralUI Gradient Builder](https://feralui.dev/gradients) | Reference only. The deterministic SVG background renderer (`src/lib/backgroundSvg.ts`) keeps its own parameters. |
| Layered gradient composition | [Gradientool](https://www.gradientool.com/) | Interaction reference for mesh, orbit, wave, focal-point, relief, grain and dither controls. Glyphfield keeps an original SVG and WebGL renderer so agent output stays deterministic. Two original GLSL design studies link to it as their visual reference. |
| Curated gradient direction | [Grainient](https://grainient.supply/freebies) | Visual reference for named preset quality and grain treatment. Its image downloads are not bundled. Two original GLSL design studies link to it as their visual reference. |
| Paper shader families | [Paper Shaders](https://shaders.paper.design/) | Installed (`@paper-design/shaders-react` 0.0.78, Apache-2.0). An earlier review in this file recorded a PolyForm Shield license and kept Paper as a reference; the installed version is Apache-2.0. All 29 families and their 120 presets are registered in `src/lib/liveMaterials.ts`. The Perlin Noise, Simplex Noise and Waves families are retired from the library listing, and saved documents that use them still load. `patches/@paper-design__shaders@0.0.78.patch` pools WebGL contexts and compiled programs across remounts. |
| Composable shader scenes and image effects | [Shaders.com](https://shaders.com/) | Installed (`shaders` 4.0.1, MIT, from [shader-effects-inc/shaders](https://github.com/shader-effects-inc/shaders)). An earlier review in this file found a license that prohibited redistribution in a competing editor; the 4.0.1 engine and component library are MIT. Its WebGPU components appear in the Shader Library with the `shader-effects-` ID prefix, and its image effects run on Design Lab Effect layers. The separately licensed paid Shaders.com presets and sections are not included. The older `shaders-` materials are original GLSL studies of Shaders.com scene families. |
| Dithered objects and marks | [Canvas UI](https://canvasui.dev/) | Behavior reference. Its MIT + Commons Clause component source is not copied into Glyphfield's MIT source tree. The shared logo appearance renderer implements an original ordered dither that matches its export. |
| 3D moving gradients | [ShaderGradient](https://github.com/ruucm/shadergradient) | Installed (`@shadergradient/react` 2.4.20, MIT) with `@react-three/fiber` and `three`. It renders the Prismatic sphere material with local PNG, GIF and MP4 capture. |
| Lottie playback | [dotLottie web](https://github.com/LottieFiles/dotlottie-web) | Installed (`@lottiefiles/dotlottie-web` 0.78.2, MIT). The Lottie tool plays, seeks and renders frames with it. |
| GIF and MP4 encoding | [gifenc](https://github.com/mattdesl/gifenc) and [Mediabunny](https://mediabunny.dev/) | Installed (`gifenc` 1.0.3, MIT; `mediabunny` 1.53.0, MPL-2.0). `src/lib/exportGif.ts` and `src/lib/canvasExport.ts` encode motion exports in the browser. |
| Original lightweight materials | Native WebGL | Kept for fast GLSL recipes, custom fragment input and deterministic three-color uniforms. |

If a dependency does not improve fidelity, accessibility, performance or export
parity, the Studio implementation stays smaller without it.
