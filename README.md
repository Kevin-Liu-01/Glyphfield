# Glyphfield

Glyphfield is a local-first brand studio for motion, brand foundations,
OpenGraph images, logos, color tokens, typography, code cards, partnership
lockups, blog covers, slides, and component review.

Project tabs keep separate local workspaces for each brand. Each tab is shown as
`LOGO / brand`, while GT ships as
the built-in reference identity, populated from its bundled logo family,
semantic tokens, typography, product language, proof, and motion assets. Every
identity has a full design-board view with PNG and JSON export.

The Moodboard tool composes four identity foundations—identity, logo family,
color, and typography—with four finished applications—onboarding email, CLI,
product page, and event pass—into a downloadable 4:5 board. Inter and Geist
Mono are embedded into every exported SVG before PNG rasterization. Export
presets range from 1600×2000 through 4800×6000, with a custom width option that
preserves the layout ratio.

Glyphfield opens on a neutral Starter project. Local projects and completed
reference systems such as GT share one navigable project rail. The
Logo Shader includes original WebGL materials for backgrounds and alpha-masked
logo fills, including configurable liquid metal, mercury, and brushed-steel
recipes with still PNG and animated GIF export. Background Lab builds gradients,
grainy gradients, ordered Bayer dithering, dots, lines, and grids as exportable
SVG-composed PNGs with an optional identity mark.

Brand Elements is the default Studio surface. It applies the active identity
to 33 searchable touchpoints spanning email, CLI/ASCII, repositories, social,
slides and editorial, event credentials, web cards, icons, and physical print.

Terminal Card uses modular Prism grammars for TypeScript, Python, and Bash so
the editable preview and PNG export share one syntax-token pipeline. A full
terminal emulator is intentionally outside this static graphics tool.
See [Studio library routing](./docs/library-routing.md) for the wiki-informed
dependency decisions across terminal, OpenGraph, gradients, and shaders.

## Public access

The deployed studio is free to browse and use. Its source is publicly readable
so people and software agents can inspect how the product works.

This project is source-available, not open-source software. Copyright is held
by Kevin Liu; no permission is granted to copy, modify,
distribute, sublicense, sell, or create derivative works. See
[LICENSE](./LICENSE).

The bundled GT and customer-reference assets remain the property of their
respective owners and are included only to demonstrate the GT reference
project.

## Agent surfaces

- `/llms.txt` is the operational agent runbook with schemas, limits, examples,
  output handling, browser fallback, and policy.
- `/api/agent` returns the versioned agent manifest and generation contract.
- `/openapi.json` exposes the public API as OpenAPI 3.1.
- `/api/generate` accepts JSON and returns portable SVG backgrounds,
  slide/blog/partnership templates, or identity-aware element briefs.
- `/api/catalog` returns the current Glyphfield tool catalog as structured JSON.
- `/api/identities` returns the built-in identity catalog and full GT preset.
- `/api/elements` returns the complete brand-element taxonomy.
- `/studio` opens the full-screen interactive workspace.

Example:

```bash
curl -sS -X POST http://localhost:3012/api/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "kind": "template",
    "template": "slides",
    "identity": { "preset": "gt" },
    "title": "Code is the source of truth.",
    "output": "raw"
  }' \
  -o gt-slide.svg
```

The API embeds bundled logo assets into generated SVGs. Custom agents can send
authorized images as base64 data URLs; Glyphfield does not fetch remote asset
URLs or persist generation requests.

## Local development

```bash
pnpm install
pnpm dev
```

Glyphfield runs on port `3012`. Image and font inputs remain in the browser; no
upload service is required for the current tools.
