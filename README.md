# ألو المعلم · Alo Maalem

سوق خدمات محلي يربط الزبناء بالمعلمين في المغرب: طلب خدمة، استقبال عروض بالدرهم، قبول عرض واحد داخل معاملة قاعدة بيانات، متابعة الحجز، ثم تقييم العمل بعد اكتماله. الدفع الإلكتروني غير مفعّل في هذه النسخة — الاتفاق والدفع يتمّان بين الطرفين.

Alo Maalem is a production-shaped marketplace for local services in Morocco. Customers post a request, verified professionals send offers in MAD, and accepting one offer creates exactly one booking. Arabic (RTL) is the default interface; French and English are available.

## View

Open the product view (static, no database): **[ألو المعلم — view page](https://moustaphabouzianne95-boop.github.io/alo-maalm/)**.

It shows the Arabic-first screens, the offer-accept flow, and the demo accounts. The interactive app — login, offers, bookings — still runs locally with `bash scripts/bootstrap.sh --dev`.

## Features

- Three roles with server-side checks: customer, professional, admin. Admin cannot be chosen at registration.
- Service directory, categories, and professional profiles. Phone numbers stay private unless the professional opts in.
- Requests, offers, and a strict booking state machine. Accepting an offer runs in one `SERIALIZABLE` transaction: ownership check, single booking, competing offers rejected, request advanced, notifications written.
- Reviews only after a completed booking, one review per booking, cancelled jobs excluded.
- In-app notifications, conversations, reports, favorites, and an admin console (users, moderation, categories, audit, analytics).
- Arabic-first RTL UI, French and English LTR, prices shown as MAD.
- Pluggable storage (local disk, Cloudinary, or S3) and pluggable email. Missing optional SDKs do not fail the build.
- Payments, escrow, wallets, WhatsApp/SMS, and maps are modeled only — not processed.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS, Radix primitives, Arabic-default RTL |
| API | Route handlers under `src/app/api`, Zod validation, shared error envelope |
| Data | PostgreSQL, Prisma 6, server-side pagination |
| Auth | bcrypt passwords, HTTP-only session cookie (`jose`), role guards |
| Tests | Vitest against the real business services (and the dev database for workflows) |

Node.js **20.9 or newer** is required.

## Architecture

```
src/app/                  pages: public, /dashboard, /professional, /admin
src/app/api/              HTTP API (auth, requests, offers, bookings, admin, health)
src/server/               business workflows — the only place critical writes happen
src/lib/permissions/      RBAC used by routes and by the edge proxy
src/lib/auth/             password, session, tokens
src/lib/storage/          local | cloudinary | s3
src/lib/i18n/             ar (default), fr, en
prisma/                   schema, migrations, Moroccan demo seed
tests/                    critical-path unit and workflow tests
```

UI hiding is not authorization. Every mutation checks the actor on the server. Clients never send a price into “accept offer”; the booking copies the stored offer.

Important flows:

1. **Register / login** — `ADMIN` is absent from the public schema and rejected again in `registerUser`. Login failures use one message so accounts cannot be enumerated. Suspended accounts cannot start a session.
2. **Accept offer** — `src/server/offers/service.ts`. One booking per request, competing `PENDING` offers become `REJECTED`, request moves to `OFFER_SELECTED`. A serialization conflict from a double-click is retried so the loser gets a business error, not a partial booking.
3. **Booking** — professional confirms and starts; only the customer (or an admin) can mark `COMPLETED`. Illegal jumps are rejected.
4. **Review** — customer only, booking must be `COMPLETED`, unique on `bookingId`.

## Environment

```bash
cp .env.example .env
```

Generate a real secret before any shared or production deploy:

```bash
openssl rand -base64 48
```

Put it in `AUTH_SECRET` (at least 32 characters). Never commit `.env`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Signs the session cookie |
| `AUTH_COOKIE_NAME` | Cookie name (default `alomaalem_session`) |
| `NEXT_PUBLIC_APP_URL` | Public origin, no trailing path |
| `STORAGE_PROVIDER` | `local` (default), `cloudinary`, or `s3` |
| `EMAIL_PROVIDER` | `console` (default), `smtp`, or `resend` |
| `PAYMENTS_ENABLED` | Keep `false` until a payment provider is integrated |
| `SEED_PASSWORD` | **Development only.** Password written by the seed script |
| `RATE_LIMIT_DRIVER` | `memory` or `redis` (`REDIS_URL` when using Redis) |
| `CRON_SECRET` | Protects `POST /api/cron/expire` in production |

S3 and SMTP variables are optional. The AWS SDK and `nodemailer` are loaded through a non-static import so a local-disk deploy still builds.

## Database setup

PostgreSQL 14+ is enough. From a clean checkout:

```bash
bash scripts/bootstrap.sh
```

That script creates `.env` if needed, installs dependencies, ensures the local database exists, applies migrations, and seeds when the `users` table is empty. It does not wipe data unless you pass `--reset`.

Manual equivalent:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js on `0.0.0.0:3000` |
| `npm run db:migrate` | Create a new migration in development |
| `npm run db:deploy` | Apply committed migrations (production) |
| `npm run db:seed` | Load Moroccan demo data |
| `npm run db:studio` | Prisma Studio |
| `npm test` | Critical-path Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |

Do not run `next build` or `tsc --noEmit` against the same `.next` directory while `next dev` is running.

## Demo accounts

These exist only after seeding. The password is the development value of `SEED_PASSWORD`.

| Email | Role | Lands on |
| --- | --- | --- |
| `admin@alomaalem.ma` | Admin | `/admin` |
| `customer@alomaalem.ma` | Customer | `/dashboard` |
| `professional@alomaalem.ma` | Professional | `/professional` |

**Development password: `Demo@12345`**

This is not a production credential. Change it, or skip seeding, before any public deploy. Do not reuse it for a real admin.

## Running locally

```bash
bash scripts/bootstrap.sh --dev
```

Or, if the database is already migrated and seeded:

```bash
npm run dev
```

Open `http://localhost:3000`. The default locale is Arabic (RTL). Switch language from the header.

API smoke check against a running server:

```bash
bash scripts/smoke-api.sh
```

## API

JSON envelope: `{ success, data }` or `{ success: false, error: { code, message } }`. Stack traces are never returned.

Auth and account:

- `POST /api/auth/register` `login` `logout` `forgot-password` `reset-password` `change-password` `verify-email`
- `GET /api/auth/me`
- `GET|PATCH /api/account/profile` and professional, password, preferences, verification, deactivate

Marketplace:

- `GET /api/categories` `GET /api/services` `GET /api/professionals` and their `[slug]` pages
- `GET|POST /api/requests` · `GET|PATCH /api/requests/[id]` · `POST /api/requests/[id]/cancel` · `GET|POST /api/requests/[id]/offers`
- `POST /api/offers/[id]/accept` · `POST /api/offers/[id]/withdraw`
- `GET|PATCH /api/bookings/[id]` · `POST /api/bookings/[id]/transition` · `POST /api/bookings/[id]/review`
- `GET|POST /api/reviews` · `POST /api/reviews/[id]/reply`
- `GET|POST /api/messages` · `GET|POST /api/reports` · favorites · notifications
- `POST /api/uploads` (images only: jpeg, png, webp)
- `GET /api/health` — database up/down, no secrets

Admin routes under `/api/admin/*` require an admin session: users, professionals, services, reviews, categories, reports, analytics, audit.

## Security

- Sessions are HTTP-only cookies. `AUTH_SECRET` must be unique per environment.
- Passwords are bcrypt hashes. Reset and password change revoke existing sessions.
- Role areas (`/admin`, `/professional`, `/dashboard`) are gated in the edge proxy **and** in each route.
- Ownership is checked again inside the transaction that accepts an offer or writes a review.
- Rate limits cover auth and general API traffic. Set `RATE_LIMIT_DRIVER=redis` when running more than one instance.
- Response headers include `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and a baseline CSP. `X-Powered-By` is disabled.
- Uploads are type- and size-limited. Public pages do not show private phone numbers.
- Destructive admin actions ask for confirmation in the UI and are written to `audit_logs`.
- `POST /api/cron/expire` should be called with `CRON_SECRET` in production.

## Vercel

`vercel.json` builds with `prisma generate`, `prisma migrate deploy`, and `next build`, in the Paris region (`cdg1`). A daily cron calls `GET /api/cron/expire`.

Set these in the Vercel project (Production), then deploy. Do not commit them.

| Variable | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | Pooled Postgres URL (Neon or Vercel Postgres). Direct URL is fine for a small demo if you add `connection_limit=1`. |
| `AUTH_SECRET` | New random string, at least 32 characters |
| `CRON_SECRET` | Random string. Vercel Cron sends it as `Authorization: Bearer …` |
| `NEXT_PUBLIC_APP_URL` | The `https://….vercel.app` origin, no trailing slash |
| `NEXT_PUBLIC_APP_NAME` | `ألو المعلم` |
| `PAYMENTS_ENABLED` | `false` |
| `STORAGE_PROVIDER` | `local` for the demo. Uploaded files do not persist on Vercel; use S3 or Cloudinary before real uploads. |

A public demo can be seeded once (`npm run db:seed` against that `DATABASE_URL`). Do not re-seed a database that has real users — the seed clears existing rows. Demo password remains `Demo@12345`.

## Deployment

1. Provision PostgreSQL. Set `DATABASE_URL` and a new `AUTH_SECRET`.
2. Set `NEXT_PUBLIC_APP_URL` to the public https origin and `APP_ENV=production`.
3. Leave `PAYMENTS_ENABLED=false` and `SEED_PASSWORD` unset or unused. Do not run the demo seed against production.
4. Build and migrate, then start:

```bash
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy
npm start
```

`npm start` listens on `0.0.0.0:3000`. Put TLS in front of it (reverse proxy or platform). Point a scheduler at `POST /api/cron/expire` with the `CRON_SECRET` header so stale requests and offers expire.

Local disk uploads do not survive a multi-instance or ephemeral filesystem deploy. Set `STORAGE_PROVIDER=s3` (or Cloudinary) and install `@aws-sdk/client-s3` only on that deploy. The app degrades with a clear error if S3 is selected and the SDK is missing, instead of failing `next build`.

Health check: `GET /api/health`.

## Tests

```bash
npm test
```

`tests/permissions.test.ts` covers role gates, ownership, booking transitions, password hashing, upload rules, and the optional-import build guard.

`tests/workflows.test.ts` uses the database in `DATABASE_URL`. It creates throwaway users (it does not log in as the demo accounts) and deletes them afterwards. It checks:

- admin self-registration is forbidden
- login does not reveal whether an email exists
- suspended users get no session
- a customer cannot send an offer
- accepting an offer is owner-only, stores the offer price in MAD, rejects the other offer, and refuses a second accept
- two concurrent accepts produce exactly one booking
- a professional cannot mark the job completed
- a review requires a completed booking, the customer, and no duplicate
- a cancelled booking cannot be reviewed

Workflow tests assume migrations have been applied and at least one category exists (`npm run db:seed` is enough).

## Roadmap

Designed for, not built yet:

- Online payments, escrow, commission, wallets, and payouts
- WhatsApp, SMS, and push delivery (in-app notifications already exist)
- Maps and geolocation search
- Subscriptions and paid featured placement
- Disputes and a fuller identity-verification pipeline
- AI matching between requests and professionals

Do not turn these on by hiding a button. Each one needs its own server workflow, the way offer acceptance does today.
