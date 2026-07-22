# Glyphfield

Glyphfield is a local-first brand studio for motion, brand foundations,
OpenGraph images, logos, color tokens, typography, code cards, partnership
lockups, blog covers, slides, and component review.

Project tabs keep separate local workspaces for each brand. Each tab is shown as
`LOGO / brand`, while GT ships as
the built-in reference identity, populated from its bundled logo family,
semantic tokens, typography, product language, proof, and motion assets. Every
identity has a full design-board view with PNG and JSON export.

The Moodboard tool composes positioning, logo family, color tokens,
typography, product architecture, voice, and proof assets into a downloadable
4:5 PNG. Export presets range from 1600×2000 through 4800×6000, with a custom
width option that preserves the layout ratio.

Glyphfield opens on a neutral Starter project. Local projects and completed
reference systems such as GT share one navigable project rail. The
Logo Shader tool includes original WebGL materials for backgrounds and
alpha-masked logo fills, with still PNG and animated GIF export.

Brand Elements is the default Studio surface. It applies the active identity
to 33 searchable touchpoints spanning email, CLI/ASCII, repositories, social,
slides and editorial, event credentials, web cards, icons, and physical print.

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

- `/llms.txt` provides a concise capability and policy index.
- `/api/catalog` returns the current Glyphfield tool catalog as structured JSON.
- `/api/identities` returns the built-in identity catalog and full GT preset.
- `/api/elements` returns the complete brand-element taxonomy.
- `/studio` opens the full-screen interactive workspace.

## Local development

```bash
pnpm install
pnpm dev
```

Glyphfield runs on port `3012`. Image and font inputs remain in the browser; no
upload service is required for the current tools.
