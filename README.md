# Travel Weather Planner

A weather-aware travel operating system that turns forecast data into better activity windows, itineraries, packing decisions, and risk guidance.

This repository contains a connected, production-oriented travel workspace with working Phase 1–2 features and foundations for later delivery phases. The live product flow is connected end to end:

1. Search a persisted destination.
2. Select dates and travel preferences.
3. Create a trip through the FastAPI API.
4. Normalize weather through a provider abstraction.
5. Calculate a deterministic Travel Weather Score.
6. Generate activity, itinerary, risk, and packing recommendations.
7. Inspect and edit packing/itinerary information in the responsive React interface.
8. Ask a data-grounded travel assistant questions about the trip.
9. Move between the dashboard, trip library, discovery, saved destinations, comparison, destination weather map, notification center, and settings without dead-end navigation.

### Connected workspace routes

- `/app` — personalized dashboard and upcoming-trip overview
- `/app/trips` — persisted trip library and trip management
- `/app/explore` — destination search, saving, and planning entry points
- `/app/saved` — device-persisted destination shortlist
- `/app/compare` — provider-backed three-destination comparison
- `/app/weather-map` — interactive destination point-condition map with layer controls
- `/app/notifications` — forecast and trip notification center
- `/app/settings` — persisted profile, unit, travel, and notification preferences
- `/trip/:id` — weather intelligence, score, activities, itinerary, packing, risk, and assistant

The development weather map deliberately presents normalized destination point conditions rather than pretending to provide radar or official severe-weather coverage. A production tile/radar provider can be connected behind the map boundary later.

## Important weather-data note

Development defaults to `DevelopmentMockWeatherProvider`, a deterministic provider with clearly labeled fixture data. It is separate from production adapters and is **blocked when `ENVIRONMENT=production`**. No fake service is presented as live weather. To use live data, set:

```env
WEATHER_PROVIDER=openweather
WEATHER_API_KEY=your-provider-key
```

All forecast recommendations are presented as probabilistic guidance, never guarantees.

## Architecture

```text
React / TypeScript / Vite
          │  /api/v1
          ▼
FastAPI application
  ├─ Auth (Argon2 + JWT access/refresh)
  ├─ Destination and trip APIs
  ├─ Travel intelligence service
  ├─ Deterministic scoring engine
  ├─ Provider-agnostic weather service
  ├─ SQLAlchemy repositories/models
  └─ Redis cache
          │
    PostgreSQL + Celery workers
```

### Frontend

- React 19 + TypeScript + Vite
- Tailwind CSS and reusable shadcn-style primitives
- TanStack Query for server-state caching
- React Router for the landing → planner → dashboard workflow
- Recharts for hourly outlook visualization
- Framer Motion with `prefers-reduced-motion` support
- Lucide icons
- Responsive desktop sidebar and mobile bottom navigation

### Backend

- FastAPI with versioned REST endpoints and consistent envelopes
- Pydantic validation
- SQLAlchemy normalized schema using UUID keys and UTC timestamps
- PostgreSQL in Docker; SQLite only as a zero-setup local fallback
- Redis-backed caching with an explicit in-process development fallback
- Celery worker scaffolding for refresh/change-detection jobs
- Argon2 password hashing and JWT access/refresh tokens
- Request IDs, structured logs, secure response headers, and CORS controls

## Repository structure

```text
travel-weather-planner/
├── frontend/src/
│   ├── components/     # brand and reusable UI
│   ├── features/       # destinations, weather, activities, itinerary, packing, assistant
│   ├── layouts/
│   ├── pages/
│   ├── services/
│   ├── lib/
│   └── types/
├── backend/app/
│   ├── api/v1/
│   ├── core/
│   ├── models/
│   ├── providers/
│   ├── schemas/
│   ├── services/
│   ├── workers/
│   └── main.py
├── backend/tests/
├── infrastructure/
├── docker-compose.yml
└── Makefile
```

## Run with Docker

```bash
cp .env.example .env
# Replace SECRET_KEY. Keep WEATHER_PROVIDER=mock only for development.
docker compose up --build
```

- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs
- API health: http://localhost:8000/health

## Run locally without Docker

