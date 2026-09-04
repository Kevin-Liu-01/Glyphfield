# glyphfield - Agent Index

> Pointer index for agents working in this repo. Keep this file lean: load linked
> files on demand, prune no-op instructions, and keep generated facts inside
> `agent-docs:auto` blocks.

## Overview

Glyphfield is a local-first brand system and production Studio. One `BrandIdentity`
feeds interactive tools for identity, brand applications, moodboards, books,
motion, Lottie, layered Design Lab compositions, foundations, templates, and
components. The same product is exposed to agents through discovery/catalog
routes, deterministic HTTP generation, processed Markdown docs, and the
programmatic Studio Browser API.

Start user-facing work by deciding which contract owns it:

- Deterministic data/SVG: `src/app/api/**` and `src/lib/agentGeneration.ts`.
- Authentic Canvas/WebGL/local-file output: the Studio component and
  `src/lib/studioAutomation.ts`.
- Portable layered composition: `src/lib/canvasDocument.ts` plus the host adapter.
- Product guidance: `content/docs/**`, `/llms.txt`, and generated `/llms-full.txt`.

## Product usage skills

When the task is to use Glyphfield rather than modify its implementation, load the
smallest matching checked-in Agent Skill:

- [`skills/glyphfield-create/SKILL.md`](skills/glyphfield-create/SKILL.md) — layered
  Design Lab composition and saved-design work.
- [`skills/glyphfield-api/SKILL.md`](skills/glyphfield-api/SKILL.md) — deterministic
  HTTP discovery and generation.
- [`skills/glyphfield-studio/SKILL.md`](skills/glyphfield-studio/SKILL.md) — live
  Browser API operation, source round trips, and local files.
- [`skills/glyphfield-export/SKILL.md`](skills/glyphfield-export/SKILL.md) — still
  and motion export verification.

Combine skills only when the requested workflow crosses those boundaries. These
packages describe product operation; the root and directory `SKILL.md` files
describe repository contribution.

## Architecture Pointers

- `src/components/StudioApp.tsx` — projects, tabs, navigation, active identity/tool.
- `src/lib/studioCatalog.ts` — public navigable tool IDs, names, categories, search.
- `src/components/StudioToolWorkspace.tsx` — maps public tools to editors.
- `src/components/ShaderLabStudio.tsx` — Design Lab composition, materials, saved
  designs, still/motion export, and its Browser API adapter.
- `src/components/AnimationStudio.tsx` — frame/timing/audio motion workspace.
- `src/lib/canvasDocument.ts` — portable scene graph and mutation/history model.
- `src/lib/designLabDocument.ts` — Design Lab ↔ CanvasDocument adapter.
- `src/lib/agentApi.ts`, `agentCatalog.ts`, `agentGeneration.ts` — public agent
  manifest, catalogs, validation, generation, and examples.
- `src/lib/studioAutomation.ts` — `window.glyphfield.studio` runtime contract.
- `content/docs/**` + `src/components/DocsMdx.tsx` — human and machine docs source.
- `public/llms.txt` — concise agent router; `src/app/llms-full.txt/route.ts` emits the
  complete processed docs corpus.

## Stack
<!-- agent-docs:auto:stack start -->
- **Name:** glyphfield
- **Package manager:** pnpm
- **Languages:** typescript
- **Framework:** next
<!-- agent-docs:auto:stack end -->

## Commands
<!-- agent-docs:auto:commands start -->
- Package scripts detected: 20. Use `package.json` as the exhaustive source.
- `pnpm run dev` - next dev --turbopack --port 3012
- `pnpm run build` - next build --turbopack
- `pnpm run test` - vitest run
- `pnpm run lint` - pnpm lint:fast && pnpm lint:cognitive
- `pnpm run typecheck` - fumadocs-mdx && tsc6 --noEmit
- `pnpm run agent-docs` - npx tsx scripts/run-agent-docs.ts
- Keep this block compact. Put full command catalogs in a generated command index, not in AGENTS.md.
<!-- agent-docs:auto:commands end -->

## Directory index
<!-- agent-docs:auto:dirmap start -->
| Directory | Skill | Purpose |
|---|---|---|
| `scripts/` | [`scripts/SKILL.md`](scripts/SKILL.md) | Repository diagnostics and the canonical agent-docs forwarding shim. |
| `src/app/` | [`src/app/SKILL.md`](src/app/SKILL.md) | Next routes, documentation shell, machine endpoints, and global styles. |
| `src/components/` | [`src/components/SKILL.md`](src/components/SKILL.md) | Studio editors, shared UI systems, and authentic browser renderers. |
| `src/hooks/` | [`src/hooks/SKILL.md`](src/hooks/SKILL.md) | Persistent, portable, and performance-sensitive React state lifecycles. |
| `src/lib/` | [`src/lib/SKILL.md`](src/lib/SKILL.md) | Product models, serializers, render/export helpers, and agent contracts. |
<!-- agent-docs:auto:dirmap end -->

