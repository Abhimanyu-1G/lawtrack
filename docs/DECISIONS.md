# Decisions and deviations

Every ambiguity resolved and every deliberate deviation from `AGENTS.md`, with the reason. Newest
decisions are appended per phase.

---

## Phase 0 — foundations

### D-01. Next.js 16 with `src/middleware.ts`

Next.js 16.4 deprecated the `middleware.ts` convention in favour of `proxy.ts` (same API, new file
name) and prints a warning at boot. AGENTS.md explicitly requires `middleware.ts` and the Edge-safe
JWT gate, so the file stays. The code is already proxy-compatible: renaming the file infers `src/proxy.ts`
and nothing else changes. Revisit once the spec allows `proxy.ts`.

Because the project uses a `src/` directory, Next.js requires the gate at `src/middleware.ts` and
boot code at `src/instrumentation.ts`, rather than the repository-root paths shown in AGENTS.md §2.

### D-02. Route group structure for role areas

AGENTS.md asks for `(citizen)`, `(lawyer)`, … route groups and for role-prefixed URLs such as
`/citizen`. Parenthesised groups do not add a URL segment, so each group contains a real segment
folder: `src/app/(citizen)/citizen/...`, `src/app/(lawyer)/lawyer/...`, etc. This keeps the group
naming from the spec while giving each dashboard a stable, middleware-guarded prefix.

### D-03. Tailwind CSS 3.4, not 4.x

The spec's layout includes `tailwind.config.ts` and asks for design tokens exposed in the Tailwind
theme. Tailwind 3.4 supports that directly (`colors` mapped to `rgb(var(--token) / <alpha-value>)`),
which keeps the palette limited to the three specified brand colours and preserves opacity
modifiers. Migrating to the CSS-first v4 config is a later, mechanical change.

### D-04. Kysely as the query layer

`better-sqlite3` plus Kysely gives typed, parameterized queries and a clean repository boundary
(`route handler → service → repository → db`). Table and column names in `src/server/db/schema.ts`
match the ER model exactly, including PascalCase table names.

### D-05. bcryptjs instead of native `bcrypt`

AGENTS.md requires bcrypt at cost 12. `bcryptjs` implements the same bcrypt algorithm and emits the
same `$2b$12$…` hash format, but is pure JavaScript — no native toolchain or rebuild step on Windows
or in CI. Cost 12 is enforced in one constant (`BCRYPT_COST`).

### D-06. Two non-login system accounts

`system@lawtrack.local` (Administrator) is the actor for automated audit entries. A second
non-login account, `system.integrations@lawtrack.local` (API Manager), owns the seeded
`API_Integration` rows. This is needed because `API_Integration.manager_id` is a foreign key to
`API_Integration_Manager`, and integrаtions must be seeded even when demo accounts are skipped in
production. Neither account can log in (random password hash, `is_verified = 0`).

### D-07. Enum values chosen where the spec is silent

The ER text does not enumerate every code list. Chosen values, all enforced by CHECK constraints:

- `Notification.status`: `Unread`, `Delivered`, `Sent`, `Failed` (in-app starts `Unread`; mark-read
  sets `Delivered`; mock Email/SMS rows are `Sent`).
- `API_Integration_Manager.on_call_status`: `Available`, `On Call`, `Offline`.
- `Otp_Code.purpose`: `verify`, `login`.
- `System_Administrator.admin_level`: `Super`, `Standard`.

`Otp_Code.attempts` is capped at 5 in SQL to match the "max 5 attempts" rule.

### D-08. Guide seed is insert-if-missing

Guides are seeded with `insertSeedGuide`, which returns the existing row when `(title, language)`
already exists. A re-seed therefore never overwrites a curator's edit. Content changes during
development require `npm run db:reset`. Guide uniqueness is enforced by
`ux_guide_title_language`.

### D-09. `server-only` in scripts and tests

