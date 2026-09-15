# Deploy to Vercel + Supabase

**Status: deployment code prepared and locally tested; not deployed or certified for public launch.**
You must configure real projects, complete the launch gates below and run a live staging test. No Supabase/Vercel credentials were provided, no cloud resources were created, and no existing accounts/data were moved.

## Architecture

```text
Browser ── Supabase Auth (signup, confirmation, login, reset, refresh)
   │
   └── Vercel frontend (React/Vite)
          │ HTTPS bearer token, exact-origin CORS
          ▼
       Vercel backend (FastAPI / Python Function)
          ├── Supabase Auth /user: verifies every protected request
          ├── Supabase PostgreSQL transaction pooler (backend-only role)
          ├── Shared TLS Redis (Vercel Marketplace/Upstash or equivalent)
          └── Weather / Google Places & Routes / optional AI
```

There are **two Vercel projects from the same repository**. Supabase provides PostgreSQL and Auth, not the Python runtime. Redis is an additional managed dependency for cross-instance quotas; in-memory limits are not used in production. No Celery worker runs on Vercel. Background notifications are not made operational by this deployment.

The browser uses Supabase **Auth only**, not its database Data API. RLS and revoked grants deny browser roles access to all 21 application tables. The restricted `travel_app` database role can read/write app data; FastAPI enforces account ownership and sharing permissions. This is backend-mediated authorization, not per-user `auth.uid()` RLS. Database credentials must never reach the browser.

## 1. Create a staging Supabase project

Use a **new, dedicated project** initially. Choose a region close to the Vercel backend region you will configure. Do not point preview deployments at your production database.

Collect privately:
- Project HTTPS URL and **publishable key** (a legacy `anon` key is also accepted).
- A direct or session-mode database connection for **migrations**.
- Transaction pooler host, port and role username for runtime.

From **Connect**, copy actual connection strings; do not derive pooler hostnames from region names. Change the URL scheme to `postgresql+psycopg://`. Percent-encode passwords; enable TLS with `?sslmode=require`. Prefer `verify-full` with the Supabase CA when you configure a trusted certificate file. Never use `sslmode=disable`.

### Schema and restricted runtime role

On a trusted machine, with Python 3.12, from `backend/`:

```bash
python -m venv .venv
# Activate your virtual environment using the command for your OS.
pip install -r requirements-dev.txt
# Set DATABASE_MIGRATION_URL securely to your ADMIN direct/session-pooler URL.
# Set DATABASE_URL to a valid PostgreSQL URL as well (never a browser variable).
alembic upgrade head
```

Run `infrastructure/supabase-runtime-role.sql` in Supabase SQL Editor as administrator. It grants data access only to the application's tables, not `auth.users`, and sets SQL/lock timeouts. Set a strong random password for `travel_app` in a secure admin session; do not commit it.

Use the transaction-mode pooler with the `travel_app` role as the backend `DATABASE_URL`. The pooled username will generally include your project ref; use Supabase's connection instructions for custom roles. Prepared statements are disabled and SQLAlchemy uses `NullPool` in production so the external pooler handles connections.

Initialize only the real destination catalogue:

```bash
# DATABASE_URL now points to the restricted runtime role.
python -m scripts.seed_production
# With DATABASE_MIGRATION_URL still securely set, verify database permissions:
python -m scripts.check_database_access
```

Cold starts do **not** create tables, run migrations, seed data or create demo accounts/trips. Run migrations once in a controlled release process, never in parallel Vercel builds. Future table migrations must add RLS, revoke browser grants and explicitly grant the runtime role access.

Do not blindly `alembic stamp head` on an old database created with `create_all`. Review its actual schema first. The current local preview was updated additively without stamping it or deleting its data.

## 2. Configure Supabase Auth

In Authentication settings:
- Enable email/password login and **email confirmation**.
- Set a minimum password length of at least **10**, matching this UI.
- Configure a real custom SMTP provider and sender domain; verify delivery and sender DNS. Do not rely on development email limits for public registration.
- Set **Site URL** to your exact frontend URL.
- Allow these exact redirects (replace the domain):
  - `https://YOUR_FRONTEND.vercel.app/auth/callback`
  - `https://YOUR_FRONTEND.vercel.app/auth/callback?flow=recovery`
- Add custom-domain/staging URLs explicitly. Do not allow all `*.vercel.app` projects.
- Review Auth rate limits and JWT/session lifetimes. Logout is for the current browser session; issued access tokens may remain valid until expiry. For urgent suspension, set the application user's `is_active=false` as well as taking the appropriate Supabase admin action.

