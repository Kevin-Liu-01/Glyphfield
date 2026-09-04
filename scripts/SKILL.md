---
name: scripts-skill
description: Repository diagnostics and the canonical agent-docs forwarding shim.
---

# glyphfield / scripts

## Purpose

Own repository diagnostics and the forwarding shim for the canonical agent-docs kit.

## Mental model & key files

- `run-agent-docs.ts` resolves the Kevin-Wiki checkout and forwards `init`,
  `scaffold`, `doctor`, and other mesh commands to its canonical implementation.
- `check-*.cjs` scripts enforce complexity/quality budgets from package scripts.
- Scripts should inspect the repo or generate declared artifacts; runtime product
  behavior belongs in `src/lib` or `src/components`.

## Patterns to follow / invariants

- Accept explicit paths and fail with actionable output.
- Keep scripts non-interactive for CI unless the command is explicitly interactive.
- Do not rewrite user source as a side effect of a diagnostic command.
- Forward to canonical tooling rather than forking its implementation here.

## Common tasks → first action

- Refresh agent docs → `pnpm agent-docs -- scaffold .`, fill placeholders, then
  `pnpm agent-docs -- doctor . --json`.
- Add a diagnostic → add one focused script and expose it in `package.json`.
- Change the canonical mesh behavior → edit Kevin-Wiki, not this forwarding shim.

## Gotchas

The Kevin-Wiki checkout location differs across machines. Respect
`KEVIN_WIKI_ROOT` and check known local locations. Do not install global hooks or
commit Graphify output from this repo.
