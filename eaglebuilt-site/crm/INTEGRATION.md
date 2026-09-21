# Integrating EagleBuilt CRM with eaglebuilt.ai

The marketing / 3D designer site (Claude-built) should push new signups into this CRM when a visitor passes the **email gate** (and provides ZIP for local pricing).

## Where to POST

From the designer email-gate success handler (server-side preferred so the API key never ships to the browser):

```
POST {CRM_BASE_URL}/api/leads
```

Examples:

- Local: `http://localhost:3000/api/leads`
- Subdomain: `https://crm.eaglebuilt.ai/api/leads`
- Same host path (after merge): `https://eaglebuilt.ai/crm/api/leads`

## Headers

```
Content-Type: application/json
x-api-key: <same value as LEADS_API_KEY in CRM env>
```

## Fields to send

| Field | Required | Notes |
|-------|----------|-------|
| `email` | yes | From the email gate |
| `zip` | yes | Used for local pricing; store as entered |
| `name` | no | If collected |
| `phone` | no | If collected |
| `designSummary` | no | Free text **or** JSON (layout, appliances, finishes, etc.) |
| `source` | no | Defaults to `designer`; use another value for other funnels |

### Example (Node / Next.js Route Handler on the marketing site)

```ts
await fetch(process.env.CRM_INGEST_URL!, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CRM_LEADS_API_KEY!,
  },
  body: JSON.stringify({
    email,
    zip,
    name,
    designSummary: designState, // object OK
    source: "designer",
  }),
});
```

Keep `CRM_LEADS_API_KEY` only in **server** env on the marketing site.

## Timing

Call ingest **after** the visitor successfully submits email (+ ZIP), ideally once per signup. Deduping by email is not automatic in the MVP — optional enhancement later.

## CORS

Browser-direct POSTs from `eaglebuilt.ai` to `crm.eaglebuilt.ai` need CORS or a same-origin proxy. Prefer a small API route on the marketing site that forwards to the CRM (hides the key and avoids CORS).

## After merge

If CRM is mounted under `/crm`, update `NEXTAUTH_URL` and ingest URLs accordingly; Next.js `basePath: '/crm'` may be required in `next.config.mjs`.