The SDK keeps access/refresh credentials in sessionStorage. Only the short-lived PKCE verifier is shared through localStorage, allowing normal email links to open in another tab of the **same browser**. If cross-device email handling is needed, configure reviewed token-hash email templates using the supported `/auth/callback?token_hash=...&type=email` or `type=recovery` flow, and test them. Callback URLs are cleaned after reading credentials; no arbitrary redirect target is accepted.

The app implements registration, confirmation, login, password-reset request/update, refresh and logout. CAPTCHA and MFA are not integrated: enabling a mandatory CAPTCHA in Supabase without adding its UI token flow will break signup/login. Review abuse controls before public launch; do not label them implemented.

### Existing-account migration

Local development/test accounts are **not automatically production accounts**. A matching email never automatically claims an existing app user or trips.

For an existing dataset you intentionally import, preserve user IDs and foreign keys. Have each user establish a confirmed Supabase identity/new password. After an administrator independently reviews both identities, run:

```bash
# Trusted ADMIN DATABASE_MIGRATION_URL, from backend/. The script checks auth.users directly.
python -m scripts.link_supabase_account \
  --local-user-id REVIEWED_LOCAL_UUID \
  --supabase-user-id REVIEWED_SUPABASE_UUID \
  --confirm-ownership
```

It verifies matching confirmed emails, preserves the old app user ID/trip ownership, and disables the legacy password hash. It does not import old SQLite records, copy plaintext passwords or silently merge accounts. Back up and rehearse any data import separately before switching real users.

## 3. Deploy the Vercel backend

Import the repository as a Vercel project:
- **Root Directory:** `backend`
- **Framework:** FastAPI (entrypoint `app/main.py`)
- **Python:** 3.12 (`.python-version`)
- Use `backend/vercel.json`; no frontend build command here.
- Function duration configured to **120 seconds**. Confirm your account's plan/runtime limits permit this. AI has a 60-second upstream timeout; multiple-stop weather and cold starts need additional headroom.
- Choose a backend region near Supabase. Check the actual Python bundle size and cold-start duration during deployment; no deployed bundle measurement is claimed here.

Set variables from `backend/production.env.example` in the **backend project only**. Replace every placeholder. Important:

| Variable | Purpose |
|---|---|
| `ENVIRONMENT=production` | Strict launch configuration, no local DB/seeding |
| `AUTH_PROVIDER=supabase` | Disables old register/login/refresh API endpoints |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Provider-side user verification; no service-role key needed |
| `DATABASE_URL` | Restricted runtime role, transaction pooler, TLS |
| `DATABASE_NULL_POOL=true` | External pooling; also automatic in production |
| `REDIS_URL` | Shared `rediss://` connection, not the Redis REST URL |
| `SECRET_KEY` | At least 32 random characters; keep private |
| `ALLOWED_ORIGINS` | Exact frontend HTTPS origin(s), comma-separated, no trailing slash |

Do not set `DATABASE_MIGRATION_URL` on the Vercel runtime. Keep administrator credentials only on the trusted release machine/CI environment. Set credentials separately for staging and production; never expose them to untrusted preview/PR builds.

Health endpoints:
- `/health`: process is responding (not a claim that all dependencies work).
- `/ready`: checks PostgreSQL migration revision and shared Redis, returns 503 if not ready.

Production refuses unsafe local-auth/SQLite/plaintext-Redis/wildcard-CORS/placeholder settings. Redis failure does not silently disable quotas. Redis INCR+expiry is atomic. Provider failures remain errors, never fake success data.

## 4. Deploy the Vercel frontend

Import the same repository as a **second** Vercel project:
- **Root Directory:** `frontend`
- **Framework:** Vite
- **Node:** 22
- Install: `npm ci`; build: `npm run build`; output: `dist`

Set the public values in `frontend/production.env.example`:

