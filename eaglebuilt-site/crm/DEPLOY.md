# Deploying the CRM beside eaglebuilt.ai

What is already done, what is left, and the one thing that cannot work the way
the archive's `INTEGRATION.md` assumes.

---

## The constraint worth knowing first

`INTEGRATION.md` lists three ways to mount this:

| Option it suggests | Works here? |
|---|---|
| `http://localhost:3000/api/leads` | yes, for testing |
| `https://crm.eaglebuilt.ai/api/leads` | **yes — use this** |
| `https://eaglebuilt.ai/crm/api/leads` (after merge) | **no** |

The third is off the table. eaglebuilt.ai is static files served by a Cloudflare
Worker (`fragrant-butterfly-5c92`). This CRM is a Next.js server. A Worker has no
Node runtime, so there is no server for Next.js to run. Setting
`basePath: '/crm'` would not change that — it is not a routing problem.

So "beside" means a **separate Node host on a subdomain**, with eaglebuilt.ai
left exactly as it is. The code lives in this repo at `crm/` for convenience;
`wrangler.toml` ships only `./site`, so nothing in here is uploaded to the
Worker or served to the public.

The alternative — porting persistence to Cloudflare D1 and deploying via
`@cloudflare/next-on-pages` — is a real option, but it is a rewrite of the data
layer plus NextAuth's session store, not a config change. Not worth it unless
you want everything on one Cloudflare bill.

---

## Already wired (this repo)

- `crm/` — the app, merged in as supplied, with four changes:
  - **ZIP made optional on ingest.** The gate labels it optional, so requiring
    it would have 400'd and silently dropped every visitor who skipped it. Now
    stores as `""`.
  - **SQLite → Postgres**, per the Vercel decision above.
  - **Lead search forced case-insensitive** (`mode: "insensitive"` in
    `lib/leads.ts` and the leads route). Postgres `LIKE` is case-sensitive
    where SQLite's was not, so searching `sarah` would silently have stopped
    matching `Sarah Chen` after the move. Found by porting, not by testing —
    worth re-checking if more queries are added.
  - **Indexing blocked** — `src/app/robots.ts` plus `noindex` in the root
    layout. See "Keep it out of Google" below.
- `src/worker.js` — new `/api/leads` route that forwards into this CRM.
- All four designer gates — now POST to `/api/leads` alongside Web3Forms.

**Why the proxy exists.** `INTEGRATION.md` says to send the key server-side so
it never ships to the browser, and its CORS section recommends a proxy on the
marketing site. That is exactly right, and it is not optional here: the email
gate is client-side JavaScript inside a static HTML file. A key placed there is
readable by every visitor, in page source, forever. The key lives in the Worker
as a secret instead; the gate posts same-origin to `/api/leads` and never sees
it. Same-origin also means no CORS to configure.

Web3Forms is untouched and still the path that delivers leads to `info@`. The
CRM post is additive and fire-and-forget — a CRM outage cannot stop anyone
opening the designer.

---

## Target: Vercel + Neon Postgres

Chosen 2026-09-21. The code is already converted — `prisma/schema.prisma` is on
the `postgresql` provider with a `directUrl`, the init migration is Postgres
SQL, and `npm run build` runs `prisma migrate deploy` so a push migrates the
database itself.

**Why not SQLite.** Vercel's filesystem is ephemeral. A SQLite file there is
wiped on every redeploy, taking the leads with it. This is the one change that
was not optional once Vercel was the host.

Two Neon connection strings are needed, and they are not interchangeable. The
names below are what `neon link` writes, so do not rename them:

| Env var | Which Neon string | Used by |
|---|---|---|
| `DATABASE_URL` | **pooled** — host contains `-pooler` | the app at runtime |
| `DATABASE_URL_UNPOOLED` | **direct** — no `-pooler` | migrations only |

Vercel is serverless: each request can be a fresh instance, so without the
pooler Neon runs out of connections. Migrations cannot run through a pooler,
hence the second one.

New accounts should use `eaglebuiltai@gmail.com`.

---

## Left to do, in order

### 1. Create the Neon database — ✅ done 2026-09-21