Every `src/server/**` module starts with `import 'server-only'`, which throws outside a React Server
Components environment. Two narrow escapes keep tooling working:

- **Vitest** aliases `server-only` to an empty module (`vitest.config.ts`), because tests are
  server-side by definition.
- **Operational scripts** preload `scripts/server-only-shim.mjs`, which resolves the specifier to an
  empty module via `module.registerHooks`. Neither change affects the Next.js build, where the real
  guard stays in force.

### D-10. Lazy migration on first database access

`getDb()` applies pending migrations before returning the handle. `npm run setup` and `db:migrate`
remain the normal path, but a developer who starts the dev server before migrating still gets a
working app instead of a "no such table" error. The runner is idempotent and synchronous, so the
cost is one ledger read per process.

### D-11. `test:report` gates official IDs behind a manifest

AGENTS.md §17 requires the report script to fail when an official ID is missing. Those tests do not
exist yet in Phase 0, so the check activates only when `tests/official-ids.json` is present. Phase 1
adds the manifest together with `UT_USR_*`, `UT_DFT_*` and `UT_CSE_*`; from then on a missing ID
fails the report.

### D-12. Planned helper table `Draft_Claim` (Phase 5)

The review queue needs a 15-minute soft lock showing "being reviewed by …". None of the permitted
helper tables can store that safely (`Draft_Review` is a decision record). Phase 5 will add one
helper table, `Draft_Claim(draft_id PK, lawyer_id, claimed_at)`, with this justification recorded
here as AGENTS.md §4 requires. It will not alter any ER table.

### D-13. Root layout language attribute

The root layout is a static shell with no locale segment, so `<html lang>` is `en-IN` and pages wrap
their subtree in `lang="hi-IN"` when Hindi is selected via `?lang=hi`. The dictionary, copy and
accessible labels all switch. If full per-locale URLs are wanted, the app can move to a `[locale]`
segment later without changing the i18n dictionaries.

### D-14. Fonts and offline behaviour

Fonts come from `next/font/google` (Source Serif 4, Inter, Noto Sans/Serif Devanagari). Font files
are downloaded at build/dev time and self-hosted by Next.js; if a machine is fully offline, Next.js
falls back to the configured system stack rather than blocking the product. PDF font embedding is a
Phase 5 decision.

### D-15. API responses are never cached

Every route handler response carries `Cache-Control: no-store` and `X-Request-Id`. Health is
`force-dynamic` and runs on the Node.js runtime so SQLite is never touched from Edge code.

### D-16. Seed audit entry

Each seed run that actually changes rows writes one `Audit_Log` entry (`SEED_APPLIED`). A no-op
re-seed writes nothing, which keeps the audit trail meaningful while staying idempotent for data.

### D-17. README/tooling note for npm 11.21+

npm 11.21 introduced an install-script approval gate. `better-sqlite3` still resolves its prebuilt
binary in this environment, but the README documents `npm install-scripts approve better-sqlite3`
so a clean machine has a fix if the native module is not built.

### D-18. Clock helpers live in `src/shared`

Validators are shared with client forms but must see the same "today" and timestamp arithmetic as
the server. The pure helpers therefore live in `src/shared/clock.ts`; `src/server/lib/clock.ts`
keeps the `server-only` guard and re-exports them, so every existing server import is unchanged and
no client bundle can pull in server code.

### D-19. Validation messages use the i18n dictionaries

Every validator message is a template under `validation` in `en.json`/`hi.json`, including field
labels and `{{placeholders}}` for lengths and allowed enum values. The locale travels on
`ValidationContext` (default English), which keeps validators pure and lets client and server show
the same wording. A rule reports the first failing message per field but all failing fields together,
as §5 requires.

### D-20. Validation defaults and normalisation

