# API security controls

`POST /api/generate` is intentionally public and unauthenticated. Two separate
owners protect it:

- The route owns request shape, content size, and generator-specific bounds.
  Unknown top-level fields fail with `400 unknown_field`; invalid background
  dimensions fail with `400 invalid_dimensions` before rendering or asset reads.
- Vercel Firewall owns production request volume before serverless execution.
  The required rule matches only `POST /api/generate`, uses a fixed IP-keyed
  window of 10 requests per 60 seconds, returns `429` when exceeded, and keeps
  the client limited for one minute.

The firewall setting is project state, not repository configuration. A General
Translation Vercel project administrator must keep the rule active on project
`general-translation/glyphfield`.

## Inspect

```bash
vercel firewall overview --project glyphfield --scope general-translation --json
vercel firewall rules list --project glyphfield --scope general-translation --json
vercel firewall diff --project glyphfield --scope general-translation --json
```

## Configure

```bash
vercel firewall rules add "Rate limit Glyphfield generation" \
  --description "Pentest remediation: bound unauthenticated generation work before serverless execution." \
  --condition '{"type":"path","op":"eq","value":"/api/generate"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --action rate_limit \
  --rate-limit-algo fixed_window \
  --rate-limit-keys ip \
  --rate-limit-requests 10 \
  --rate-limit-window 60 \
  --rate-limit-action rate_limit \
  --duration 1m \
  --yes \
  --project glyphfield \
  --scope general-translation
```

Inspect `vercel firewall diff` before an administrator runs `vercel firewall
publish`. After publication, confirm that the eleventh request from one client
within 60 seconds receives `429` and that normal requests resume after the
window.
