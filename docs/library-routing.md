# Studio library routing

Glyphfield uses libraries only when they improve the exported artifact or a
real interaction. Visual references do not automatically become runtime
dependencies.

| Studio surface | Route | Decision |
| --- | --- | --- |
| Static terminal and code cards | [Prism](https://prismjs.com/) | Installed. Modular TypeScript, Python, and Bash grammars drive both the live preview and PNG export. |
| Interactive terminal or agent console | [wterm](https://wterm.dev/) | Use when a tool owns a real shell, selection, scrollback, accessibility, or PTY transport. Do not add its WASM terminal core to a static code card. |
| OpenGraph and repeatable social images | [Takumi](https://takumi.kane.tw/) | Revisit for server or agent-driven batch rendering. Keep the current local SVG path while every render remains in-browser. |
| Gradient exploration | [FeralUI Gradient Builder](https://feralui.dev/gradients) | Reference only. Preserve editable parameters in Background Lab instead of adding a hosted-tool dependency. |
| Shader materials | [Shaders.com](https://shaders.com/) and [Paper Shaders](https://shaders.paper.design/) | Parameter and quality references only. Glyphfield ships original shaders because the referenced sources have distribution or competitive-use restrictions. |

The default test is simple: if a dependency does not improve fidelity,
accessibility, performance, or export parity, keep the Studio implementation
smaller.