## Repo graph sidecar (Graphify)
<!-- agent-docs:auto:repo-graph start -->
- Use Graphify for repo topology, path/explain/affected questions, PR risk, and unfamiliar codebase orientation.
- Use `rg` for exact strings; use Kevin-Wiki `qmd` for people, tools, decisions, and compiled wiki knowledge.
- Use `agent-browser` for browser/UI work; use Playwright only for committed regression tests.
- Runtime memories (Hermes/Hindsight/Honcho) are not project truth until written back to AGENTS.md, SKILL.md, or the wiki.
- Status: `cd ~/Documents/GitHub/kevin-wiki && npm run graphify:sidecar -- status --run outputs/graphify/glyphfield`
- Build from this repo: `PROJECT_ROOT="$(pwd)" && cd ~/Documents/GitHub/kevin-wiki && npm run graphify:sidecar -- build "$PROJECT_ROOT" --run outputs/graphify/glyphfield --no-viz`
- Query after build: `cd ~/Documents/GitHub/kevin-wiki && npm run graphify:sidecar -- query "what should I inspect first?" --run outputs/graphify/glyphfield`
- Never run Graphify installers/hooks or commit generated `graphify-out/` artifacts.
<!-- agent-docs:auto:repo-graph end -->

## Environment variables (names only)
<!-- agent-docs:auto:env start -->
- (none detected)
<!-- agent-docs:auto:env end -->

## Conventions & invariants

- Public Studio identity comes from `STUDIO_TOOLS`. Legacy draft IDs such as
  `logo-shader` may remain internal but must not leak from public adapters.
- Preview, source, persistence, and export must resolve from the same state.
- Read the active source before editing it, preserve unknown fields and stable IDs,
  apply through the tool validator, then re-read and visually verify.
- Design Lab source is CanvasDocument schema 2 with Design Lab metadata source 4.
  Layer order is `page.elementIds`; asset records and element IDs are portable data.
- A generated `design-sequence` is response schema 1 with a version-3 compatibility
  `document`. Apply it first, then re-read the normalized CanvasDocument before edits.
- Every editable color uses the shared color control/conversion path. Every scroll
  area uses the shared Studio scrollbar treatment.
- Every navigable tool exposes Browser API control automation. Source/export
  adapters are added where the tool supports them.
- HTTP generation rejects unknown top-level fields and remote asset URLs. Update
  GET contract, manifest, OpenAPI, examples, and tests with any schema change.
- Motion exports run serially. GIF seamless mode must be visually closed; GIF has
  no audio; MP4 capability failures are reported rather than silently substituted.
- User-facing docs use current product names: Design Lab is public ID `material`;
  Surface/Material/Logo Shader names may appear only as explicit legacy scopes.

## Gotchas / never-do-X

- Never rebuild a CanvasDocument from a stale example when `readSource()` exists.
- Never mutate localStorage, IndexedDB, or React internals to automate Studio.
- Never pass a filesystem path to a browser file input; construct an authorized
  `File` from bytes.
- Never hard-code shader or tool counts; use `/api/materials` and `/api/labs`.
- Never claim an export succeeded from an HTTP status or resolved Promise alone.
  Verify body/Blob, MIME/extension, dimensions, and motion frames where relevant.
- Never add a one-off editor control when a shared Studio component already owns
  that behavior.
- Preserve unrelated dirty work. This repository is often edited interactively.

## Extending this project's agent system

When a UI capability changes, update the complete parity chain in the same change:

1. Public tool/catalog metadata (`studioCatalog.ts`, `agentCatalog.ts`).
2. Source serializer/validator and migrations.
3. Browser API adapter actions and accessible labels.
4. HTTP generation contract if deterministic generation applies.
5. `/api/agent`, `/openapi.json`, `/llms.txt`, and relevant `content/docs` pages.
6. Focused contract, serialization, persistence, and export tests.
7. `pnpm docs:generate`, `pnpm typecheck`, targeted tests, and visual verification.

Run `pnpm agent-docs -- scaffold .` after adding significant directories, fill any
new `SKILL.md`, then run `pnpm agent-docs -- doctor . --json`.