Project `dry-heart-88431848` ("EagleBuilt AI" org), branch `production`, linked
via `neon link`. `crm/.env` holds the real connection strings alongside the
`NEXTAUTH_SECRET`, `LEADS_API_KEY` and seed password. The migration is applied
and the owner account `info@eaglebuilt.ai` exists (renamed from the archive's
`john@eaglebuilt.ai` default on 2026-09-21 — that address was never real). The three sample leads that
`db:seed` inserts were deleted — a live database should not ship with fixtures.

`neon.ts` declares `auth: true`, which matched what was already provisioned, so
`neon deploy` reported no changes. The CRM uses NextAuth, not Neon Auth, so the
`NEON_AUTH_*` variables in `.env` are unused and harmless.

Bring local dev up with:

```bash
cd "C:\Users\johns\Eaglebuilt AI. Claude\eaglebuilt-site\crm" && npm run dev
```

A second branch, `dev` (`br-purple-mouse-ar6vbxb7`), was created 2026-09-21 and
`crm/.env` is linked to it. Local work never touches live leads — verified by
writing to `dev` and confirming the row did not appear in `production`.

Switch branches with `neon link --branch <name>`, which rewrites the two URLs
in `.env` and leaves your other keys alone. Check which one you are on:

```bash
grep NEON_BRANCH ./crm/.env
```

### 2. Deploy to Vercel — ✅ done 2026-09-21

Import the repo and set **Root Directory** to `eaglebuilt-site/crm`.

⚠️ **Do not copy the database URLs out of `crm/.env`** — it is linked to the
`dev` branch, and Vercel must use `production`. Get those two separately:

```bash
neon connection-string production --project-id dry-heart-88431848 --pooled
```

```bash
neon connection-string production --project-id dry-heart-88431848
```

The first (with `-pooler` in the host) is `DATABASE_URL`; the second is
`DATABASE_URL_UNPOOLED`. The remaining values do come from `crm/.env`:

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | `neon connection-string production --pooled` |
| `DATABASE_URL_UNPOOLED` | `neon connection-string production` |
| `NEXTAUTH_URL` | `https://crm.eaglebuilt.ai` — **not** the localhost value in `.env` |
| `NEXTAUTH_SECRET` | `crm/.env` |
| `LEADS_API_KEY` | `crm/.env` — needed again in step 4, must match exactly |

The build runs `prisma migrate deploy`, so the schema is applied on every
deploy. The tables and the owner account already exist on the `production`
branch from step 1, so nothing needs seeding again — and **do not re-run
`npm run db:seed` against production** once real leads are in it.

#### Keep it out of Google

A subdomain is publicly reachable even with nothing linking to it, and Google
discovers subdomains through certificate transparency logs — every TLS cert
issued for `crm.eaglebuilt.ai` is published to a public, crawlable log. So
"nobody knows the URL" is not a defence, and a login page for a contractor's
lead database has no business in search results.

`src/app/robots.ts` handles this (added 2026-09-21): it serves
`Disallow: /` for every crawler at `/robots.txt`, and `src/app/layout.tsx`
sets `robots: { index: false, follow: false, nocache: true }` so every page
carries a `noindex` meta tag too. Belt and braces, because `robots.txt` asks a crawler not
to *crawl* while `noindex` tells it not to *list* — a URL discovered elsewhere
can still be listed on the strength of a `robots.txt` block alone.

Nothing to configure at deploy time; just do not remove either file. Confirm
after going live:

```bash
curl -s https://crm.eaglebuilt.ai/robots.txt
```

#### Turn on Vercel deployment protection

Every push gets its own permanent preview URL, and by default those are public.
Preview builds run against the **same Neon database** as production, so an open
preview URL is an open door to real leads — the custom domain being locked down
does nothing for it.

Vercel dashboard → the project → **Settings** in the sidebar → **Deployment
Protection**. Set the method to **Vercel Authentication** and the scope to
**Standard Protection**. (A team-level default also exists in team settings and
applies to new projects; a project can override it.)

