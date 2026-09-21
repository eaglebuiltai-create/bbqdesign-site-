# EagleBuilt CRM

Standalone MVP CRM for **EagleBuilt AI** (eaglebuilt.ai) — outdoor kitchen 3D designer + construction (Granite Bay / Sacramento). Captures designer signups (email + ZIP), tracks pipeline status, notes, and follow-ups.

Built to sit beside or later merge with the Claude-built marketing/designer site (e.g. `/crm` or `crm.eaglebuilt.ai`).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Prisma + **SQLite** locally (swap `DATABASE_URL` for Postgres in production)
- NextAuth credentials (single-owner login)
- Ingest API with API key for the designer site

## Quick start

```bash
cd eaglebuilt-crm
cp .env.example .env   # or use the committed local .env for demo
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Default login (change on deploy)

| Field    | Value |
|----------|-------|
| Email    | `john@eaglebuilt.ai` |
| Password | `change-me-on-deploy` |

Set via `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `SEED_USER_NAME` before seeding. Re-run `npm run db:seed` to upsert the owner password.

## Features

1. **Lead inbox** — email, ZIP, optional name/phone, design summary, source (`designer` default), timestamps
2. **Pipeline** — `new` → `contacted` → `quoted` → `sold` → `building` → `done` (+ `lost`); change status inline
3. **Notes** + **next follow-up date**
4. **Auth** — credentials session for the CRM UI
5. **Ingest API** — `POST /api/leads` with API key
6. **Dashboard** — counts by status, due today / overdue follow-ups

## Ingest API (designer → CRM)

```http
POST /api/leads
Content-Type: application/json
x-api-key: <LEADS_API_KEY>
```

Also accepts `Authorization: Bearer <LEADS_API_KEY>`.

### Payload

```json
{
  "email": "customer@example.com",
  "zip": "95746",
  "name": "Optional Name",
  "phone": "Optional phone",
  "designSummary": { "layout": "L-shaped", "appliances": ["grill"] },
  "source": "designer"
}
```

- `email` and `zip` are **required**
- `designSummary` may be a string or JSON object (stored as text/JSON string)
- `source` defaults to `designer`
- New leads start in status `new`

### curl example

```bash
curl -s -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "x-api-key: eaglebuilt-dev-api-key-change-me" \
  -d '{"email":"pat@example.com","zip":"95864","name":"Pat","designSummary":"Island with grill + fridge"}'
```

Use the same `LEADS_API_KEY` as in `.env`. See [INTEGRATION.md](./INTEGRATION.md) for wiring into eaglebuilt.ai.

Authenticated CRM sessions can also `POST /api/leads` **without** an API key (cookie session) to create leads from the UI.

## Environment variables

See `.env.example`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma DB URL (`file:./dev.db` or Postgres) |
| `NEXTAUTH_URL` | App origin (`http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Session signing secret |
| `LEADS_API_KEY` | Designer ingest key |
| `SEED_USER_*` | Owner account for seed |

## Switching to Postgres

1. Create a Postgres database (Neon, Supabase, RDS, etc.).
2. Set:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/eaglebuilt_crm?schema=public"
```

3. In `prisma/schema.prisma`, change:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

4. Run:

```bash
npx prisma migrate dev --name postgres_init
npm run db:seed
```

Status is stored as a string (`new|contacted|quoted|sold|building|done|lost`); validated in the API/UI.

## Deploy (Vercel-friendly)

1. Push the repo; import in Vercel.
2. Set env vars: `DATABASE_URL` (Postgres recommended), `NEXTAUTH_URL` (production URL), `NEXTAUTH_SECRET`, `LEADS_API_KEY`, seed vars if you run seed in CI.
3. Build command: `prisma generate && prisma migrate deploy && next build` (or keep `npm run build` and run migrate separately).
4. After first deploy, run seed once (local against prod DB, or a one-off script):

```bash
DATABASE_URL="postgresql://..." npm run db:seed
```

5. Mount path options later: reverse-proxy `/crm` to this app, or use subdomain `crm.eaglebuilt.ai`. CORS: if the designer posts from another origin, allow that origin on the ingest route or proxy through the marketing site’s own API.

**SQLite on Vercel:** not durable on serverless filesystem — use Postgres in production.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Generate client + production build |
| `npm run start` | Start production server |
| `npm run db:seed` | Upsert owner + sample leads (if empty) |
| `npx prisma migrate dev` | Create/apply migrations |

## Project layout

```
src/app/(app)/dashboard   Dashboard
src/app/(app)/leads       Inbox + detail + new
src/app/api/leads         Ingest + CRUD APIs
src/app/api/auth          NextAuth
prisma/                   Schema, migrations, seed
```

## License

Private — EagleBuilt AI.
