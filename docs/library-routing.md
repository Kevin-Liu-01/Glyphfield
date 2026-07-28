# Studio library routing

Glyphfield uses libraries only when they improve the exported artifact or a
real interaction. Visual references do not automatically become runtime
dependencies.

| Studio surface | Route | Decision |
| --- | --- | --- |
| Static terminal and code cards | [Prism](https://prismjs.com/) | Installed. Modular TypeScript, Python, and Bash grammars drive both the live preview and PNG export. |
| Interactive terminal or agent console | [wterm](https://wterm.dev/) | Use when a tool owns a real shell, selection, scrollback, accessibility, or PTY transport. Do not add its WASM terminal core to a static code card. |
| OpenGraph and repeatable social images | [Takumi](https://takumi.kane.tw/) | Revisit for server or agent-driven batch rendering. Keep the current local SVG path while every render remains in-browser. |
| Static gradient exploration | [FeralUI Gradient Builder](https://feralui.dev/gradients) | Reference only. Preserve deterministic SVG parameters in Surface Lab. |
| Layered gradient composition | [Gradientool](https://www.gradientool.com/) | Interaction reference for mesh, orbit, wave, focal-point, relief, grain, and dither controls. Glyphfield keeps an original SVG/WebGL renderer so agent output remains deterministic. |
| Curated gradient direction | [Grainient](https://grainient.supply/freebies) | Visual reference for named preset quality and grain treatment. Third-party image downloads are not bundled; Glyphfield presets are original and fully editable. |
| Paper shader families | [Paper Shaders](https://shaders.paper.design/) | Reference only. Its PolyForm Shield license disallows use in a competing design tool, so Glyphfield ships original mesh, grain, and dither shader implementations instead. |
| Dithered objects and marks | [Canvas UI](https://canvasui.dev/) | Behavior reference. Its MIT + Commons Clause component source is not copied into Glyphfield's MIT source tree; the shared logo appearance renderer implements an original export-matched ordered dither. |
| 3D moving gradients | [ShaderGradient](https://github.com/ruucm/shadergradient) | Installed. The MIT-licensed React renderer powers an editable version of the supplied sphere preset with local PNG/GIF capture. |
| Composable shader scenes | [Shaders.com](https://shaders.com/) | Evaluated, but not shipped: its license prohibits redistribution in a competing design editor. Glyphfield instead uses original local GLSL recipes for the ten scene families documented by Shaders.com. |
| Original lightweight materials | Native WebGL | Retained for fast GLSL recipes, custom fragment input, and deterministic three-color uniforms. |

The default test is simple: if a dependency does not improve fidelity,
accessibility, performance, or export parity, keep the Studio implementation
smaller.