```bash
# terminal 1
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# terminal 2
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to the local backend. The local backend uses SQLite when `DATABASE_URL` is not set.

## Selected APIs

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/destinations/search?q=
GET    /api/v1/weather/current
GET    /api/v1/weather/forecast
GET    /api/v1/weather/hourly
POST   /api/v1/trips
GET    /api/v1/trips
GET    /api/v1/trips/{id}
PUT    /api/v1/trips/{id}
DELETE /api/v1/trips/{id}
GET    /api/v1/trips/{id}/analysis
GET    /api/v1/trips/{id}/weather
GET    /api/v1/trips/{id}/activities
GET    /api/v1/trips/{id}/packing
POST   /api/v1/trips/{id}/optimize
POST   /api/v1/ai/chat
```

Responses use a consistent envelope:

```json
{ "success": true, "data": {}, "meta": {} }
```

## Travel Weather Score

The score is a configurable deterministic heuristic:

```text
temperature  × 0.25
precipitation × 0.20
wind          × 0.10
humidity      × 0.10
visibility    × 0.10
activity fit  × 0.25
```

It is intentionally labeled **Travel Weather Score** and is not a scientific safety rating.

## Database

The schema includes users, profiles, trips, trip destinations, destinations, weather snapshots, forecasts, activities, itineraries and items, packing lists and items, alerts, notifications, saved destinations, search history, AI conversations/messages, and audit logs.

Use Alembic for production schema changes:

```bash
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

## Testing

```bash
make test
```

Backend tests cover scoring behavior, provider determinism, destination search, health, and the demo analysis API. Frontend component tests use Vitest and React Testing Library. The Playwright suite exercises destination search → preferences → trip analysis → dashboard, plus navigation across every workspace area on desktop and mobile:

```bash
cd frontend
npm run test:e2e
```

## Production checklist

- Set `ENVIRONMENT=production`.
- Supply PostgreSQL and Redis TLS URLs.
- Set a random `SECRET_KEY`; rotate it using a secret manager.
- Select a live weather provider and add its server-side API key.
- Restrict `ALLOWED_ORIGINS` to deployed frontend origins.
- Run Alembic migrations rather than runtime table creation.
- Put the API behind TLS and an edge rate limiter/WAF.
- Connect structured logs and traces to Sentry/OpenTelemetry.
- Run separate Celery worker and beat processes.
- Add provider failover and official severe-weather alert sources appropriate to supported regions.

### Geographic map and deployment

The map uses MapLibre GL and OpenFreeMap's Liberty vector style at
https://tiles.openfreemap.org/styles/liberty. It no longer requests tiles from
OpenStreetMap's volunteer raster tile endpoint, which returned access-blocked
images in the embedded preview. OSM-derived geographic data, OpenMapTiles, and
OpenFreeMap attribution remain visible through the map style's source metadata.

The map opens in central Kigali and displays roads, building outlines, and place
labels where available. City markers use validated WGS84 reference coordinates,
not fictional locations. No routing is fabricated. My location uses the browser's
permission-based geolocation control; the host may restrict this permission.
Weather data remains a separate provider and mock observations are labeled.

Set `VITE_MAP_STYLE_URL` and `VITE_MAP_PROVIDER_NAME` to use a contracted provider
or self-hosted MapLibre-compatible style. Preserve all source attribution.
VITE variables are public; use no secret credentials. The default public service
requires internet, is not an uptime guarantee, and should be reviewed for your
production requirements. See https://openfreemap.org/ for service information.
MapLibre requires WebGL. Provider/startup failures show an actionable error.

The map worker is bundled explicitly using Vite's URL import to avoid missing
worker assets in development and production. Desktop and mobile browser tests
cover real vector rendering, referrer-free requests, provider errors, and ensure
no requests are made to the blocked OSM raster endpoint.

### Worldwide location search

Nonempty searches use Photon (OpenStreetMap worldwide geocoding), not a fixed
country/city allowlist. Cities, countries, addresses, and mapped landmarks can be
returned; coverage/ranking depends on OSM and Photon and is not a guarantee of
every address. Results retain real coordinates, stable OSM-derived IDs, and
coordinate-derived IANA timezones (UTC only when no timezone is found). They are
stored as destinations so trip creation and map navigation use the same records.

The UI waits 500 ms after typing; results are cached for 24 hours and upstream
requests are serialized at one per second per backend process. Query text is sent
to Photon; credentials are not. OSM attribution is displayed. Public Photon is a
moderate-use preview service without an SLA. For production scale configure
`GEOCODING_URL` with a dedicated/self-hosted Photon API and coordinate rate limits
across workers. Provider failures return 503, not misleading empty results.

### Responsive UI verification

The workspace uses mobile navigation below 1024px and a scrollable sidebar above
that breakpoint. Bottom navigation accounts for device safe-area insets; phone
inputs use 16px text to avoid automatic form zoom. Narrow cards/headings wrap
rather than masking overflow. Packing controls remain accessible without hover.
The map retains its 440px mobile / 600px tablet-desktop viewport independently of
the location panel and portaled dropdown.

`node responsive-audit.mjs` audits 13 routes at six widths (320–1920px).
`npx playwright test e2e/responsive.spec.ts --project=desktop-chromium` checks
seven portrait/landscape viewport sizes, including dropdown bounds, navigation,
and map sizing. These are browser-emulation checks, not certification on every
physical device or browser engine.

## Live weather and private saved plans (September 2026)

- Default weather provider is now `openmeteo`: live model-based current conditions,
  hourly data, and up to 16 forecast days. It never falls back to mock data on an
  outage. Missing trip dates yield an empty forecast plus explicit UI guidance;
  saved plans remain editable independently of weather. UTC retrieval time and
  provider-local data time are retained. Official severe alerts are not provided.
- Free `https://api.open-meteo.com/v1/forecast` is for eligible non-commercial use.
  Before commercial deployment, obtain an appropriate Open-Meteo plan/license,
  configure `OPEN_METEO_URL` (e.g. the customer endpoint) and server-side
  `WEATHER_API_KEY`. No secret key is in frontend code. See
  https://open-meteo.com/en/terms and https://open-meteo.com/en/pricing.
