# Johnny Rock

The BBQ island designer, and the whole site, at **https://johnnyrock.biz/**.

`site/index.html` is the product — one file, same idea as the fireplace and fire pit tools. `site/assets/emailcheck.js` is the email typo check those tools already use. There is no second page.

The `SITE` block at the top of `site/index.html` is the brand, the canonical domain, the Web3Forms key, and the `/api/leads` path. johnnyrock.biz is those defaults. A later white-label is a copy of the file with that block changed — not a second app.

## Deploy

Host: **johnnyrock.biz**. From this folder:

```
npx wrangler deploy
```

The Worker is named `johnnyrock`. Do not deploy it as `fragrant-butterfly-5c92` — that name is eaglebuilt.ai.

Then attach **johnnyrock.biz** and **www.johnnyrock.biz** to this Worker.

The page is static. `src/worker.js` only proxies `POST /api/leads` so the CRM key stays off the page, the same light proxy EagleBuilt uses. Web3Forms is called from the page with the existing access key and does not go through the Worker.

```
npx wrangler secret put CRM_INGEST_URL
npx wrangler secret put CRM_LEADS_API_KEY
```

`CRM_INGEST_URL` is the CRM ingest route, for example `https://crm.eaglebuilt.ai/api/leads`. Until both secrets are set, `/api/leads` answers `{ "ok": false, "error": "not configured" }` and the designer still opens.