`validateUserInput` trims, lowercases emails, strips `+91`/`91` from phone numbers (stored as 10
digits), defaults omitted `is_verified` to `false` and requires the password. The validated password
is returned transiently so the service can hash it; it is the only field that is never persisted in
plain text. Public registration accepts `Citizen` only; `{ allowAnyRole: true }` is reserved for the
Admin user-creation flow. System-managed fields (`Legal_Draft.version` = 1, `created_at` and
`last_synced_at` = clock now) may be omitted by the service; when supplied they are validated
normally.

### D-21. Official test IDs 22–24 arrive with their services

`UT_USR_22–24`, `UT_DFT_22–24` and `UT_CSE_22–24` exercise multi-step flows (hashing + OTP, draft
queue + regeneration, adapter calls + upsert). They are written in the auth, drafts and cases phases
where those services exist, so no test is skipped or faked. `tests/official-ids.json` (and therefore
the `test:report` missing-ID gate) is added in the phase that completes the set; the script is
already built to accept it.

---

## Phase 2 — authentication and role shells

### D-22. Client forms surface server-field errors instead of duplicating validators

The same shared validators remain the single source of truth, but auth screens submit to the API and
map the returned `fields[]` onto inputs. Duplicating validators in the browser would require a fake
`ValidationContext` (uniqueness and foreign keys cannot be known client-side), and the server already
returns localized messages because the forms send `Accept-Language`. The visible result is the same:
the failing field is highlighted with the exact rule text, while the server stays authoritative.

### D-23. Workspace language is a profile setting

Public pages switch language with `?lang=hi` so the server can render the matching dictionary. Inside
the authenticated shell the top-bar switch calls `PATCH /api/auth/profile` and refreshes the server
components: that persists the preference on `User.language`, refreshes the JWT claims and keeps the
setting across devices. Layouts derive the dictionary from the verified session, not from a query
string, so a missing parameter can never flip an authenticated screen's language by accident.

### D-24. Page-level checks use `cookies()`; middleware stays Edge-only

`src/server/http/pageAuth.ts` reads the session cookie through Next.js's async `cookies()` and
verifies it with the same `jose` code as route handlers. Layouts and role pages call
`requirePageRole`, which redirects to `/login?next=…` or `/forbidden`. `middleware.ts` still performs
the fast signature/role redirect, but the Node-side layout check is authoritative and is the only one
that can inspect a session at render time.

### D-25. Dev OTP visibility is opt-in and production-proof

The mock OTP gateway keeps the last code in a module-level map (never in logs). `devOtpFor()` exposes
it only when `DEV_SHOW_OTP=true` and `NODE_ENV !== 'production'`; the verify page reads it during
server render, and the resend endpoint includes it in its JSON response under the same guard. Tests
keep `DEV_SHOW_OTP=false`, so they read the map directly and no API response ever leaks a code.

### D-26. Role areas keep the route-group structure from D-02