```dotenv
VITE_AUTH_PROVIDER=supabase
VITE_API_BASE_URL=https://YOUR_API.vercel.app
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`VITE_API_BASE_URL` is an origin, without `/api/v1`. Browser API requests use this HTTPS host rather than localhost; the local Vite proxy remains for development.

Generate a Content Security Policy using the real, public origins, **before committing/deploying**:

```bash
cd frontend
VITE_API_BASE_URL=https://YOUR_API.vercel.app \
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co \
npm run configure:vercel
```

This writes **no keys**, only public origins and security headers into `frontend/vercel.json`. Commit that file. The checked-in initial file contains placeholders intentionally: a Vercel build fails until environment settings and CSP match. When origins change, regenerate and commit it. Custom Supabase/map/font hosts require an explicit CSP review too.

The configuration includes SPA deep-link rewrites, security headers, callback no-store/no-referrer and private-share no-index headers. Test direct visits/reloads to `/trip/...`, `/auth/callback` and `/share`. Existing map dimensions are unchanged.

**Never set server keys, service-role/secret keys, DB passwords or AI keys in any `VITE_*` variable.** Build checks reject known secret variable names and secret Supabase key types.

If Vercel deployment protection is enabled on the backend, browser API requests must still be able to reach it. Do not put a protection-bypass secret in frontend code. Use a reachable staging API protected by app authentication/CORS, or configure an appropriate secure platform-level access arrangement.

## 5. Complete provider and legal launch gates

- **Google:** rotate the server key previously shared in chat. Store it only on the backend; restrict API access to Places API (New) and Routes API. Vercel's default egress is not a stable IP allowlist: review a supported static-egress arrangement before relying on IP restrictions. Do not carry over sandbox IP restrictions blindly.
- Use a distinct website-restricted Maps JavaScript key for your actual frontend domains. Backend provides only that intended public key to the UI. Maps URLs navigation works without this embedded-map key.
- Configure Google project quotas, app quotas and billing alerts; alerts alone do not cap spend. Do not enable `GOOGLE_MAPS_LEGAL_APPROVED` until required operator terms/privacy and provider agreements are reviewed and published.
- **Weather:** confirm Open-Meteo's license/subscription matches your commercial/noncommercial use and traffic. Configure an appropriate paid endpoint/key if required.
- **Worldwide geocoding:** public Photon is a moderate-use preview service, not a production SLA. Arrange managed/self-hosted **Photon-compatible** geocoding for production scale and set `GEOCODING_URL`; a Google URL is not a drop-in replacement for that schema. Review caching, rate limits and provider terms. Google venue search is a separate integration.
- **AI:** use a valid model/key, explicit user consent and account/project quotas. No key means the explicitly labelled non-AI workflow remains available.
- **Legal:** current terms/privacy remain preview disclosures. Supply your operator identity, support/data-request contact, retention/deletion policy and applicable terms before launch. No legal compliance certification is claimed.
- **Operations:** configure Supabase backups/PITR as appropriate, rehearse restore, set Vercel/Supabase/Redis usage alerts and uptime checks, and review logs for secrets/PII. Keep a documented account deletion/support process until a self-service deletion flow is built.
- **Plan suitability:** check Vercel/Supabase/Redis/provider commercial-use terms, limits and cost; no free-tier capacity or production SLA is promised.

## 6. Verification and release

Local checks completed during preparation:
- 49 backend tests, including Supabase verification failures, ownership isolation, legacy-account collision protection and unsafe production configuration rejection.
- 13 frontend unit tests.
- 12 desktop/mobile regression tests: private trips, Google routing and sharing/exports.
- 10 desktop/mobile Supabase browser-SDK tests: email confirmation, password reset, invalid links, login/logout and session refresh, including PKCE email confirmation in a new tab. **Explicit HTTP fixtures; not real email delivery or a live Supabase project.**
- Fresh SQLite migration; full generated PostgreSQL migration chain and RLS/runtime-role SQL executed in PGlite's PostgreSQL engine. Browser roles denied, runtime DML allowed, schema changes denied. **Not a live Supabase pooler/network test.**
- Normal frontend build (also verified with Node 22) and Supabase-mode production build with public fixture origins passed. Local Python tests used the sandbox Python 3.13; the added CI workflow targets the deployed Python 3.12.
- Frontend production-dependency audit: zero reported vulnerabilities at verification. Two moderate development-dependency findings remain to review; do not use `audit fix --force` without regression testing.

GitHub Actions runs Python/JS tests, builds, SDK browser tests and a PostgreSQL 17 service migration/access-control job. That workflow has been added, **not yet run on GitHub**. Dependencies/bundle size/cold starts and the actual Vercel build must be verified in your account.

Before promoting staging:
1. `/health` and `/ready` return 200 on the deployed backend.
2. Real signup email arrives, confirmation works, new login works, password reset works, refresh survives expiry and logout removes this browser session.
3. Create/save/reload a real multi-stop trip; a second account cannot read/edit/delete it.
4. Check real weather, chosen Google travel modes, map rendering, external navigation, consented AI draft, sharing/revocation and all exports.
5. Browser Data API queries with publishable/authenticated credentials cannot read app users/trips/share hashes.
6. Confirm deployed static assets contain no server secrets, CORS rejects an unapproved origin, and CSP permits only intended services.
7. Test provider failures, Redis/DB outages, rate limits, concurrent edits, cold starts and realistic concurrent traffic.
8. Finish the legal, provider, backup/restore and account-migration gates above; record responsible owners.

Rollback: retain the previous Vercel deployment, take a DB backup before migrations and prefer additive schema changes. Roll back app deployment separately from DB schema; do not drop Supabase identity mappings or re-enable legacy login as an emergency shortcut. Supabase account migration/password changes are not undone by a frontend rollback.

## Official references reviewed

- https://vercel.com/docs/frameworks/backend/fastapi
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/reference/javascript/auth-getuser
