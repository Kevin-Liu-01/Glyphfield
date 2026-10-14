---
name: glyphfield-brand
description: Set up or improve a brand identity in Glyphfield end to end from the brand's own website, repository or design files — research, brief, validate, apply, add logo and font files, run the brand health audit, fix findings, save, and export the brand kit (brand.md, DTCG tokens, CSS variables, Tailwind v4 theme, logos). Use when a user asks an agent to set up, import, complete, audit or export their brand in Glyphfield.
---

# Glyphfield brand setup

The Brand identity tool is the source of truth every other Glyphfield tool reads. This skill fills it with real, sourced facts through the tool's Browser API and proves the result with the health audit.

## Rules

- Use only sources the user authorized: their website, this repository, design files or folders they point to. Record each source in `sourceNotes`.
- Never invent customers, metrics, claims, slogans or license terms. Leave a field out instead.
- Never write localStorage, IndexedDB or React state. Every change goes through `window.glyphfield.studio.invoke(...)`.
- Files enter as `File` objects built from bytes you read. Never pass a filesystem path or a remote URL; remote asset paths are rejected.
- Do not run browser exports concurrently.
- Typesetting: Display `letterSpacing` slightly negative (about -0.01 to -0.025 of its size), Body and Code 0, never positive tracking on lowercase; kerning stays on. Glyphfield's outputs never set eyebrow labels above a headline, so do not write taglines or categories meant to sit above one.

## Workflow

1. **Research.** Homepage, about page, README and docs; CSS custom properties, Tailwind config or token files; font files and licenses; logo files (mark and wordmark for light and dark surfaces, one-color mark); any brand guide.
2. **Brief.** Draft the patch described in [references/identity-fields.md](references/identity-fields.md): essentials, strategy, voice with at least three `voice.examples`, a tagline, promise and phrases that are different lines, semantic colors (`ink`, `paper`, `muted`, `emphasis`) with `proportion` and `colorPairings`, a `colorSystem` with the light and dark semantic roles, typography roles (a monospace Code face) with size-tuned `letterSpacing` and `typeScale` with `roleSteps`, graphic device, image direction, products with one-line `productDetails`, proof statements, `customers` kept apart from proof, template `samples` (person, event, install, code, actions, plans) and applications.
3. **Connect.** Open `<origin>/studio?tool=identity&project=<id>`. Wait for `window.glyphfield.studio`, call `describe()`, confirm `activeTool()` is `identity`. For a new brand with no project yet, open `<origin>/studio?tool=identity` and call `invoke('identity.project.create', { from: 'starter', name })` (`from: 'scratch'` starts empty; a project id duplicates it). It returns `{ id, url }` and opens the new project; read `window.glyphfield.studio` again before the next call. For an existing brand run `identity.read` and `identity.audit` first and keep what is correct.
4. **Validate.** `invoke('identity.validate', { identity: patch })`. Fix every error; messages name the exact path and the expected value. `GET /api/brand/validate` returns the JSON Schema.
5. **Apply.** `invoke('identity.apply', { identity: patch })`. Objects merge by key, id-keyed records merge by id (typography by role), string lists are replaced, unknown fields are kept. When the project started from a template, add `replace: ['colors', 'colorPairings', 'applications']` so the template's records do not linger; remove other records with `remove: { assets: ['id'] }`.
6. **Files.** `invoke('identity.asset.add', { file, slot: 'mark-dark' })` for each logo slot and `invoke('identity.font.add', { file, roles: ['Display'], license, sourceUrl })` for each font.
7. **Audit and fix.** `invoke('identity.audit')`. Apply `invoke('identity.fix', { fixId })` where a finding has `fix` (`prune-fonts` drops template fonts no role uses, `separate-customers` moves names out of proof, `distinct-phrases` drops repeated lines); otherwise follow its `agentPrompt`. Repeat until `counts.error` is 0.
8. **Save and export.** `invoke('identity.save')`, then `invoke('identity.export.kit', { format: 'zip' })`. Verify the Blob is non-empty `application/zip` and the file name ends in `-brand-kit.zip`.
9. **Report** the fields set, sources, final score, and gaps.

Exact calls, inputs and outputs: [references/browser-actions.md](references/browser-actions.md).

## Check the outputs

Open Brand elements and export a few templates to confirm the brand reads as itself: `invoke('brand-element.export.png', { elementId: 'opengraph' })` returns a 1200 × 630 PNG, and `invoke('brand-element.export.html', { elementId: 'welcome-email' })` returns a send-ready HTML email. Templates print `productDetails`, `customers`, `proof` and `samples`, so gaps there show up as thin layouts.

## Completion

The task is complete when `identity.audit` reports no errors, every text pair in `contrast` passes, `identity.save` resolved, and the exported kit was verified. State any warnings you left and why.