- Every trip operation, subresource, plan save, optimization request, and trip chat
  verifies a signed access token, active account, and ownership before fetching
  cached data. New trips get their owner from the verified token, never the body.
  Ownerless legacy/demo trips are retained but inaccessible to normal accounts;
  they are never automatically assigned to a user. Fresh accounts start empty.
- `/api/v1/trips/{id}/plan` GET/PUT stores the itinerary and packing list in the
  `trip_plans` SQL table. Save all changes explicitly; validation rejects invalid
  dates/quantities, and revision conflicts return 409 without overwriting edits.
  The UI preserves unsaved edits on failed saves and warns before browser unload.
  Private responses use Cache-Control: no-store. Session tokens remain tab-scoped.
- Production schema deployment: back up the database and run `python -m alembic
  upgrade head` before starting the API. Migration `20260914_trip_plans` adds only
  a new table; it does not assign or delete legacy trips. Development uses
  create_all; production never does. Configure PostgreSQL backups/retention for
  operational durability; persistence is not a replacement for backups.
- Tests: `python -m pytest -q` verifies two-user isolation, unauthorized subroutes,
  durable plan records, validation, stale-write rejection, and weather mapping.
  `e2e/private-trips.spec.ts` covers save/reload and cross-account access in-browser.

## Expansion — Phase 1: sharing, exports, offline details

Open a saved private trip and use **Take your plans with you**.

- **Manage sharing:** view or edit capability links, 1/7/30-day expiry, maximum
  ten active links per trip, owner-only link listing and revocation. Tokens are
  256-bit random values, stored only as SHA-256 hashes. The raw token is returned
  once and carried in the browser URL fragment and `X-Trip-Share` API header, not
  query strings, server URL logs, or referrers. These are bearer links (anyone
  holding one has the stated permission), not recipient-verified invitations.
- Shared viewers see every itinerary day and packing status, but no account
  information, live weather requests, maps, or owner-management actions. Edit
  links can save only itinerary/packing fields, using revision checks. Each API
  access validates expiry and revocation. Read-only pages recheck every 30 seconds;
  edit pages recheck on save. Already loaded/downloaded content cannot be recalled.
- **Export calendar:** UTF-8 ICS with stable event/task IDs, line folding, escaping,
  revision sequences, and destination-local activity times converted to UTC.
  Activities have start times only (no invented durations). Packing appears as
  VTODO entries; calendar applications vary in task support. It is an export,
  not a subscribed/synchronized calendar. DST gaps are rejected; ambiguous DST
  wall times use the first occurrence (fold=0).
- **Export PDF:** server-generated, paginated itinerary and packing checklist,
  revision/time annotation, embedded DejaVu fonts with license included. Current
  font coverage is not a promise of complete worldwide-script support; additional
  fonts/shaping and language QA are part of the language phase.
