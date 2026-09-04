---
name: src-lib-skill
description: Product models, serializers, render/export helpers, and agent contracts.
---

# glyphfield / src/lib

## Purpose

Own framework-independent product truth: identity models, catalogs, scene graphs,
serialization/validation, shaders, deterministic SVG, export encoders, persistence,
and agent contracts.

## Mental model & key files

- `studioCatalog.ts` is the public navigable tool catalog.
- `canvasDocument.ts` is the portable scene graph and mutation/history model.
- `designLabDocument.ts` adapts Design Lab state to CanvasDocument.
- `shaderLab.ts` and `liveMaterials.ts` define the shared material library.
- `download.ts`, `canvasExport.ts`, GIF/video/audio helpers own artifact creation.
- `savedDesigns.ts` owns IndexedDB snapshots and recovery journal behavior.
- `agentApi.ts`, `agentCatalog.ts`, `agentGeneration.ts` define all public agent
  discovery, schemas, validation, examples, and automation commands.
- `studioAutomation.ts` defines the typed browser-global contract.

## Patterns to follow / invariants

- Derive catalogs from canonical arrays; do not duplicate counts or IDs.
- Parse untrusted source with explicit readers, finite-number checks, enum guards,
  size limits, and clear field errors.
- Keep library modules free of React/DOM unless the module explicitly implements a
  browser renderer/export boundary.
- Clone immutable document state across history/version restoration.
- Keep MIME type, extension, and filename aligned.
- Retain upstream source attribution/license on material records.
- Any agent schema change updates manifest, OpenAPI, examples, docs, and tests.

## Common tasks → first action

- Change CanvasDocument → inspect parser, serializer, migration, mutation, history,
  preflight, Design Lab adapter, and autosave tests.
- Add a shader → add one canonical catalog record and authentic adapter/fallback;
  verify search/order/material endpoint and both host tools.
- Change generation → update GET contract first, validate POST strictly, then update
  examples and automation bridge.
- Change export → add low-level tests for dimensions, frame timing, protected colors,
  MIME, file name, and cleanup.
- Change persistence → test IndexedDB success, stale writes, malformed data,
  localStorage fallback/recovery, and migration.

## Gotchas

Canvas schema version and Design Lab source version are distinct. GIF loop metadata
does not guarantee a visually seamless loop. A generated `design-sequence` document
is version-3 compatibility input: apply it, then re-read the normalized CanvasDocument
schema 2 / Design Lab source 4 before targeted edits. Browser MP4 codecs vary. Object
URLs must be revoked only after every consumer finishes. Keep `material` public and
treat `logo-shader`/`surface` as legacy internal draft scopes unless the catalog changes.
