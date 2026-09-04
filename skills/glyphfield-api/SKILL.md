---
name: glyphfield-api
description: Discover and use Glyphfield's deterministic HTTP API for brand identities, catalogs, element briefs, SVG backgrounds/templates, and apply-ready Design Lab sequences. Use for programmatic or batch generation that should not depend on an open browser canvas.
---

# Glyphfield API

Generate from the live contract rather than remembered IDs or fields.

## Start with discovery

Resolve the Glyphfield origin from the user or environment. Use `http://localhost:3012` only for this repository's local development server.

1. Read `/api/agent` for interfaces, policies, resources, and generation kinds.
2. Read `/api/labs` for the current tool catalog. Do not hard-code its count.
3. Read the relevant `/api/materials`, `/api/identities`, `/api/elements`, or `/api/catalog` data.
4. Read `GET /api/generate` immediately before building a POST body.
5. Use `/openapi.json`, `/llms.txt`, or `/llms-full.txt` when the task needs the full machine contract.

Read [references/http-generation.md](references/http-generation.md) for request patterns and the Design Lab bridge.

## Choose the generation kind

- `template`: deterministic slide, blog-cover, or partnership SVG.
- `background`: deterministic gradient, pattern, dither, or tactile surface SVG.
- `element-brief`: one catalog element resolved against an identity.
- `design-sequence`: an apply-ready layered composition plus shader timeline and Browser API commands.

Use `output: "raw"` for direct SVG bytes where supported. Otherwise parse the JSON artifact envelope. Design-sequence output is JSON and requires the browser for authentic Canvas/WebGL raster or motion export.

## Contract rules

- Send `Content-Type: application/json`.
- Unknown top-level fields are rejected; use only values from current discovery.
- Do not invent shader, identity, element, surface, or tool IDs.
- Do not send remote URLs. Use supported data URLs or an authorized browser `File` when a local asset is needed.
- Treat `400`, `413`, `415`, and `429` bodies as actionable structured errors. Do not retry unchanged invalid input.
- HTTP generation does not mutate an open Studio project.
- For public or self-hosted deployment work, load `/docs/reference/api-security` and `/docs/reference/self-hosting`; repository validation and edge rate limiting are separate controls.

## Completion

For SVG, confirm status, MIME type, extension, dimensions, and a non-empty body. For JSON, validate the expected schema fields. For a design sequence, apply `response.document` in Design Lab, re-read normalized source, inspect the canvas, and export there.