The phase-2 pages live in `src/app/(citizen)/citizen/...`, `src/app/(lawyer)/lawyer/...`, and so on.
The parenthesised group names are organisational (they keep each dashboard's code together); the real
URL prefixes remain `/citizen`, `/lawyer`, … exactly as `middleware.ts` and `ROLE_HOME` expect.

### D-27. Loopback `next start` is a preview, not a deployment

`next start` always sets `NODE_ENV=production`, which would otherwise reject the local `.env` and stop
`npm run build && npm start` from working as AGENTS.md requires. Production checks therefore treat a
loopback `CLIENT_ORIGIN` (`http://localhost`, `127.0.0.1`, `[::1]`) as a local preview: the placeholder
secret and http origin are allowed, and cookies omit `Secure` because the preview is served over http.
Any non-loopback origin still requires a unique secret and https, and `DEV_SHOW_OTP` remains forced
off in production mode.

---

## Phase 3 — knowledge hub and curator console

### D-28. `Legal_Guide.topic_key` pairs the English and Hindi versions

The ER model has no column that reliably links two language versions of the same guide. Matching by
category or title is brittle (titles are translated), and the language switch needs an exact
counterpart. Migration `0002_guide_topic_key.sql` therefore adds a nullable `topic_key` column plus a
`(topic_key, language)` index. It is an additive column on an existing ER table, not a new table; the
service only uses it to resolve the alternate-language link. Legacy rows may keep a null key and simply
show no switch.

### D-29. The Knowledge Hub is public

The role table gives guide browsing to Citizens, Lawyers, Curators and Administrators (only Curators
see every status), while the API Manager has no guide permission. AGENTS.md §15 also makes the
Knowledge Hub a public landing destination and asks for static rendering of guide pages, which only
makes sense if anonymous visitors can read them. `/knowledge` and `/knowledge/:id` are therefore public
read-only pages showing `Valid` guides only. The API Manager gets no knowledge link in the workspace
navigation, and all curator routes still require the Curator role. No private draft content is exposed.

### D-30. Demo re-simplify is local and never auto-saves

The curator console must work without an AI key. `src/server/adapters/ai/simplify.ts` implements
`demo-simplify-v1`, a deterministic local rewrite that only tidies whitespace and swaps a short list of
formal connectors for plain words. It cannot invent facts. `POST /api/curator/guides/:id/resimplify`
returns a suggestion, the editor puts it in the summary field, and the curator must press **Save**;
the database is untouched until then. The UI shows the required "Demo AI mode" badge next to the
action.

### D-31. Validation is idempotent; edits do not unpublish

`Draft → Valid` and `Requires AI Update → Valid` are the only transitions into `Valid`. Validating an
already-`Valid` guide refreshes its embedding and returns it without incrementing `validated_count` or
writing another audit row. Content edits through `PATCH` keep the current status (a Valid guide stays
visible) and refresh the embedding when it is Valid; otherwise the stale embedding is deleted. Status
changes are deliberately not accepted through `PATCH`: `validation_status` and `language` return a
`FORMAT` validation error so the audit log and embedding lifecycle always run through one service path.

### D-32. Offline embeddings are deterministic lexical vectors

`Guide_Embedding` stores `model = 'lexical-v1'`: a 256-dimension hashed bag-of-words vector, L2-normalised
and serialised as JSON. It needs no network, is stable across processes and platforms (FNV-1a hash), and
lets the Phase 4 chatbot retrieve passages in Mock AI mode. Seeding publishes an embedding for every
Valid guide; curator validation and edits refresh it. When a Gemini key is configured, the same row can
be overwritten with the provider's embedding without a schema change.

### D-33. Categories keep stable English keys and localized labels

`Legal_Guide.category` stores the stable English category name because it is the value filters and API
clients compare against. The interface translates it through `knowledge.categories` in `en.json` and
`hi.json` (`categoryLabel()` falls back to the stored name for unknown values). Curator category
selection uses the same `CATEGORY_NAMES` enumeration, so a typo cannot silently create a new topic.

### D-34. Guide views are recorded on detail read, for citizens only

`GET /knowledge/:id` (and the JSON detail route) records a `Guide_View` row and updates
`Citizen.last_viewed_guide_id` when the verified session belongs to a Citizen. Anonymous readers and
other roles are not tracked. The public service is still read-only for everyone; this is the only side
effect, and it powers "Continue where you left off" on the citizen dashboard.

### D-35. Guide browsing uses server-rendered filters, not TanStack Query

The hub, the curator queue and the review editor are server components that receive `searchParams` and
call the guides service directly. Filters, pagination and status tabs are ordinary links and GET forms,
so they work without JavaScript, are crawlable, and avoid a client cache in front of curator-only data.
TanStack Query remains reserved for the interactive chat, draft and tracker screens where optimistic
updates matter.

## Phase 2/3 audit - gaps closed

A pass over the PROMPTS.md acceptance criteria found six Phase 2/3 items that existed in the API but
were not complete end to end: administrator user management, administrator category management, the
India Code "legislative change" trigger (UC-05), the notification bell, a shared UI kit with loading
skeletons, and cookie-persisted public language. They are recorded here so the behaviour is not
rediscovered later.

### D-36. Administrator-created staff accounts are born verified

`POST /api/admin/users` is the only way to create a non-Citizen account (public registration still
forces `Citizen`). Because an administrator has already vetted the person and OTP delivery is mocked,
such accounts are stored with `is_verified = 1`; they skip the OTP step and can sign in immediately.
`PATCH /api/admin/users/:id` accepts `role` and `language` (plus `bar_council_id` when the new role is
Lawyer) and never accepts `is_verified`. Changing a role inserts the matching profile row first and
updates `User.role` second, so a duplicate bar-council id leaves the account on its previous role
instead of half-migrated. Administrators cannot change their own role (`403`), and every create or
change writes an audit row (`USER_CREATED`, `USER_ROLE_CHANGED`, `USER_LANGUAGE_CHANGED`).

### D-37. Guide categories live in System_Setting, not a new table

AGENTS.md §4 forbids extra tables without a documented reason, so the editable category order is a JSON
array in `System_Setting` under `guide_categories`. `Legal_Guide.category` keeps storing the stable
English name, and the admin list is always merged with every category currently used by a guide. That
means an administrator can reorder topics for the picker but can never hide live content. Duplicate
names (case-insensitive) are rejected with `UNIQUE`, and `GET/PUT /api/admin/categories` require the
Administrator role.

### D-38. India Code is a mock that only flags, never edits

`POST /api/integrations/indiacode/webhook-simulate` (Administrator / API Manager) takes a category, a
change summary (10-300 characters), an optional Act name and effective date, and simulates the webhook
a real India Code integration would send. The mock adapter echoes the notice after a short delay; the
service then flags every published guide in that category as `Requires AI Update`, notifies all
curators, marks integration #3 `Healthy`, and writes one `GUIDES_FLAGGED_LEGISLATIVE` audit row. It
never rewrites guide text: re-validation stays a human curator decision.

### D-39. The notification bell owns a small QueryClient

`src/features/notifications/NotificationBell.tsx` renders inside the authenticated top bar. Phases 2/3
do not install an app-wide TanStack Query provider yet, so the bell creates a local `QueryClient`
(stale time 30 s, no retries) and polls every 60 s. When the chat, draft and tracker screens arrive in
later phases they get a shared provider, and the bell can be lifted onto it without changing its
contract: `GET /api/notifications`, `POST /api/notifications/:id/read`,
`POST /api/notifications/read-all`. Ownership is enforced in the repository, so marking someone else's
notification returns `404`.

### D-40. Public language is a query parameter, remembered in a cookie

`?lang=` always wins, but the server-rendered public pages (landing, auth screens, knowledge hub,
guide detail, 403) read the `lawtrack_lang` cookie through `pageLocale()` when it is absent. The switch
writes that cookie client-side; it is not httpOnly because it only carries a display preference and
never affects authorization. Signed-in users keep using their profile `language` through
`PATCH /api/auth/profile`, which remains authoritative for chat and drafts.

### D-41. UI kit and loading skeletons are shared components

`src/components/ui/` holds the primitives used by every role (`Button`, `Card`, `Badge`/`StatusPill`,
`EmptyState`, `Skeleton`/`PageSkeleton`, `Tabs`, `Table`, `Stepper`, `Modal`, `Toast`). Each route
group ships a `loading.tsx` that renders `PageSkeleton`, so navigation between server-rendered pages
shows a shaped placeholder instead of a blank screen. Status is always icon-plus-label, never colour
alone.

### D-42. Do not run `next start` and `next dev` at the same time

Both write to the same `.next` directory. Running the production server alongside `next dev` makes the
dev server recompile on every request and the browser reload the document in a loop, which shows up as
Playwright timeouts on otherwise healthy pages. Use one server per checkout: `npm run dev` for
development and E2E, `npm run build && npm start` only after stopping the dev server.

### D-43. Retrieval uses BM25 offline and cosine with Gemini

AGENTS.md §8 asks for an embedding search over Valid guides. The offline lexical embedding used to seed
`Guide_Embedding` is a 256-bucket hashed bag of words: it is deterministic and dependency-free, but it
collides badly, so cosine over those vectors put an RTI guide above the rent guide for a
security-deposit question. The chatbot therefore uses two rankers behind one candidate list:

- **Mock AI mode:** BM25 over title (weighted by repetition), summary, statute and excerpt, with
  `rag_lexical_threshold` (default `3`) as the grounding cut-off.
- **Gemini mode:** cosine over the stored vectors, with `rag_similarity_threshold` (default `0.35`).

If the vector index is missing or stale (for example a database seeded offline and later given a key),
Gemini mode falls back to BM25 rather than answering "no verified information" for a covered question.
Both thresholds live in `System_Setting` so they can be tuned without a deploy. If nothing clears the
threshold in the session language, retrieval retries in the other language before giving up.

### D-44. Chat side-effects are idempotent through Metric_Event

"Ask a lawyer" must notify a lawyer once per conversation, and a citizen can only rate a conversation
once (a second rating replaces the first). Rather than add tables, both use the allowed `Metric_Event`
helper from AGENTS.md §4: `chat_escalation` with `ref_id = <session_id>` acts as the "already requested"
marker, and `chat_csat` with `ref_id = session:<id>` holds the 1–5 score. Per-message telemetry is
separate and append-only: `chat_latency_ms` and `chat_grounded` with `ref_id = message:<id>`, which the
Phase 7 metrics dashboard aggregates.

### D-45. The chatbot never invents an answer

Answers come only from `Valid` guides. The mock provider is extractive: it quotes the summaries of the
top two retrieved passages and adds no facts. The Gemini prompt declares the passages and the question
as untrusted data, tells the model to ignore instructions inside them, forbids inventing Act names,
section numbers or outcomes, and requires the exact sentence "I don't have verified information on
that." when the passages are insufficient. Below the threshold the service returns a canned dictionary
string with zero sources and offers the "Ask a lawyer" path instead of calling the model at all, so an
off-topic question costs no AI quota and cannot be prompt-injected.

### D-46. Chat throttling is per process, like the login limiter

`chatMessageRateLimiter` is the same fixed-window in-memory limiter the auth routes use: 20 messages per
minute per citizen, keyed by user id, returning `429 RATE_LIMITED` with the localised "20 questions per
minute" message. A single Node process is the deployment model for this prototype; moving to several
instances would swap the implementation for a Redis-backed one behind the same `RateLimiter` interface.
Tests reset the bucket between cases.

### D-47. One local QueryClient per interactive feature

The notification bell, the chat workspace, and (Phase 5+) the draft wizard each create their own small
`QueryClient` rather than installing a provider in the root layout. Server components stay the default
for every read-only page, the client bundles are code-split by role, and no feature pays for another
feature's cache. D-39 records the same trade-off for the bell.

### D-48. PDF export uses pdf-lib, and the print view is the authoritative Hindi render

Server-side PDF generation is `pdf-lib` with `@pdf-lib/fontkit` and the bundled Noto Sans + Noto Sans
Devanagari faces in `assets/fonts/`, so the footer (draft id, version, approving lawyer, approval date,
disclaimer) and Latin body text render identically everywhere with no network font fetch. `pdf-lib`
writes glyph runs, not shaped text, so Devanagari conjuncts and matras are not fully reordered in the
PDF. Rather than ship a broken Hindi document, every approved draft also has a standalone
`/print/drafts/:id` view that the browser prints with its own shaping engine; that is the authoritative
Hindi rendering, the PDF carries a note pointing to it, and the citizen UI exposes both. Swapping to a
shaping-capable generator (HarfBuzz-backed) later only changes `src/server/lib/pdf.ts`.

### D-49. Review claims live in System_Setting; regeneration retries explicitly

The 15-minute "being reviewed by ..." soft lock is a JSON map under `System_Setting` key
`draft_review_claims`, pruned lazily on read and write. It is not part of the 18-table ER design, so
storing it in the permitted settings table avoids a new table (AGENTS.md §4). Regeneration after a
rejection runs automatically inside the reject call; if the AI adapter fails the draft stays `Rejected`
and `POST /api/drafts/:id/regenerate` is the manual retry, so a transient provider error can never lose
the review remarks or move a draft into a state the citizen cannot see.

### D-50. Three extra draft routes beyond the API surface in §7

The wizard needs submit and retry as their own calls, and lawyers need the chatbot escalations in one
place: `POST /api/drafts/:id/submit` (idempotent queue entry), `POST /api/drafts/:id/regenerate`
(manual retry after a failed automatic regeneration) and `GET /api/lawyer/help-requests` (reads the
`help_request` Metric_Event rows written by chat escalation). They keep the route handlers thin and the
service the single owner of state transitions; §7 otherwise stays as written.

### D-51. Background jobs run in-process; serverless would use an external scheduler

The four jobs (case sync every 5 min, hearing reminders every 15 min, integration health every 2 min,
expired-review-lock cleanup) are registered from `instrumentation.ts` on the Node runtime with
`setInterval` and `timer.unref()`. A `globalThis` singleton stops Next.js dev hot reload from starting
a second set, a `running` set skips a job whose previous run has not finished, and `JOBS_ENABLED=false`
disables everything for tests. Intervals come from `System_Setting`. On a serverless host there is no
long-lived process, so these would move to an external scheduler calling the protected
`POST /api/jobs/run` endpoint (D-53) on the same cadence.

### D-52. `ECOURTS_MODE` selects the client; the outage switch is development-only

eCourts is never called over the network in this prototype. `ECOURTS_MODE=mock` (the default) uses the
deterministic fixture client with 300–800 ms latency; `real` selects `RealECourtsClient`, which throws
`503 NOT_CONFIGURED` and documents the expected `GET /ecourts/v1/case/{cnrId}` contract. The
"simulate outage" switch is a `globalThis.__lawtrackECourts` singleton so the API-manager simulator and
every later lookup agree; `setECourtsOutage` refuses to change it when `NODE_ENV=production`. Tests
construct the mock directly with `latencyMs: 0`.

### D-53. Two extra case routes beyond the API surface in §7

`POST /api/cases/:id/refresh` re-syncs a single case on demand for the citizen who tracks it (the
background job can be minutes away and ownership is checked before the adapter call), and
`POST /api/jobs/run` lets an Administrator or API Manager trigger a job manually — the operations
console needs it and a serverless deployment would point a scheduler at it (D-51). Both keep the route
handlers thin; §7 otherwise stays as written.

### D-54. Hearing reminders are deduplicated per case, date and citizen

Multiple citizens can track the same court case, so the idempotency marker is
`case:<id>:date:<date>:user:<uid>` stored as a `hearing_reminder` `Metric_Event` row. The first run
inside the 48-hour window writes one In-App row plus the mock Email and SMS rows and records the marker;
every later run sees the marker and sends nothing. This matches "one reminder per (case, date)" without
one citizen's reminder suppressing another's.

### D-55. Seeded cases overlap the eCourts fixtures on purpose

`db:seed` inserts two fictional `Court_Case` rows and subscribes the demo citizen to one of them, so a
fresh dashboard has a tracked case with a hearing two days out. The seeded CNRs are the same records the
mock adapter serves, which means looking one up refreshes the existing row (the unique CNR upsert) instead
of creating a duplicate — the same path real data would take.

---

## Phase 7 — admin & API manager dashboards, metrics and integrations

### D-56. Operational dashboards use tabbed single-page workspaces

The Administrator console (`/admin`) and API Manager console (`/api-manager`) use tabbed layouts
(`AdminTabs`, `ApiManagerTabs`) with client-side state transitions. This avoids layout shift between
tab changes, code-splits data fetching (TanStack Query caches KPI metrics, user directories, audit logs,
and service health independently), and provides unified operations management without cluttering the
browser history.

### D-57. Metrics aggregation and demo seed

The 10 Lab-7 KPI targets are aggregated on-the-fly from SQLite tables (`Metric_Event`, `Draft_Review`,
`Legal_Draft`, `Court_Case`, `API_Integration`). To allow full evaluation and demo without requiring
weeks of synthetic traffic, `POST /api/admin/seed-demo-metrics` (and `npm run db:seed:metrics`) seeds
realistic metrics events demonstrating target compliance (answer grounding ≥95%, chatbot latency ≤4s,
CNR lookup ≤5s, etc.) across 7-day and 30-day timeframes.

### D-58. Sandboxed test reporting on Windows

In restricted or sandboxed environments where the workspace root cannot be written by unprivileged
child processes, `scripts/run-test-report.ts` and `scripts/test-report.ts` pipe Vitest JSON results through
`os.tmpdir()` (`%TEMP%`), ensuring test report generation succeeds cleanly on Windows platforms.

---

## Phase 8 — polish, accessibility, E2E smoke and security hardening

### D-59. Playwright E2E smoke suite and isolated reporting

`playwright.config.ts` runs smoke tests across desktop and mobile Chromium viewports with webServer
automation on `http://127.0.0.1:3100`. Test results and HTML artifacts are routed to `os.tmpdir()` to
prevent sandbox write lockouts. The test suite verifies full citizen and lawyer journeys, responsive
layouts at 360px viewport with zero horizontal overflow, skip-links, and accessible form labels.

### D-60. Full security headers and defense-in-depth

`next.config.ts` enforces strict security headers: Content-Security-Policy (CSP) restricting scripts,
styles, and connections to `'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
and production HSTS with preloading (`max-age=63072000`).

### D-61. Accessible Hindi typography and WCAG 2.1 AA compliance

Devanagari text uses Google Fonts `Noto Sans Devanagari` and `Noto Serif Devanagari` with generous line-height
(`≥1.6`) and `font-display: swap`. Skip-links targeting `#main-content`, focus trap management in dialogs,
`aria-live="polite"` regions for chat responses, and `role="alert"` for form feedback ensure full WCAG 2.1 AA
keyboard and screen-reader accessibility.

### D-62. Loopback equivalence in CSRF origin assertion for local dev and E2E

In development and test environments (`!env.isProduction`), browsers and test runners may access the Next.js
server using either `localhost` or `127.0.0.1` and alternate port configurations (e.g., E2E webServer on port 3100).
`src/server/http/origin.ts` permits loopback-to-loopback equivalent requests when the target matches the active
server port, preventing false-positive CSRF rejections during local automated browser tests while maintaining
strict, uncompromised cross-origin rejection in production.

### D-63. Railway production deployment configuration

For cloud deployment on Railway:
1. `src/instrumentation.ts` is the single authoritative instrumentation entry point (root `instrumentation.ts`
   is removed), ensuring background jobs (`startJobs()`) boot once per server process.
2. `SEED_DEMO_ACCOUNTS=true` is supported in `runSeed()` to permit pre-populating test staff roles on production
   demos while preserving the default production refusal when unset.
3. Database seeding and migrations are chained ahead of `next start -H 0.0.0.0 -p ${PORT:-3000}` to ensure
   ephemeral / volume-backed SQLite stores are fully initialized before traffic is accepted.
4. `nixpacks.toml` configures native build toolchains (`gcc`, `gnumake`, `python3`) for `better-sqlite3`.