- **Download offline copy:** standalone responsive HTML with no external assets,
  scripts, map tiles, credentials, or live data. Works from device Downloads
  without internet. Checkboxes can be toggled for the current viewing session;
  they do not persist on reopen or sync to the app. The web app itself is not yet
  an installable/offline PWA. Keep downloaded copies private and delete them
  manually on shared devices. Revocation cannot remove downloaded files.
- Exports always use the database's saved plan. The UI requires saving local
  changes first. Private exports and shared API responses use `Cache-Control:
  no-store`. Offline HTML has a restrictive CSP and escapes all user text.
- Run `python -m alembic upgrade head` for production migration
  `20260914_trip_shares`. Back up the database first. Development creates missing
  tables automatically. `reportlab` is included in backend requirements.

Verification: `pytest` covers ownership, hashes, view/edit enforcement,
revocation, expiry, stale saves, export escaping/timezones, and deleted links.
`e2e/sharing-exports.spec.ts` covers owner/guest flows, download formats, actual
network-disabled offline-file viewing, and phone/desktop layouts.

### Remaining expansion phases (not implemented in Phase 1)

1. Multi-destination trip editing and provider-backed road routing/travel times.
2. Scheduled forecast-change detection, notification preferences, delivery and
   deduplication. Requires delivery-provider configuration for email/push.
3. Official-source travel information, with provenance and freshness indicators.
4. Accessibility audits with screen readers, then worldwide language architecture,
   RTL/script support, translation-provider integration and reviewed translations.
   The interface remains English today; browser-local date/number formatting is
   not equivalent to translation. “All languages” coverage must be verified
   against the chosen provider; safety/entry/emergency text needs human review.

## Professional manual / assisted trip creation

The planner now has four real steps: approach, details, customization, and review.
Manual users can name a trip, select dates/location, add/reorder/edit activities,
and edit packing items before creating it. AI users choose pace/interests and
may add notes; a draft is generated and reviewed before saving. No simulated
analysis timer or automatic trip creation remains.

- AI integration: configure backend `AI_API_KEY`, optionally `AI_MODEL` and
  `AI_API_URL` (OpenAI-compatible HTTPS chat-completions API). See
  `backend/ai.env.example`. The default model is gpt-4.1-mini. Requests include
  destination/dates/preferences/notes and available forecasts, not user identity
  or tokens. Consent is required. Provider billing/privacy policies apply.
- No key is configured by default. The UI says AI is unavailable and offers
  manual planning or **rule-based suggestions**, never fake AI. Rule-based
  drafts use pace/interests and daily forecast rain/temperature/UV; they do not
  interpret free-text notes. Forecast gaps/outages are identified in draft notes.
- Assisted drafts support up to 14 days. Manual trips retain the existing 61-day
  maximum. All suggestions are generic, unverified activities—not venue bookings,
  opening-hours, trail-safety, pricing, or travel-time guarantees.
- AI outputs are validated against bounded schemas, requested dates, and unique
  IDs; malformed output or provider failure returns an error rather than a
  silently substituted draft. No live model call is claimed in tests: AI responses
  are mocked explicitly there. Live AI requires an operator-supplied key.
- `POST /trips` accepts a reviewed `initial_plan` and saves trip, destination, and
  plan atomically under the verified account. An optional request UUID makes
  retries idempotent per account. Failed creation leaves the draft in the UI;
  drafts are not persisted across reloads. Changing dates/destination resets the
  draft; back navigation within steps otherwise retains inputs.
- The authenticated `X-App-Token` header carries the same verified access JWT for
  embedded-preview proxies that may consume Authorization. It is not an auth
  bypass: signature, token type, expiry, active-account, and ownership checks are
  unchanged. APIs still accept standard Bearer authentication.

Verification: `tests/test_planning.py` covers atomic/idempotent saves, draft
validation, missing-provider behavior, rule-based provenance, AI validation and
preview-token authentication. `e2e/planner-flow.spec.ts` checks manual creation,
review persistence, guided suggestions, consent, and the mocked AI UI flow on
phone and desktop. Configure a real key to run a live AI-provider smoke test.

## Gemini trip-drafting integration

The planning assistant supports native Gemini `generateContent` as well as the
previous OpenAI-compatible adapter. Select `AI_PROVIDER=gemini`, set a backend
`AI_API_KEY`, and configure `AI_MODEL`. The tested model for this setup is
`gemini-3.6-flash`; model availability depends on the Google account.

