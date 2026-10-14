# Identity fields for a setup patch

`GET /api/brand/validate` returns the complete JSON Schema (`schema`) and the merge-patch schema (`patchSchema`). This page lists what a setup patch should contain.

## Essentials

| Field | Notes |
| --- | --- |
| `name` | Exactly as the brand writes it. |
| `shortName` | The short form the brand uses, up to 8 characters: its abbreviation (`GT`, `BSMNT`) or, for a one-word brand, the name (`Stripe`). Never a single letter. |
| `tagline` | The line the brand already uses. Never invent one. |
| `positioning`, `mission`, `description` | One or two sentences each, from the brand's own copy. |
| `website`, `contactEmail`, `socialHandle` | Handle starts with `@`. |
| `audiences`, `products`, `values` | String lists. |
| `productDetails` | `[{ name, summary }]`: one plain line per product, from its own product page. Replaced as a whole. |
| `proof` | Published, verifiable statements such as metrics. No customer names. |
| `customers` | Customer or client names the brand shows publicly. |
| `sourceNotes` | One line per source you used. |

## Template samples

`samples` fills templates with real content instead of placeholders. Every field is optional.

```json
{
  "samples": {
    "person": { "name": "Elena Novak", "role": "Payments engineer" },
    "event": { "name": "Stripe Sessions", "date": "Tue 5 May", "time": "09:00 PT", "location": "San Francisco" },
    "install": "npm install stripe",
    "code": { "label": "POST /v1/payment_intents", "snippet": "curl https://api.stripe.com/v1/payment_intents …" },
    "actions": ["Create a payment link", "Refund a payment"],
    "metric": { "label": "Gross volume", "value": "$248,310.42", "change": "+12.4% from last month" },
    "plans": [{ "name": "Standard", "price": "2.9% + 30¢", "features": ["No setup or monthly fees"] }],
    "release": { "title": "Accept and optimize payments globally", "items": ["Online and in person"] }
  }
}
```

The person is a sample, never a real employee. Plans, install commands and code come from the brand's own pricing and docs; leave them out rather than invent them.

## Strategy and voice

- `strategy`: `challenge`, `concept` (central idea), `promise`, `outcome`, `pillars` (3–5), `personality` (3–4 traits).
- `voice`: `principles`, `phrases`, `avoid`, and `examples: [{ context, write, avoid }]` with at least three real contexts (homepage hero, error message, release note, onboarding email).
- `tagline`, `strategy.promise` and each of `voice.phrases` are different lines; the audit flags repeats.

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

### Colour system

`colorSystem` maps semantic roles to colors for light and dark mode. Values are color refs: a `colors[].id` (`"ink"`) or one of its OKLCH scale steps (`"ink.700"`, steps 50–950). Omitted roles are derived from the palette, so set only what the brand's own light and dark themes decide.

```json
{
  "colorSystem": {
    "light": { "background": "paper", "foreground": "ink", "primary": "emphasis", "primary-foreground": "ink", "border": "muted" },
    "dark": { "background": "ink", "surface": "ink.900", "foreground": "paper", "foreground-muted": "paper.300", "primary": "emphasis" },
    "scales": [{ "id": "emphasis", "lightest": 0.97, "darkest": 0.25 }]
  }
}
```

Roles: `background`, `surface`, `surface-muted`, `foreground`, `foreground-muted`, `border`, `primary`, `primary-foreground`, `focus`, `positive`, `caution`, `negative`. Text roles must reach 4.5:1 on their surfaces and lines and status roles 3:1, in both modes. Add `scales` only to match a published tint ramp (`lightest`, `darkest`, `chroma`, `hueShift`, `anchor`). The brand kit exports these as `--brand-<role>` with dark values for `prefers-color-scheme`, `data-theme="dark"` and `.dark`.

## Typography

```json
{
  "typography": [
    { "role": "Display", "family": "Acme Grotesk", "weight": 600, "lineHeight": 0.95, "letterSpacing": -1.5, "usage": "Headlines" },
    { "role": "Body", "family": "Acme Grotesk", "weight": 400, "lineHeight": 1.5, "letterSpacing": 0, "usage": "Reading and UI" },
    { "role": "Accent", "family": "Acme Serif", "weight": 400, "lineHeight": 1.2, "letterSpacing": 0, "usage": "Quotes" },
    { "role": "Code", "family": "Acme Mono", "weight": 400, "lineHeight": 1.45, "letterSpacing": 0, "usage": "Code and metadata" }
  ],
  "typeScale": { "basePx": 16, "ratio": 1.25, "roleSteps": { "Display": "display", "Body": "body", "Accent": "lead", "Code": "small" } }
}
```

`typeScale` sizes are `basePx × ratio^step`; use a ratio of at least 1.25 for display work. `roleSteps` names the step each role is set at (`caption`, `small`, `body`, `lead`, `h4`, `h3`, `h2`, `h1`, `display`); omitted roles use the defaults shown.

`letterSpacing` is in px at the size the role is set, and the kit exports it as em. Track by size: Display slightly negative, about -0.01 to -0.025 of its px size (-1.5px at a 61px display step is -0.025em); Body, Accent and Code 0; never positive tracking on lowercase. Kerning stays on everywhere (`font-kerning: normal`, the `kern` feature) and optical sizing stays automatic. Set `opticalSize` only when the font has an `opsz` axis and the brand fixes one, and `slant` (degrees) only for a published oblique.

Bind roles to stored files with `identity.font.add { file, roles }`; it sets `fontId` and `family` for you. The Code role must be a monospace face (look for `--font-mono` in the site CSS). Font records no role uses are template leftovers: remove them with `identity.fix { fixId: 'prune-fonts' }`.

## Logos

Slots: `mark-dark` (dark mark for light surfaces), `mark-light` (light mark for dark surfaces), `wordmark`, `wordmark-light`, `mark-mono` (one color). Prefer SVG. Each `identity.asset.add` with a slot replaces the slot in place.

## Graphic system and imagery

- `graphicSystem`: `device` (one recognizable move), `description`, `composition`, `imageDirection`, `pattern` (`none`, `blocks`, `brackets`, `burst`, `circuit`, `flow`, `grid`, `orbit`, `rays`, `steps`, `wave`), `rules` (3–6).
- `applications`: `{ id, name, category, format, description }` for the places the brand appears.
