---
name: src-hooks-skill
description: Persistent, portable, and performance-sensitive React state lifecycles.
---

# glyphfield / src/hooks

## Purpose

Own reusable React state lifecycles for local persistence, portable canvases,
autosave, responsive behavior, and performance-sensitive subscriptions.

## Mental model & key files

- `usePersistentState.ts` and Studio draft hooks provide origin-local state.
- `usePortableCanvas.ts` serializes and hydrates CanvasDocument state.
- `useCanvasDocumentAutosave.ts` persists exact source snapshots.
- `usePortableCanvasWorkspace.ts` composes portability and autosave for editors.
- Tests use fake IndexedDB/localStorage and React harnesses to check timing.

## Patterns to follow / invariants

- Initialize safely during SSR and read browser storage only in the client.
- Scope keys by project, tool, and field; migrations must preserve old projects.
- Debounce/coalesce persistence outside high-frequency pointer updates.
- Autosave only a fully prepared current document, never a stale render snapshot.
- Clean up observers, animation frames, media listeners, and object URLs.
- Return stable callbacks/objects where downstream render cost is significant.

## Common tasks → first action

- Add persisted state → define a versioned key and migration/fallback behavior.
- Add CanvasDocument support → use `usePortableCanvasWorkspace`, then test exact
  source persistence, hydration, and changes that occur while serialization settles.
- Fix jank → profile update frequency and move storage/serialization off the pointer
  hot path before memoizing blindly.

## Gotchas

localStorage is synchronous and can jank drag/slider updates. IndexedDB callbacks can
arrive after newer edits; guard revision/source freshness. Strict Mode can run setup
twice. Storage may be unavailable, full, or malformed—degrade without erasing a
newer valid record.
