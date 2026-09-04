---
name: src-app-skill
description: Next routes, documentation shell, machine endpoints, and global styles.
---

# glyphfield / src/app

## Purpose

Own the Next.js route surface: Studio/docs pages, API handlers, metadata/OG,
machine-readable resources, and global visual foundations.

## Mental model & key files

- `studio/page.tsx` mounts the interactive client Studio.
- `docs/**` renders the Fumadocs shell; content comes from `content/docs` through
  `src/lib/docsSource.ts` and `src/components/DocsMdx.tsx`.
- `api/agent`, `api/catalog`, `api/labs`, `api/materials`, `api/identities`,
  `api/elements`, and `api/generate` expose public agent contracts.
- `api/docs/[[...slug]]` returns one processed Markdown page.
- `llms-full.txt/route.ts` concatenates the same processed docs corpus.
- `openapi.json` returns `OPENAPI_DOCUMENT`; `api/search` powers docs search.
- `globals.css` and `docs/docs.css` own shared chrome and documentation visuals.

## Patterns to follow / invariants

- Route handlers are thin. Validation and domain behavior live in `src/lib`.
- Discovery responses are cacheable briefly; generation is `no-store`.
- Agent routes use the shared CORS headers and return structured errors.
- Docs Markdown routes and `/llms-full.txt` must derive from `docsSource`, not from
  a separately maintained copy.
- Add accessible titles/descriptions and keep docs navigation metadata in sync.

## Common tasks → first action

- Add an endpoint → define the contract/domain behavior in `src/lib`, add a thin
  route, update manifest/OpenAPI/docs, then test the contract.
- Add a docs page → create MDX, add it to the section `meta.json`, use shared media
  components, run `pnpm docs:generate`.
- Change docs layout → inspect desktop/mobile behavior and the custom 1px scrollbar.
- Add machine docs → extend `docsSource`-backed routes instead of copying prose.

## Gotchas

Do not import browser-only components into route handlers. Do not add undocumented
agent endpoints. Do not make `/llms.txt` and human docs disagree; the former is a
router and `/llms-full.txt` is the complete derived corpus. Preserve explicit
content types and `X-Content-Type-Options` on text/Markdown responses.
