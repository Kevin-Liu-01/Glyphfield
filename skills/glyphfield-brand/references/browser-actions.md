# Brand identity Browser API

All actions run in the open Brand identity tool: `const studio = window.glyphfield.studio;` then `await studio.invoke(action, input)`. `studio.describe().actionContracts` is the live list.

| Action | Input | Output |
| --- | --- | --- |
| `identity.read` | none | `BrandIdentity` object (a copy) |
| `identity.validate` | `{ identity, mode?: 'patch' \| 'full' }` | `{ ok, issues: [{ code, message, path, severity }] }` |
| `identity.apply` | `{ identity, mode?: 'merge' \| 'replace', replace?: ['colors', …], remove?, save? }` | `{ identity, warnings, saved, health: { score, grade, counts } }`; throws a `TypeError` listing every issue |
| `identity.asset.add` | `{ file: File, slot?, id?, type?, label?, surface?, usage?, alt?, license?, sourceUrl?, sourceOwner?, redistribution?, tags?, save? }` | `{ asset }` |
| `identity.font.add` | `{ file: File, roles?, family?, label?, weight?, weightMin?, weightMax?, style?, license?, sourceUrl?, id?, save? }` | `{ font }` |
| `identity.audit` | none | Health report: `score`, `grade`, `counts`, `sections`, `contrast`, `findings[]` with `fix?` and `agentPrompt` |
| `identity.fix` | `{ fixId, save? }` | Health report after the fix |
| `identity.save` | none | `{ saved: true }` |
| `identity.export.kit` | `{ format?: 'zip' \| 'dtcg' \| 'css' \| 'tailwind' \| 'markdown' \| 'logos', download? }` | `{ blob, fileName, format, previewText? }` |
| `identity.setup.prompt` | `{ mode?: 'new' \| 'improve' }` | `{ mode, prompt }` |
| `identity.export.json` | none | The identity as a JSON Blob artifact |
| `identity.project.create` | `{ from?: 'starter' \| 'scratch' \| projectId, name? }` | `{ id, name, kind, from, url }`; opens the new project, so read `window.glyphfield.studio` again |

Brand elements (open `/studio?tool=brand-elements&project=<id>`):

| Action | Input | Output |
| --- | --- | --- |
| `brand-element.export.png` | `{ elementId?, scale?: 1 \| 2, download? }` | PNG Blob at the element's real pixel size (or 2×) |
| `brand-element.export.html` | `{ elementId?, assetOrigin?, download? }` | Send-ready HTML email: table layout, inlined styles, absolute image URLs |
| `brand-element.export.brief` | none | JSON brief of the selected element |

## Example

```js
// No project yet: create one from the Starter template, then re-read the API.
await window.glyphfield.studio.invoke('identity.project.create', { from: 'starter', name: 'Acme' });
const studio = window.glyphfield.studio;
const patch = { tagline: 'Fast, careful tools for small teams.', voice: { examples: [
  { context: 'Error message', write: 'That did not save. Try again.', avoid: 'Oops! Something went wrong.' },
] } };

const check = await studio.invoke('identity.validate', { identity: patch });
if (!check.ok) throw new Error(check.issues.map((issue) => issue.message).join('\n'));
await studio.invoke('identity.apply', { identity: patch });

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">…</svg>'; // bytes your agent read from the repository
await studio.invoke('identity.asset.add', { file: new File([svg], 'logo.svg', { type: 'image/svg+xml' }), slot: 'mark-dark' });

const report = await studio.invoke('identity.audit');
for (const finding of report.findings) if (finding.fix) await studio.invoke('identity.fix', { fixId: finding.fix.id });

await studio.invoke('identity.save');
const kit = await studio.invoke('identity.export.kit', { format: 'zip' });
console.assert(kit.blob.type === 'application/zip' && kit.blob.size > 0);
```

Playwright can pass bytes into the page with `page.evaluate(async ({ bytes }) => new File([new Uint8Array(bytes)], 'font.woff2'), { bytes: [...buffer] })`.

## HTTP without a browser

- `GET /api/brand/validate` — JSON Schema, patch schema, merge rules, logo slots.
- `POST /api/brand/validate` `{ identity, mode }` — `{ ok, issues, identity, health }`. Stateless; nothing is stored.
- `POST /api/brand/kit` `{ identity, format: 'dtcg' | 'css' | 'tailwind' | 'markdown' }` — one kit file.

Requests are limited to 5 MB, reject unknown top-level fields, and never fetch remote URLs.
