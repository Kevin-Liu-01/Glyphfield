---
name: glyphfield-studio
description: Operate the live Glyphfield Studio programmatically through its supported Browser API, including tool navigation, accessible controls, exact source round trips, local files, Canvas/WebGL previews, and project-local state. Use when the task depends on an open browser workspace or authentic browser rendering.
---

# Glyphfield Studio

Use the supported `window.glyphfield.studio` adapter instead of private component state or coordinate-only automation.

## Connect

1. Open the authorized Glyphfield origin at `/studio`.
2. Wait for `window.glyphfield.studio` or the `glyphfield:studio-api-ready` event.
3. Call `describe()` and `controls()` before using tool-specific actions or labels.
4. Re-read the global after changing tools; every tool installs its own adapter.

Read [references/browser-api.md](references/browser-api.md) for exact control, source, file, and action recipes.

## Choose the operation

- Use `activate(label)` for buttons and other activatable controls.
- Use `set(label, value)` for text, numeric, select, checkbox, contenteditable, and file controls.
- Use `readSource()` and `applySource()` for exact document changes when `describe().source` permits them.
- Use `invoke(action, input)` for exports, sequences, and other stable long-running actions.
- Use `download(artifact)` only after verifying a returned artifact.

Accessible labels are the automation contract. Do not invent them, and do not assume a label from another tool exists in the active adapter.

## Source protocol

Read the current source, preserve unknown fields and stable IDs, make the smallest intended change, apply through the validator, then re-read. A resolved apply is a React commit boundary; wait longer when WebGL, fonts, image decode, or encoding still has work.

Design Lab's public ID is `material`. Never expect the legacy internal draft scope `logo-shader` from integrations.

## Local data and privacy

Browser file controls require a real `File` or `File[]`, never a filesystem path string. Construct files only from bytes the user authorized. Do not write localStorage, IndexedDB, React internals, or object URLs directly to automate the product.

Before clearing data or changing origin/profile, follow `/docs/artifacts/backup-and-restore`. For graphics, storage, codec, or adapter failures, preserve source and use `/docs/reference/browser-support` plus `/docs/reference/troubleshooting` before retrying.

## Completion

After mutation, verify source or control state and inspect the visible result. After export, verify the Blob, filename, MIME type, dimensions, and—for motion—multiple frames. Do not treat an action resolving as proof that the requested artifact is correct.
