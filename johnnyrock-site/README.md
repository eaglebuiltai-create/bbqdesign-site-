# Johnny Rock

A static folder. The BBQ island designer is the site: `site/index.html`, plus `site/assets/emailcheck.js` for the email typo check. Refine it locally. Domain cutover can wait.

## Open it

From `johnnyrock-site/site`:

```
python3 -m http.server 8766
```

Then open http://127.0.0.1:8766/

Or open `site/index.html` directly in a browser. The email check is a relative path, so that works too.

`/api/leads` only answers once this folder is deployed behind the small worker in `src/worker.js`. Locally that post fails quietly and the designer still opens. Web3Forms is called from the page.

## Rebadge

The `SITE` block at the top of `site/index.html` is the brand, the logo text, the canonical domain, the CRM source strings, the Web3Forms key, and the `/api/leads` path. johnnyrock.biz is those defaults.

A builder or a BBQ store that rents or buys the designer later gets a copy of this file with that block changed. There is no second app, and no accounts, billing, or theme admin.