Gemini receives the key only through the server-side `x-goog-api-key` header,
never query strings or browser code. The local backend `.env` is git-ignored and
owner-readable only. Use a deployment secret manager in production. Rotate keys
shared in chat and set appropriate API restrictions/quotas in Google's console.
Examples contain no real credentials.

Requests use separate system instructions and traveler context with JSON output.
Responses still pass bounded plan-schema, date and ID validation. Truncated or
blocked responses are rejected. Credential, quota and model errors display safe
messages without forwarding raw provider error bodies or secrets. Generation
never saves or books anything automatically.

Verification includes native Gemini transport/error tests, a successful live
Gemini generation, and a full live browser flow producing an editable trip draft.
The temporary credential is not included in test fixtures or documentation.

## Language & region settings

Open **Settings → Language & region**, or `/app/settings?section=language`.
The section now exists and provides:

- A searchable list of 184 ISO 639-1 language preferences for new Gemini drafts.
  This requests a language, not a guarantee of fluency in every listed language.
  Gemini receives a validated language code and is instructed to keep schema keys,
  IDs, dates and times unchanged while localizing human-readable suggestions.
  Existing trips, UI messages, and rule-based suggestions are not translated.
- Regional formatting choices and 12/24-hour preferences, with live date/time/
  number previews. Applied to trip-list dates, sharing timestamps, and planner
  summary formats. Destination-local activity times and export semantics remain
  unchanged.
- Explicit **Save language preferences** action; settings persist in browser
  local storage on this device and synchronize across tabs. These preferences
  are not yet stored in the account database or synchronized across devices.

The interface itself is still English. This is displayed prominently rather than
presenting an untranslated UI as supporting another language. Translation of the
complete interface remains separate work. AI-generated text inputs use automatic
text direction for right-to-left content. A real Gemini French draft and automated
phone/desktop preference-save/AI-request tests were verified.

## Unified responsive dropdowns

`ModernSelect` is the shared selection control for AI language, regional format,
travel style, itinerary days, sharing permission/expiry, comparison locations,
and the map's destination picker. It uses a portaled Radix popover, a bounded
scrolling list, optional accent-insensitive search, selected checkmarks, and
consistent light/dark surface tokens. Native date/time inputs remain native for
platform calendar and time-picker behavior.

Worldwide location autocomplete uses the same panel/option styling and portaled
positioning, retaining its server-backed search, debounce, skeletons, attribution,
and error states. Trip actions use a Radix dropdown menu with a separated
visually marked destructive action and an existing deletion confirmation.

Keyboard arrows, Enter, Escape, typeahead for short lists, and focus restoration
are supported. Option navigation scrolls only the list, never the page or map.
Clicking outside does not steal focus back from a different input. Panels avoid
viewport edges and respect available height; touch targets and mobile search
font sizes are increased. Reduced-motion preferences are respected. No native
HTML select controls remain in the app's TSX source.

`e2e/modern-dropdowns.spec.ts` checks selections, persistence, short/long lists,
menu bounds, empty search, light/dark styles and unchanged map dimensions at
320, 390, 768 and 1366 pixels, plus an 844×390 landscape viewport. Selection,
language, planner and sharing/export regression tests use the custom controls.

## Dedicated settings pages

Settings is now a category index with real links to `/app/settings/language`,
`/profile`, `/preferences`, `/notifications`, and `/privacy` (all under
`/app/settings`). Each destination has a page title, top-of-page focus, and a Back
to Settings link. On phones the category list is not repeated above the selected
page. Tablet/desktop retain a compact category sidebar. Legacy
`/app/settings?section=language`-style links redirect to their dedicated routes;
unknown sections return to the settings index. Browser reload/history works.

Destination browsing dropdowns now use a shared stable A–Z order (case/accent
insensitive), with country/type/coordinates as tie breakers. The current searched
selection is inserted in order, rather than appended to the bottom. Repeated IDs
are removed, but genuinely different same-name locations remain selectable with
extra details. Query-cache arrays are never mutated. Worldwide autocomplete keeps
provider relevance ranking; alphabetical ordering applies to browsing pickers.

## Multi-destination itineraries

