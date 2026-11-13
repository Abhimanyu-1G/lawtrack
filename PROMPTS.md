# LawTrack — OpenCode prompts

## How to use
1. Create an empty folder `lawtrack/`, put **AGENTS.md** in its root, open the folder in OpenCode.
2. (Optional) copy your SRS PDF and the test-case Excel into `lawtrack/docs/source/` for reference. AGENTS.md already contains everything needed, and where it differs from the SRS, **AGENTS.md wins**.
3. Paste the prompts below **one at a time, in order**. Wait until each phase finishes with green tests and a commit before sending the next.
4. If a phase goes wrong, paste the "Fix-up prompt" at the bottom.
5. Put your Gemini key in `.env` (`GEMINI_API_KEY`, and set `GEMINI_MODEL` / `GEMINI_EMBEDDING_MODEL` to current model IDs from Google's docs). Without a key the app runs in mock-AI mode.

---

## Phase 0 — Foundations (paste this first)

```
Read AGENTS.md completely, then confirm in 10 lines or fewer what you will build and the order you will build it in.
Do not write code until you have done that.

Then do Phase 0:
1. Scaffold a single Next.js app (latest stable, App Router, TypeScript strict, Tailwind) exactly as in AGENTS.md §2 — NOT Vite and NOT a separate Express server —
   with ESLint + Prettier, Vitest, Playwright config, `middleware.ts`, `instrumentation.ts`, and scripts (setup, dev, build, start, test, test:api, test:e2e, test:report, typecheck, lint, db:reset).
   Use `import 'server-only'` in src/server/**. Run DB code only on the Node.js runtime.
2. Create .env.example and a Zod-validated config loader that fails fast on bad env. Include: PORT, CLIENT_ORIGIN, JWT_SECRET, DB_PATH,
   GEMINI_API_KEY, GEMINI_MODEL, GEMINI_EMBEDDING_MODEL, RAG_TOP_K, JOBS_ENABLED, DEV_SHOW_OTP, NODE_ENV.
3. Write SQL migrations for ALL 18 tables plus the four allowed helper tables and the one added column, with foreign keys, CHECK constraints
   for enums/lengths, and unique indexes (AGENTS.md §4). Add a repository/query layer and an in-memory DB factory for tests.
4. Write the idempotent seed script: API_Integration rows 1–4, the System user, demo accounts (refuse in production), and a first batch of
   10 guides. (The full 30-guide set comes in Phase 3.)
5. Implement lib/clock.ts (injectable, Asia/Kolkata "today"), logger (pino with redaction), central error handler with the error shape from §5,
   requestId middleware, GET /api/health.
6. Create docs/DECISIONS.md and a README skeleton.

Acceptance: `npm run setup` works from a clean clone; `npm run dev` serves the app and /api/health (a Next.js route handler); migrations apply twice without error;
typecheck, lint and test pass. Commit as "phase 0: foundations".
```

## Phase 1 — Shared validation + User module (test-first)

```
Phase 1 — validation core and the User module. Follow AGENTS.md §5, §6 (Account), §17 (UT_USR_01–24 plus the USR extras).

1. In src/shared/validation implement pure, framework-free validators for User, Legal_Draft and Court_Case with the ValidationContext
   (clock, exists, isUnique) and the error codes/shape from §5. Implement ALL THREE entities now because later phases depend on them.
2. Write the Vitest tests FIRST for every UT_USR_* ID and the USR extras, with the ID at the start of each test title. Then implement until green.
3. Implement the User service: register (Citizen only), password hashing (bcrypt cost 12), OTP issue/verify (hashed, 10 min expiry, 5 attempts,
   resend cooldown), login with the exact messages in §6, logout, updateProfile, admin createUser for the other four roles with their role-profile rows.
4. Implement the OtpGateway mock adapter (§11) and store the Notification rows.

Acceptance: UT_USR_01–24 and all USR extras pass; validators for Legal_Draft and Court_Case already have their UT_DFT_01–21 and UT_CSE_01–21 tests
written and passing too (field-level rules only). No UI yet. Run typecheck, lint, test. Commit "phase 1: validation + user module".
```

## Phase 2 — Auth API, RBAC, and the app shell

```
Phase 2 — authentication API, RBAC, and the front-end shell. Follow AGENTS.md §3, §6, §7, §15, §16.

Server: auth route handlers (register, verify-otp, resend-otp, login, logout, me, profile), JWT (jose) in httpOnly cookie, CSRF double-submit token + Origin check,
rate limits, withAuth/withRole wrappers with object-level ownership helpers, Edge-safe middleware.ts for page redirects (no DB access in middleware), admin user management routes, audit logging for privileged actions.
Route-handler tests (call handlers directly in Vitest): register → OTP → login, unverified login blocked, citizen calling a lawyer route gets 403.

Client: set up the design system FIRST — the ivory white / coal black / royal blue tokens from §15 as CSS variables + Tailwind theme (no other brand colours), light/dark, fonts via next/font (Source Serif 4, Inter, Noto Sans Devanagari),
and a small UI kit (Button, Input with inline field errors, Select, Card, Badge/StatusPill, Modal, Toast, Skeleton, EmptyState, Tabs, Table, Stepper).
Then build: i18n (en/hi, language switch persisted in a cookie so server components render the right language), public landing page, register, OTP, login, role route groups with their own layout shells (sidebar → bottom tab bar on mobile),
notification bell (stub), not-found/error/forbidden pages, and a role-redirect system (middleware.ts + authoritative server-side check in each role layout). Wire API errors' fields[] to inline form errors.

Acceptance: all five demo accounts log in and land on their own placeholder dashboard; a new citizen can register and verify via the dev OTP banner;
the UI is responsive at 360 px, keyboard-navigable, and AA-contrast in both themes. All tests green. Commit "phase 2: auth + shell".
```

## Phase 3 — Knowledge Hub and Curator console

```
Phase 3 — legal guides (UC-01), curator validation (UC-04), legislative-change hook (UC-05). Follow AGENTS.md §4 (seed), §6 (Guides), §7, §11, §15.

1. Expand the seed to at least 30 guides (English + Hindi pairs for ≥15 topics) with accurate, conservative plain-language summaries, real Act/section
   references in source_statute and a short source_excerpt. Mark most Valid, 3 Draft, 2 Requires AI Update. Keep wording non-advisory and add "what to do next" tips.
2. Server: guide listing/search/category endpoints (Valid-only for citizens), guide detail that records Guide_View and updates Citizen.last_viewed_guide_id,
   admin-managed categories, curator endpoints (edit, resimplify with the AI provider's simplifyText, validate, flag), validation side-effects
   (curator_id, last_updated, validated_count++, Audit_Log, embeddings refresh), and the indiacode webhook-simulate that flags matching guides and notifies curators.
3. Implement the AiProvider interface with MockProvider and GeminiProvider (AGENTS.md §10) — embeddings + simplifyText now; the rest in later phases.
   Verify the current Gemini SDK usage in Google's official docs before writing the provider.
4. Client: Knowledge Hub (category tiles, search with highlighting, guide page with language switch, validated badge, source link, print/share),
   citizen dashboard "continue where you left off", and the Curator console (status filters, side-by-side original vs plain summary editor,
   Re-simplify with AI, Validate, Flag).

Acceptance: citizens never see non-Valid guides; viewing a guide updates last-viewed; curator validation changes status and writes an audit entry;
the simulate webhook turns matching guides into Requires AI Update and the curator sees a notification. Add API tests for all of this. Commit "phase 3: guides + curator".
```

## Phase 4 — RAG chatbot

```
Phase 4 — AI legal chatbot (UC-02, UC-06). Follow AGENTS.md §8, §10, §13, §14.

1. Embedding index over Valid guides (per language), cosine retrieval with RAG_TOP_K and a similarity threshold, rebuilt when a guide is validated/edited.
2. Chat service + routes: sessions, messages, end session, history list + search, rating (1–5, stored as Metric_Event), escalate-to-lawyer (notifications to Available lawyers).
3. Prompt construction with strict grounding rules and prompt-injection defence (delimited untrusted passages and user text). Ungrounded questions get the
   "no verified source" answer with empty sources and the Ask-a-lawyer option. Store sources_cited as compact refs.
4. Record latency + grounded/ungrounded Metric_Events; map Gemini failures/timeouts to friendly errors and to API_Integration(2) status/error_count.
5. Client chat UI: thread with typing indicator, source chips linking to guides, suggested prompts, history drawer with search, language switch,
   rating prompt, disclaimer, safe markdown rendering (sanitize). ARIA live region for new messages.
6. Tests with the MockProvider: a question covered by a guide cites that guide; an off-topic question yields no sources; a prompt-injection attempt in the
   question does not change behaviour; rate limit returns 429; ownership checks on sessions.

Acceptance: works fully offline in mock mode and with a real key; every answer shows sources or the no-source notice. Commit "phase 4: chatbot".
```

## Phase 5 — Drafts, lawyer review loop, PDF

```
Phase 5 — legal drafts with human-in-the-loop review (AGENTS.md §6 Legal_Draft, §9, §13, §17 UT_DFT_22–24 and DFT extras).

1. Write the tests FIRST: UT_DFT_22, UT_DFT_23, UT_DFT_24 and the DFT extras (invalid transitions, reject without remarks, ownership, AI failure saves nothing, idempotent submitForReview).
2. Implement the draft state machine and service (createDraft, submitForReview, regenerate, approve, reject, exportPDF), the AiProvider generateDraft/regenerateDraft
   methods (both providers), Draft_Review records, notifications to lawyers/citizens, 15-minute soft-lock claiming, and Audit_Log entries.
3. Citizen UI: draft wizards for Complaint, RTI and Legal Notice (profile prefill, autosave, character counter against the 5000-char limit, review step),
   status stepper, list of own drafts, approved-draft view with PDF download. Citizens must never see unapproved text.
4. Lawyer UI: shared queue (type, age, 24-hour SLA timer), split review screen (form data | generated text | previous remarks), approve/reject modal with required remarks
   (≥10 chars), availability switch, "Help requests" list from chatbot escalations.
5. PDF: server-side with bundled fonts that render Hindi correctly; footer with draft id, version, approving lawyer, approval date, disclaimer.

Acceptance: end-to-end flow works — submit → lawyer rejects → auto-regeneration (version 2) → lawyer approves → citizen downloads PDF — and UT_DFT_01–24 plus extras all pass.
Commit "phase 5: drafts + lawyer review".
```

## Phase 6 — Court case tracking, notifications, background jobs

```
Phase 6 — CNR case tracking (UC-03). Follow AGENTS.md §6 Court_Case, §11, §12, §13, §17 UT_CSE_22–24 and CSE extras.

1. Write the tests FIRST: UT_CSE_22, 23, 24 (use an adapter spy to prove zero calls for an invalid CNR) and the CSE extras.
2. Implement the ECourtsClient interface, the deterministic MockECourtsClient (≥12 fixture CNRs incl. stale date, missing date, Disposed, not-found, always-timeout,
   300–800 ms latency, outage toggle) and the RealECourtsClient stub with documented contract.
3. Case service: validateCNR, fetchByCNR with 15-minute cache and upsert, simplified order summaries via the AI provider, auto-subscribe, unsubscribe, refreshFromAPI,
   API_Integration status/error accounting (Healthy/Degraded/Down) exactly as specified, stale-data fallback.
4. Background jobs started from instrumentation.ts (singleton, no duplicates in dev): case sync, 48-hour hearing reminders (deduplicated per case+date), health checks, lock cleanup — idempotent, non-overlapping, JOBS_ENABLED switch, manual trigger.
5. Notifications: full In-App experience (bell, list, mark read → Delivered) plus mock Email/SMS rows for the events in §13.
6. Client: case tracker page (CNR mask + format hint, timeline of hearings with plain-English orders, status badge, "next hearing in N days", subscribe toggle,
   stale-data banner, friendly not-found/timeout states) and the citizen dashboard's tracked-cases widget.

Acceptance: UT_CSE_01–24 plus extras pass; looking up the same CNR twice never duplicates; simulating an outage degrades the integration and the UI shows the stale banner;
reminders fire once. Commit "phase 6: case tracking".
```

## Phase 7 — Admin and API Manager dashboards, metrics

```
Phase 7 — operations consoles. Follow AGENTS.md §3, §7, §12, §14, §15.

1. Admin: users table (create other-role accounts, change role, with audit), settings editor (sync interval, OTP expiry, AI on/off), category management, audit-log viewer
   with filters + CSV export, platform health overview.
2. API Manager: integration cards (status pill, last sync, error count), Check now, Retry sync, sync-log view (from Audit_Log/Metric_Event), dev-only outage simulator,
   manual job triggers, an indiacode webhook-simulate button.
3. Metrics: implement GET /metrics/summary for all ten Lab-7 metrics with 7/30-day ranges and compute pass / at-risk / fail against the targets. Build the dashboard with
   KPI cards, small trend sparklines and clear empty states. Add a "Load demo metrics" script so demos are not blank.
4. Permission tests: each role can reach only its pages and endpoints.

Acceptance: every capability in the AGENTS.md §3 matrix works from the UI for the correct role and is blocked for the others. Commit "phase 7: admin + api manager".
```

## Phase 8 — Polish, accessibility, hardening, documentation

```
Phase 8 — make it feel finished. Follow AGENTS.md §15, §16, §17 (test report), §18 (definition of done).

1. UI polish pass over every screen: consistent spacing and type scale, empty/loading/error states, micro-interactions ≤200 ms honoring reduced motion, favicon + OG tags,
   print styles for guides, dark mode checked screen by screen, Hindi layout checked (no clipped text, correct fonts).
2. Accessibility: run axe in Playwright on landing, login, guide, chat, tracker, lawyer review; fix all serious/critical issues; verify full keyboard flows and focus management in modals.
3. Performance: route-level code splitting, image/font optimisation, Lighthouse a11y ≥95 and performance ≥85 on landing and a guide page; fix regressions.
4. Security hardening review against §16 (helmet, CSRF, rate limits, ownership checks, sanitisation, secrets, error leakage) and fix findings.
5. Playwright E2E smoke tests: citizen journey (register → verify → read guide → chat → draft → track case) and lawyer journey (review → reject → approve), on mobile and desktop viewports.
6. scripts/test-report.ts and `npm run test:report` as specified in §17; make it fail if any official ID is missing. Run it and commit a sample report.
7. Finish README (setup, env, demo accounts, 5-minute demo script, architecture diagram in Mermaid, how mock mode vs real Gemini works, known limitations, test report instructions)
   and docs/DECISIONS.md.
8. Run the full definition-of-done checklist from §18 and report any item that is not met.

Acceptance: a fresh clone → `npm run setup && npm run dev` → demo script works end to end; 72/72 official tests plus extras green. Commit "phase 8: polish + docs".
```

---

## Fix-up prompt (use whenever a phase misses something)

```
Re-read AGENTS.md sections relevant to the phase you just did. Compare your implementation line by line against the spec and the acceptance criteria.
List every gap (missing endpoint, missing UI state, missing test ID, wrong error code/message, failing check) and fix all of them.
Then run typecheck, lint and the full test suite, and show me the results. Do not move on to the next phase.
```

## Review prompt (optional, after Phase 8)

```
Act as a skeptical reviewer who has not seen this code. Audit the repository against AGENTS.md: security (§16), RBAC (§3), validation rules (§5), state machines (§6),
test coverage of the official IDs (§17), accessibility and responsiveness (§15). Produce a prioritised list of real defects with file/line references, then fix the top issues
and re-run all tests.
```
