# Johnny Rock

The BBQ island designer. This is the site at **https://johnnyrock.biz/** — the product is the page, not a tool nested under eaglebuilt.ai.

Leads still land in the EagleBuilt CRM. The page posts `/api/leads` (this Worker adds the ingest key) and the same Web3Forms side-channel the other designers use.

## Deploy

Host: **johnnyrock.biz**

Run from this folder:

```
npx wrangler deploy
```

`wrangler.toml` names the Worker `johnnyrock` on purpose. Do not point it at the EagleBuilt Worker (`fragrant-butterfly-5c92`); that name is eaglebuilt.ai.

After the first deploy, attach **johnnyrock.biz** and **www.johnnyrock.biz** as custom domains on this Worker.

CRM secrets, same values as the EagleBuilt worker:

```
npx wrangler secret put CRM_INGEST_URL
npx wrangler secret put CRM_LEADS_API_KEY
```

`CRM_INGEST_URL` is the CRM ingest route, for example `https://crm.eaglebuilt.ai/api/leads`. Until both secrets are set, `/api/leads` returns `{ "ok": false, "error": "not configured" }` and the designer still opens — Web3Forms is the mailbox copy and does not depend on the Worker.

## What is deployed

- `site/` — static files. `site/index.html` is the designer, served at `/`.
- `src/worker.js` — `/api/leads` only. Cloudflare serves a matching file before the script runs, so a Worker fault cannot take the page down.

There is no customer-confirmation mailer here. That endpoint belongs to the EagleBuilt kitchen designer.