A trip can now contain up to 12 ordered stops (61 calendar days total). In
**Plan a trip → Trip details**, add destinations and inclusive arrival/last-day
ranges. Reordering preserves each visit's duration and recalculates dates from
the original start. Removing a stop leaves its dates to be reassigned, rather
than silently changing the rest of the trip. The same stop editor is available
through **Manage stops** on saved owner trips.

### Calendar-day model and limitations

Each date belongs to exactly one stop; overlaps and unassigned gaps are rejected
by both frontend and backend. A transfer belongs to the arriving stop's first
day. This is not an arrival/departure-time or flight-feasibility model: same-day
activities in two different destinations and date-line-crossing logistics need
more detailed routing/transport support in a later phase. No road routes, travel
times, prices, or bookings are fabricated or drawn by this feature.

### Data integrity and compatibility

- Stops use the existing normalized `trip_destinations` table, not local storage.
  No new table/migration is required. Old single-destination requests and trips
  still work; `destination` in responses remains the primary stop for compatibility.
- `POST /trips` accepts `stops` with destination IDs and date ranges. All
  destinations are checked before anything is saved, and creation remains atomic
  and idempotent per account/request ID.
- Owner-only `PUT /trips/{id}/stops` uses the plan revision. Stale writes return
  409. Existing activities stay on their calendar dates. Reassigning a populated
  date requires explicit confirmation; removing a date with activities is rejected
  until the user moves/removes them. Packing items remain intact. Edit sharing
  links cannot manage stops or trip dates. Direct date changes through legacy
  PUT /trips are rejected to prevent stop/itinerary drift.
- Trip cards, shared views, PDF/offline files and calendar exports contain the
  ordered journey. Calendar activity times use that day's stop timezone, rather
  than the first destination's timezone.
- The day/stop selector drives the saved-trip weather panel and forecast window.
  Current conditions are labeled as current, not future-trip predictions.
  Legacy analysis/weather routes accept optional `stop_id`; metadata identifies
  the selected-stop scope (first stop by default). AI chat identifies that scope.
- Assisted drafts retain their 14-day total limit. Gemini receives every stop's
  dates/timezone and that stop's available forecast. Weather failures are scoped
  and disclosed. Rule-based drafts use each day's relevant stop forecast.

Verification: `tests/test_multistop.py` tests schedule validation, atomic creation,
owner enforcement, shared permissions, stale saves, activity preservation,
per-stop UTC calendar conversion, and mocked AI journey context.
`e2e/multistop.spec.ts` exercises Kigali → Nairobi → Mombasa creation, overlap
handling, stop-specific weather selection, owner edits and reload persistence on
phone and desktop. Live AI output is not claimed by the mocked AI tests.

## Google activity location search, routes, and schedule checks

### Activation (not configured by default)

Google Maps Platform was selected for this feature. This integration is separate
from the Gemini model/API key. Copy the settings from
`backend/google-maps.env.example` into the private backend `.env` or production
secret manager, then restart the API:

1. Enable **Places API (New)**, **Routes API**, and **Maps JavaScript API** in a
   billing-enabled Google Maps Platform project.
2. Set `GOOGLE_MAPS_SERVER_KEY`, restricted to Places/Routes APIs and the deployed
   backend's egress IP addresses.
3. Set a **different** `GOOGLE_MAPS_BROWSER_KEY`, restricted to Maps JavaScript API
   and the exact website/preview referrer hosts. This browser key is intentionally
   public; the server key is never returned by `/routing/config`.
4. Set Google Cloud API quotas and billing alerts. App limits do not constrain
   direct Maps JavaScript map loads. Alerts alone are not spending hard caps.
5. In production, connect Redis and publish/review operator-specific legal terms,
   privacy contacts/retention policies, and Google agreements. Set
   `GOOGLE_MAPS_LEGAL_APPROVED=true` only after that review. The public preview
   pages `/legal/terms` and `/legal/privacy` identify what still needs completion.

Without Maps credentials the app shows a setup message, location search and route
calculation stay unavailable, and schedule-only checks still work. The existing
OpenFreeMap weather map remains unchanged. Google data is never plotted on it.

### Workflow

In a saved private trip, select a day. Add a duration and use **Choose activity
location** for each activity. Search calls are debounced and use per-search-session
UUIDs, followed by a Place Details request when selecting a result. Only the
Google place ID is saved; Google display names, addresses, geographic coordinates,
attributions, polylines and route estimates remain transient, not in the database
or offline exports. No place-detail prefetching is performed on reload: users
explicitly choose **View linked place** to resolve the ID again.

