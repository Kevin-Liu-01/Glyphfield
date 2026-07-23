# Studio library routing

Glyphfield uses libraries only when they improve the exported artifact or a
real interaction. Visual references do not automatically become runtime
dependencies.

| Studio surface | Route | Decision |
| --- | --- | --- |
| Static terminal and code cards | [Prism](https://prismjs.com/) | Installed. Modular TypeScript, Python, and Bash grammars drive both the live preview and PNG export. |
| Interactive terminal or agent console | [wterm](https://wterm.dev/) | Use when a tool owns a real shell, selection, scrollback, accessibility, or PTY transport. Do not add its WASM terminal core to a static code card. |
| OpenGraph and repeatable social images | [Takumi](https://takumi.kane.tw/) | Revisit for server or agent-driven batch rendering. Keep the current local SVG path while every render remains in-browser. |
| Static gradient exploration | [FeralUI Gradient Builder](https://feralui.dev/gradients) | Reference only. Preserve deterministic SVG parameters in Background Lab. |
| 3D moving gradients | [ShaderGradient](https://github.com/ruucm/shadergradient) | Installed. The MIT-licensed React renderer powers an editable version of the supplied sphere preset with local PNG/GIF capture. |
| Composable shader scenes | [Shaders.com](https://shaders.com/) | Evaluated, but not shipped: its license prohibits redistribution in a competing design editor. Glyphfield instead uses original local GLSL recipes for the ten scene families documented by Shaders.com. |
| Original lightweight materials | Native WebGL | Retained for fast GLSL recipes, custom fragment input, and deterministic two-color uniforms. |

The default test is simple: if a dependency does not improve fidelity,
accessibility, performance, or export parity, keep the Studio implementation
smaller.
