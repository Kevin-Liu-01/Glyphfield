# HTTP generation reference

Examples assume `BASE_URL` is the authorized Glyphfield origin.

## Inspect the contract

```sh
curl -fsS "$BASE_URL/api/agent" | jq '{version, schemaVersion, resources, interfaces}'
curl -fsS "$BASE_URL/api/labs" | jq '.plugins[] | {id, name, capabilities}'
curl -fsS "$BASE_URL/api/materials" | jq '{count, defaults, sharedBy}'
curl -fsS "$BASE_URL/api/generate" | jq '{schemaVersion, kinds}'
```

## Raw template SVG

```sh
curl -fsS -X POST "$BASE_URL/api/generate" \
  -H 'Content-Type: application/json' \
  -d '{
    "kind": "template",
    "template": "slides",
    "slideLayout": "statement",
    "texture": "dark",
    "title": "One system. Every surface.",
    "identity": { "preset": "gt" },
    "output": "raw"
  }' \
  -o one-system.svg
```

Verify the response is `image/svg+xml` before trusting the `.svg` extension.

## Tactile background

```json
{
  "kind": "background",
  "identity": { "preset": "gt" },
  "output": "json",
  "settings": {
    "width": 1200,
    "height": 630,
    "style": "grain-gradient",
    "pattern": "fibers",
    "surfaceMaterial": "embossed-paper",
    "surfaceDepth": 48,
    "surfaceRoughness": 72
  }
}
```

Read the current surface and control enums from the GET contract rather than copying this example unchanged.

## Element brief

Choose a real `elementId` from `/api/elements`, then send:

```json
{
  "kind": "element-brief",
  "elementId": "the-discovered-id",
  "identity": { "preset": "gt" }
}
```

## Design sequence bridge

```json
{
  "kind": "design-sequence",
  "identity": { "preset": "gt" },
  "ratio": "wide",
  "shader": {
    "materialId": "paper-gem-smoke",
    "shaderSize": 0.8,
    "opacity": 1
  },
  "effect": {
    "kind": "bayer",
    "opacity": 0.72,
    "foreground": "#F5F5F2",
    "background": "#111216"
  },
  "texts": [{ "value": "Open source", "weight": 500 }],
  "sequence": { "cutCount": 8, "finalHoldMs": 3000, "pace": "accelerating" },
  "export": { "width": 1920, "fps": 30, "quality": "best", "gifLoop": "seamless" }
}
```

The response envelope has `schemaVersion: 1`; its `document` is version-3 compatibility input. In the live Studio:

```js
await window.glyphfield.studio.applySource(response.document);
const normalized = JSON.parse(window.glyphfield.studio.readSource());
```

The normalized result is CanvasDocument schema 2 with Design Lab source 4. Use that result for targeted edits, then invoke `design.export`.

## Error handling

Parse the response body before retrying. Correct invalid `field`, `code`, or enum values from current discovery. For `429`, stop concurrent work and wait for the advertised window. Preserve source when the browser renderer or codec is unavailable rather than substituting an unrequested format.