Save the trip, choose Driving/Walking/Cycling, and click **Calculate directions**.
All 2–10 activities must have place IDs. The app preserves their saved order,
never skips missing locations, and never substitutes straight-line geometry.
Google's returned polyline and route endpoints render on a Google Maps JS map;
numbered route endpoints may be snapped to access roads. Place lookup and route
calls require trip ownership. Sharing links do not grant Google API spending
permissions. Native provider errors are sanitized; unavailable routes stay
unavailable, never simulated.

Driving uses traffic-unaware estimates. There is no traffic layer, flight/train
transfer calculation, route optimization, venue availability, or opening-hours
check. Walking/cycling caution text is displayed. Routes and schedule results are
cleared when the plan/revision/day changes. User-entered durations are preserved
in shared views and exports; calendar events have DTEND only when a duration was
provided. AI drafts are explicitly stripped of location references and durations
so Gemini cannot invent verified places or timetable facts.

### Schedule checks

**Check schedule** works without Maps keys. It detects known-duration overlaps,
non-chronological activity order, and overnight activity ends. It identifies
missing durations/locations and unverified travel time. After a route calculation,
checks also compare each available gap with provider travel duration (rounded up
in minutes) plus a user-selected 0–120 minute buffer. A timezone-transition day
is flagged for manual review rather than presented as fully checked. A clear
result means only “No timing conflicts detected”, never a safety guarantee.

### Application request ceilings

Defaults are configurable in backend settings:

| Requests | Per user/minute | Per user/UTC day | Whole app/UTC day |
|---|---:|---:|---:|
| Compute route | 6 | 100 | 1,000 |
| Places search/details combined | 30 | 300 | 3,000 |

Requests consume app budget before calling Google, including failed provider
attempts. Redis enforces shared counters in production; the memory fallback is
only for development, not multi-worker quota enforcement. Counts are not Google
billing entitlements or a cost estimate. Routes use at most eight intermediate
waypoints to stay below Google's higher-waypoint threshold; actual charges still
depend on the SKU/features and account agreement.

Google documents per-request Routes billing and waypoint limits in
[2](https://developers.google.com/maps/documentation/routes/usage-and-billing).
Place-ID storage exceptions and Google-map/attribution requirements are documented
in [1](https://developers.google.com/maps/documentation/places/web-service/policies).
Google's official attribution SVG assets are used without modification; native
map attribution is not hidden. Browser referrer policy allows origin referrers
needed by website-restricted Google keys; share tokens remain URL fragments and
are never transmitted in page URLs/referrers.

### Verification and limitations

`tests/test_routing.py` covers authentication/ownership, quotas, provider request
masks, ID-only persistence, missing locations, routing errors, durations and
schedule conflicts. `e2e/google-routing.spec.ts` tests linking places, save-before-
route behavior, clearing stale results, rendering the provider geometry and the
keyless schedule flow on desktop/phone. **Google responses and the Maps SDK are
explicitly mocked in these tests.** No live Google Maps API request is claimed:
separate Maps credentials were not supplied. A live integration smoke test and
project billing/restriction review are required after configuring those keys.

### Maps server activation check

A supplied Maps credential was accepted by live Places API (New) and Routes API
checks. It is configured backend-only as `GOOGLE_MAPS_SERVER_KEY`. Autocomplete,
place details, and a computed driving route between two public Kigali landmarks
were verified through the native provider adapter. This does not establish that
Google Cloud key restrictions, billing budgets or production legal setup are
correctly configured.

No `GOOGLE_MAPS_BROWSER_KEY` is configured yet. Place search and route estimates
are enabled in the development preview; Google map display still requires a
separate website-restricted Maps JavaScript API key. The server credential is
not included in browser configuration, frontend code or test fixtures. Rotate
chat-shared credentials after testing and update the private environment file.

## Vercel + Supabase deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the current two-project Vercel architecture,
Supabase Auth migration, PostgreSQL runtime-role/RLS setup, environment templates,
CSP generation, verification results and launch gates. This supersedes older local
JWT/SQLite instructions **for production only**. Local development still supports
its existing login flow; no hosted Supabase project or production release has been
created by these changes. Backend test/worker dependencies are in
`backend/requirements-dev.txt`; runtime dependencies are in `backend/requirements.txt`.
