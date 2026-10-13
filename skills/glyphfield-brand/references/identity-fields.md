# Identity fields for a setup patch

`GET /api/brand/validate` returns the complete JSON Schema (`schema`) and the merge-patch schema (`patchSchema`). This page lists what a setup patch should contain.

## Essentials

| Field | Notes |
| --- | --- |
| `name` | Exactly as the brand writes it. |
| `shortName` | Uppercase monogram, up to 8 characters. |
| `tagline` | The line the brand already uses. Never invent one. |
| `positioning`, `mission`, `description` | One or two sentences each, from the brand's own copy. |
| `website`, `contactEmail`, `socialHandle` | Handle starts with `@`. |
| `audiences`, `products`, `proof`, `values` | String lists. Proof must be published and verifiable. |
| `sourceNotes` | One line per source you used. |

## Strategy and voice

- `strategy`: `challenge`, `concept` (central idea), `promise`, `outcome`, `pillars` (3–5), `personality` (3–4 traits).
- `voice`: `principles`, `phrases`, `avoid`, and `examples: [{ context, write, avoid }]` with at least three real contexts (homepage hero, error message, release note, onboarding email).

## Color

```json
{
  "colors": [
    { "id": "paper", "name": "Paper", "hex": "#FAFAF7", "role": "Primary background", "proportion": 60 },
    { "id": "ink", "name": "Night", "hex": "#0B0B0C", "role": "Text and marks", "proportion": 28 },
    { "id": "muted", "name": "Fog", "hex": "#ECECE6", "role": "Quiet surfaces", "proportion": 4 },
    { "id": "emphasis", "name": "Signal lime", "hex": "#C6FF3D", "role": "Primary action and focus", "proportion": 8 }
  ],
  "colorPairings": [
    { "foreground": "ink", "background": "paper", "usage": "Body text", "level": "AA" },
    { "foreground": "ink", "background": "emphasis", "usage": "Text on the accent", "level": "AA" }
  ]
}
```

Keep the ids `ink`, `paper`, `muted` and `emphasis`: Glyphfield tools read them. `success`, `warning`, `progress` and `error` are optional extensions; add other colors with token-safe ids. Proportions add up to about 100. Every pairing must pass its WCAG level (AA 4.5:1, AA-large 3:1).

## Typography

```json
{
  "typography": [
    { "role": "Display", "family": "Acme Grotesk", "weight": 600, "lineHeight": 0.95, "letterSpacing": -1.5, "usage": "Headlines" },
    { "role": "Body", "family": "Acme Grotesk", "weight": 400, "lineHeight": 1.5, "letterSpacing": 0, "usage": "Reading and UI" },
    { "role": "Accent", "family": "Acme Serif", "weight": 400, "lineHeight": 1.2, "letterSpacing": 0, "usage": "Quotes" },
    { "role": "Code", "family": "Acme Mono", "weight": 400, "lineHeight": 1.45, "letterSpacing": 0, "usage": "Code and metadata" }
  ],
  "typeScale": { "basePx": 16, "ratio": 1.25 }
}
```

Bind roles to stored files with `identity.font.add { file, roles }`; it sets `fontId` and `family` for you.

## Logos

Slots: `mark-dark` (dark mark for light surfaces), `mark-light` (light mark for dark surfaces), `wordmark`, `wordmark-light`, `mark-mono` (one color). Prefer SVG. Each `identity.asset.add` with a slot replaces the slot in place.

## Graphic system and imagery

- `graphicSystem`: `device` (one recognizable move), `description`, `composition`, `imageDirection`, `pattern` (`none`, `blocks`, `brackets`, `burst`, `circuit`, `flow`, `grid`, `orbit`, `rays`, `steps`, `wave`), `rules` (3–6).
- `applications`: `{ id, name, category, format, description }` for the places the brand appears.