**Do not choose "All Deployments" here.** It protects production domains too, and
Vercel's protection "requires authentication for all requests" — including the
Worker's server-to-server POST to `/api/leads`, which carries no Vercel session.
Every lead would be bounced at the edge before reaching the CRM. Standard
Protection covers the actual risk (preview URLs on live data) and leaves
`crm.eaglebuilt.ai` reachable, with NextAuth still guarding the UI.

Side effect: Standard Protection also restricts the generated production URL
(`<project>.vercel.app`). Harmless here — the custom domain is what gets used,
and nothing in the code reads `VERCEL_URL`.

If you ever do want All Deployments, the Worker would need **Protection Bypass
for Automation** — a secret header on every ingest call. More moving parts for
no gain.

Preview builds still run against whatever `DATABASE_URL` you set in Vercel. If
you want them off live data too, give the Preview environment the `dev` branch
strings in Vercel's per-environment env var settings.

### 3. Point `crm.eaglebuilt.ai` at it — ✅ done 2026-09-21

The domain is attached to the Vercel project and ownership is verified. What
remains is one DNS record in Cloudflare:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Name | `crm` |
| Target | `cd30f4fab0e04f93.vercel-dns-017.com.` |
| Proxy | **DNS only** — grey cloud |

**The proxy setting is not optional.** Vercel returns `disableProxy: true` for
this record. Leaving Cloudflare's orange cloud on stops Vercel issuing the TLS
certificate, and the domain never comes up.

`NEXTAUTH_URL` is already set to `https://crm.eaglebuilt.ai`, so login redirects
will work as soon as DNS resolves — and would break if the domain changed.

### 4. Give the Worker the two secrets — ✅ done 2026-09-21

From `eaglebuilt-site/`:

```bash
npx wrangler secret put CRM_INGEST_URL
```

```bash
npx wrangler secret put CRM_LEADS_API_KEY
```

`CRM_INGEST_URL` is `https://crm.eaglebuilt.ai/api/leads`. `CRM_LEADS_API_KEY`
must match `LEADS_API_KEY` in the CRM's env exactly. Paste them at the prompt
rather than piping — piping from PowerShell appends a newline, which has cost an
hour before on the Resend key. (The Worker trims defensively now, but do not
rely on it.)

### 5. Deploy the site

The site and the `/api/leads` route were deployed 2026-09-21 and are live now —
inert until step 4 sets the secrets. Redeploy after any change under `site/`:

```bash
npx wrangler deploy
```

All four tool gates, the `/design/` landing gate and the kitchen designer's
Quick Build and quote paths are deployed and posting to `/api/leads`.

### 6. Verify on the live site — ✅ done 2026-09-21

A POST to `https://eaglebuilt.ai/api/leads` with no key — exactly what the
browser sends — returned `{"ok":true}` and the row appeared in the production
database. Test rows were deleted afterwards.

Open the designer in a private window, pass the email gate, and confirm the lead
appears in the CRM inbox within a second or two. If it does not, open devtools →
Network → the `/api/leads` call. It always returns HTTP 200; the JSON body says
what actually happened:

| Body | Meaning |
|---|---|
| `{"ok":true}` | the CRM accepted it |
| `not configured` | step 4 was skipped |
| `crm unreachable` | DNS, host down, or >8s |
| `crm rejected` + `status: 401` | the two keys do not match |
| `crm rejected` + `status: 400` | a field the schema refuses |

---

## Still open

**The tracker is retired** (2026-09-22). The $14k first designer-built job was
moved into the CRM as a `done` lead carrying the linear feet, the $9,787 tool
quote against the $14,000 close, and the package breakdown, plus notes for the
outstanding review request and the import itself. It was then deleted from
[EagleBuilt Leads](https://claude.ai/artifact/AKFnYQKfLQLN44RWe2f2bx), which now
holds only its three sample rows. The CRM is the single source of truth.

The imported lead has **no email, phone, city or design link** — those were
blank in the tracker too. Worth filling in if that customer is ever contacted
again, since the CRM keys leads on email.

**Coverage is uneven across the four tools.** The kitchen designer sends three
kinds of event — gate signup, Quick Build save (`quick_build`) and the finished
quote (`designer_quote`, carrying estimate, timeline, notes and spec). The fire
pit, fireplace and backyard tools still send only the gate signup. Worth
levelling up if those tools start producing leads.
