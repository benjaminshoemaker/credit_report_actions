A) System blueprint
A1. Architecture

Client (SPA): React + Vite + Tailwind. pdf.js for text extraction. In‑memory auth tokens.

Backend: AWS API Gateway + Lambda (Node.js + TypeScript) + RDS Postgres 16.

Storage: Postgres for structured fields and saved items. No PDFs server‑side.

Auth: Cognito Hosted UI (Google/Apple). OIDC code+PKCE.

LLM: OpenAI gpt‑4o‑mini via backend only. Zero‑retention. Whitelisted fields only.

Hosting: S3 + CloudFront (default domain).

Monitoring: CloudWatch alarms.

Secrets: SSM Parameter Store (KMS).

A2. Core modules

Parser (client): pdf.js text → sectioning → label synonyms → deterministic regex → field confidence → doc metrics → accept/manual review routing.

Normalizer (client): creditor name rules + alias table; product type mapping; ownership mapping.

Deduper (client): strict auto‑merge across bureaus; conflicts panel; latest‑wins rule.

EV engine (shared TS): odds table, ΔAPR, utilization brackets, minimum‑payment model, pay‑down optimizer, EV formulas, scenario ranges.

API: /analyze, /events, /items.

LLM scripts: APR reduction, late‑fee/penalty APR, dispute letter generator (payload whitelist).

Saved items: letters and scripts only; placeholders; 90‑day inactivity expiry; “Stale” after re‑analyze.

Rate limits: per user and per IP.

A3. Data model (server)

User: user_id, score_band, timestamps.

Account: bureau fields per spec, including ownership, high_credit, limit_source, reported_month.

Inquiry: date, creditor_code, type.

SavedItem: item_id, user_id, type, template_id, payload_no_pii JSON, engine_version, timestamps.

Events: consent/outcome with audit fields.

Indices on (user_id), (user_id, bureau), (user_id, type).

A4. Key algorithms

APR estimate: base by product + score band delta; clamp.

Minimum payment: max(25, 0.01*balance + (APR/12)*balance).

Utilization: prefer credit_limit; else high_credit_proxy; if missing, mark missing; apply EV haircut 50%; total‑util uses known limits; bump bracket if >30% balances missing.

Pay‑down: avalanche; monthly approximation; payments day 1.

Odds: rules table by score band × utilization bracket × 60d‑late flag.

Scenario EV range: one tier down/up for Low/High.

Cross‑bureau dedup: strict rule set; show conflicts; latest‑wins numeric.

A5. Security and compliance

Raw PDFs never leave device.

Structured fields delete after 90 days inactivity.

Consent logs 2 years. Server logs 30 days.

Security headers and CSP as approved.

B) Iterative roadmap (three passes)
B1. Milestones (coarse)

Repo + Shared Core: workspace, shared types, EV primitives with tests.

Backend skeleton: /analyze echo; DB schema; /events; /items.

Frontend skeleton: routes, upload, auth, TOS gate.

Parser v0: Equifax happy path; metrics gate; manual review form.

EV engine integration: actions page; cards; ranges; “Why this”.

LLM scripts + letters: whitelist; zero‑retention call; print view.

Saved items: save/list/delete; stale flag on re‑analyze.

Beta bureaus: Experian + TransUnion soft‑gated.

Hardening: rate limits, alarms, CSP, acceptance tests, deploy.

B2. Chunks (first breakdown)

M1 Repo + Shared Core

C1: Workspace (pnpm), TS configs, lint, format, Vitest.

C2: shared-schemas: zod models for User, Account, Inquiry, AnalyzeInput/Output.

C3: shared-ev: utils for APR clamp, min payment, util brackets; unit tests.

C4: shared-ev: odds table, ΔAPR table, EV formulas; unit tests.

C5: shared-ev: pay‑down avalanche vs baseline B; unit tests.

M2 Backend

C6: SAM app, API Gateway, Lambda TypeScript handler scaffold.

C7: POST /analyze stub, zod validation, returns empty actions.

C8: Postgres schema migrations; RDS connection helper; health check.

C9: POST /events with consent/outcome; zod; DB insert; tests.

C10: /items save/list/delete; placeholders only; tests.

C11: Rate‑limit middleware (token bucket in Redis is overkill; use in‑memory per Lambda + API GW usage plans; start with API GW throttles).

M3 Frontend

C12: Vite + Tailwind + routes; base layout; dark mode class.

C13: TOS/Privacy checkbox on landing; copy.

C14: Upload page with bureau picker and file constraints.

C15: Cognito Hosted UI sign‑in (code+PKCE); in‑memory token store; callback page.

C16: Call /analyze with mocked structured fields; render warnings and no actions yet.

M4 Parser v0

C17: pdf.js extraction; text blocks; section anchors; unit tests with text fixtures.

C18: Label synonyms JSON; money/date/status grammars; mapping funcs.

C19: Equifax happy‑path mapping to structured fields; confidence per field.

C20: Doc quality metrics; accept/manual review gate; tests.

C21: Manual review form (Gate B), per‑account card; update structured fields in memory.

M5 EV Integration

C22: Client‑side dedup + conflicts panel + latest‑wins; tests.

C23: Authorized user to Excluded; Joint badge.

C24: Apply APR estimates; missing‑limit handling; high‑credit proxy.

C25: Call /analyze with structured fields; backend uses shared EV to produce actions.

C26: Actions page: cards with EV ranges, p_success, score impact, “Why this”.

C27: Just‑in‑time prompts for 60d‑late / late‑fee / penalty APR.

M6 Scripts + Letters

C28: Backend LLM client with whitelist structs and zero‑retention headers; retry + fallback template.

C29: APR reduction script generator; tests for payload whitelist.

C30: Late‑fee + penalty APR script generator; tests.

C31: Dispute letter HTML template (Style A) with placeholders, exhibits checklist; print/save via browser.

M7 Saved items

C32: /items wired from UI; Save button on script/letter; list page.

C33: Stale label on list after re‑analyze (compare engine_version); regenerate flow.

C34: Quotas on saves/exports.

M8 Beta bureaus

C35: Experian/TransUnion heuristics; Beta thresholds; manual review path.

C36: Partial‑coverage banner and proceed logic.

M9 Hardening and Deploy

C37: API GW throttles; per‑user cap checks; WAF.

C38: Security headers/CSP; smoke tests.

C39: CloudWatch alarms; test notifications.

C40: SAM deploy backend; S3+CloudFront deploy frontend; run acceptance.

B3. Micro‑steps (second breakdown)

Each chunk becomes ~2–6 commits with tests.

C1

Init repo, pnpm workspace: packages/shared-schemas, packages/shared-ev, services/api, apps/web.

ESLint, Prettier, tsconfig base, Vitest config.

C2

Define zod for Account/Inquiry/User.

Add enums for product_type, ownership, status, payment_status.

Add AnalyzeInput/Output zod schemas.

C3

Implement clampAPR, minPayment, utilBracket.

Unit tests cover edge cases (APR clamp bounds; $25 floor).

C4

Encode odds tables and ΔAPR table as pure data.

Functions aprReductionOdds, balanceTransferOdds, deltaAPR.

Unit tests for bands and bracket adjustments.

C5

Implement monthly approximation calculator.

Implement avalanche vs baseline B.

Unit tests with deterministic fixtures.

C6–C7

SAM template with /analyze POST.

Lambda handler parses body with zod, returns {warnings:[], actions:[], audit}.

Unit test: 400 on invalid input.

C8–C10

SQL migrations for users, accounts, inquiries, saved_items, events.

Connection helper with env from SSM.

/events insert; /items CRUD; unit tests against local pg (docker).

C11

API GW throttles per route.

Simple per‑user daily cap check in handlers.

C12–C16

Web skeleton, routes, Tailwind theme tokens.

Landing with TOS checkbox.

Upload with bureau select and constraints.

Cognito PKCE login; callback reads tokens; memory store.

Call /analyze with mock structured fields; render warnings list.

C17–C21

pdf.js load; extract text by page; unit tests on mocked text.

Label synonyms and grammars; tests for parsing money/date/status.

Equifax mapping; confidence per field; field validators.

Doc metrics; accept/manual review toggle.

Manual review UI; validations for Gate B.

C22–C27

Dedup function; conflicts panel.

Ownership filters: authorized_user → Excluded section.

Apply APR estimation and limit proxy rules.

Backend integrates shared EV; compute EV ranges.

Actions cards with “Why this” drawer.

JIT prompts for missing odds inputs.

C28–C31

Backend OpenAI client; whitelist enforcement; tests.

APR reduction script; late‑fee/penalty script.

Dispute letter HTML template and print view.

C32–C34

Save button wires to /items.

Saved page; stale marker after re‑analyze (engine_version).

Quotas on saves and exports.

C35–C36

Experian/TU heuristics and Beta metrics.

Partial‑coverage banner and flow.

C37–C40

WAF + throttles; banners on 429.

CSP headers; e2e smoke via Playwright.

CloudWatch alarms; verify email.

Deploy and run acceptance checks.

C) TDD prompts for a code‑generation LLM

Each prompt builds on prior steps. Use TypeScript, pnpm, Vitest. Keep code integrated. No placeholders without tests. Use zod for validation. Use minimal deps.

Prompt 1 — Workspace and tooling
Create a pnpm monorepo with these packages:
- packages/shared-schemas (TypeScript library)
- packages/shared-ev (TypeScript library)
- services/api (AWS Lambda handlers with SAM template)
- apps/web (React + Vite + Tailwind SPA)

Add ESLint, Prettier, Vitest in root. Configure TS path aliases.

Deliverables:
- root package.json with workspaces
- tsconfig base and per-package extends
- Vitest config in each package
- CI-like npm scripts: build, test, lint, format
- A README with local dev instructions

Write minimal code to compile and pass `pnpm -w build` and `pnpm -w test`.

Prompt 2 — Shared schemas with zod
In packages/shared-schemas:
- Implement zod schemas: ScoreBand, ProductType, Ownership, Status, PaymentStatus, Account, Inquiry, User.
- Implement AnalyzeInput and AnalyzeOutput schemas matching the spec (actions array, warnings array, audit object).
- Export TypeScript types from zod via `z.infer`.

Add Vitest tests:
- Validate a correct AnalyzeInput sample.
- Fail on missing required fields (e.g., missing product_type).
- Ensure Account supports limit_source values (reported_limit | high_credit_proxy | unknown).

Prompt 3 — EV primitives
In packages/shared-ev:
- Implement utils: `clampAPR(apr)`, `utilBracket(utilPercent)`, `minPayment(balance, apr)`.
- Implement APR estimate function that takes product_type + score_band and returns clamped APR.
- Export constants for utilization brackets and score band adjustments.

Vitest tests:
- Test APR clamp edges and band adjustments.
- Test minimum payment at $24 (should floor to $25).
- Test bracket boundaries at 9/10/29/30/49/50/79/80.

Prompt 4 — Odds tables and EV formulas
In packages/shared-ev:
- Encode approval odds table for APR reduction and balance transfer per spec.
- Encode ΔAPR table by score band.
- Implement:
  - `aprReductionOdds(scoreBand, utilBracket, any60dLate)` -> percent 0..1 after clamps.
  - `balanceTransferOdds(scoreBand, utilBracket, any60dLate)` -> percent 0..1.
  - `evLateFee(pRefund, feeAmount)`.
  - `evPenaltyAPR(pReversion, deltaApr, avgBalance, monthsActive)`.
  - `evAprReduction(pSuccess, deltaApr, avgBalance, monthsActive)`.
  - `evBalanceTransfer(pApproval, aprSrc, amountTransferred, feeRate, monthsActive)`.
- Implement scenario bounds helper that returns [low, high] using one-tier-down/up logic.

Vitest tests:
- Cover odds at each score band and utilization bracket.
- Verify clamps.
- Verify EV calculations with known numeric examples.

Prompt 5 — Pay‑down engine
In packages/shared-ev:
- Implement monthly-approximation balance simulator:
  - Inputs: starting balances per account with APRs; monthly surplus; optional month-1 lump sum; baseline strategy "proportional" vs "avalanche".
  - Assume payments on day 1. Interest = APR/12 * average monthly balance.
- Implement `evPaydown(threeMonth, baselineB, avalanche)` returning dollars saved vs baseline.

Vitest tests:
- Two-account scenario that matches the example logic.
- Verify avalanche beats baseline B.

Prompt 6 — SAM backend scaffold and /analyze stub
In services/api:
- Add SAM template with REST `POST /analyze`, `POST /events`, and `/items` (POST/GET/DELETE) but handlers can be stubs.
- Write `/analyze` handler that:
  - Validates input JSON with shared-schemas.
  - Returns `{ warnings: [], actions: [], audit: { engine_version: "v1.0.0", compute_ms } }`.

Vitest tests:
- Handler unit test using a direct function import: valid input returns 200; invalid returns 400 with error code.

Prompt 7 — DB schema and connection helper
In services/api:
- Add SQL migrations (plain SQL files) for tables: users, saved_items, events. Include indexes.
- Add a `db.ts` with node-postgres connection pool (values read from env). Do not connect on import; expose `getClient()`.
- Add a script to run migrations at cold start.

Vitest tests:
- Use docker-compose Postgres in tests.
- Run migrations once; verify tables exist.

Prompt 8 — /events and /items handlers
In services/api:
- Implement `POST /events` with zod validation for type=consent|outcome. Insert row with `user_id`, `ip_trunc`, and `user_agent`.
- Implement `/items`:
  - POST: save `{type, template_id, payload_no_pii, engine_version}` returning `{item_id}`.
  - GET: list all items for user with derived `stale` (compare engine_version to current constant).
  - DELETE: delete one.

Vitest:
- Unit tests for each handler with an ephemeral test DB.
- Validate that payload_no_pii is JSON and limited in size (e.g., 10 KB).

Prompt 9 — Frontend scaffold, TOS gate, upload page
In apps/web:
- Create routes per spec.
- Add Tailwind theme and dark mode class strategy.
- Landing page: TOS/Privacy checkbox, proceed CTA.
- Upload page: bureau select (Equifax/Experian/TransUnion), file picker with constraints (PDF, ≤20 MB).
- Store selection and files in a React state.

Vitest + React Testing Library:
- Render TOS checkbox gate.
- Validate file constraint errors.
- Ensure bureau must be selected for each file.

Prompt 10 — Cognito sign‑in (PKCE) and token store
In apps/web:
- Implement OIDC code+PKCE with Cognito Hosted UI.
- In-memory token store (React context). 60-min expiry. No refresh token.
- `/auth/callback` parses tokens, validates nonce/state, stores tokens in memory, redirects back.

Tests:
- Unit test token parsing logic with mocked URL.
- Verify tokens are not written to localStorage/sessionStorage.

Prompt 11 — pdf.js extraction and Equifax mapper v0
In apps/web:
- Add pdf.js. Extract text per page and keep line order.
- Implement label-synonyms JSON and grammar helpers (money, dates, statuses).
- Implement Equifax mapper v0: parse open revolving lines, balances, limits/high_credit, status, ownership, open_date, reported_month, inquiries.

Vitest:
- Feed synthetic text fixtures that mimic Equifax structure.
- Assert field extraction and confidence scores.

Prompt 12 — Doc metrics and manual review gate
In apps/web:
- Compute doc-level metrics: coverage %, numeric exact %, categorical/date %.
- Accept if Equifax thresholds pass; else manual review for failed tradelines.
- Manual review form: Gate B required fields with validation. Save edits in memory.

Tests:
- Fixture that passes thresholds.
- Fixture that fails coverage → manual review route.

Prompt 13 — Dedup and conflicts panel
In apps/web:
- Implement strict cross-bureau auto-merge by rules.
- Conflicts panel lists merged pairs and latest-wins values; tie-break logic (higher balance, lower limit).
- Authorized_user lines go to Excluded; joint shows badge.

Tests:
- Verify merge and conflict resolution with synthetic multi-bureau fixtures.

Prompt 14 — EV integration end-to-end
In services/api:
- Implement EV compute using shared-ev. Handle:
  - APR estimate and clamps.
  - Utilization with high_credit proxy and missing-limit haircut.
  - Scenario bounds for EV range.
  - Time-to-effect assumptions.
- Produce actions array per spec with "Why this" inputs.

In apps/web:
- Call /analyze with structured fields; render action cards with EV ranges, p_success, score impact, and "Why this".
- JIT prompts for: any 60d late? late fee in last 2 statements? penalty APR active?

Tests:
- Backend unit tests for each action EV.
- Frontend integration test: mocked backend → cards render with correct fields.

Prompt 15 — LLM scripts and letter template
In services/api:
- Add OpenAI client. Ensure zero-retention headers. Only allow approved payload shape.
- Generators:
  - APR reduction script: 60-second track + 3 bullets + ask + escalation.
  - Late-fee and penalty APR scripts: similar pattern.
  - Dispute letter HTML template (formal style A), with placeholders. No PII handled here.

Tests:
- Unit tests verify payload whitelist enforcement.
- Fallback to static template when LLM fails (simulate 502).

Prompt 16 — Print/save and Saved Items wiring
In apps/web:
- Dispute letter print view with "Print/Save as PDF" (browser print).
- Add Save button for script/letter that posts to `/items`.
- Saved page: list items with `stale` flag and "Regenerate" action that re-calls `/analyze` and rebuilds item.

Tests:
- Save and list flow with mocked API.
- Stale flag toggles after re-analyze (engine_version change).

Prompt 17 — Beta bureaus and banners
In apps/web:
- Add Experian and TransUnion heuristics with Beta thresholds.
- Partial-coverage banner: "Using {n}/3 bureau reports...".

Tests:
- Fixtures that pass Beta and fail Beta → manual review or proceed.

Prompt 18 — Hardening and deploy
In services/api:
- Add API Gateway throttles per route.
- Enforce per-user daily caps for analyses/scripts/exports.
- Add security headers and CSP for CloudFront origin responses.
- CloudWatch alarms for API 5xx, Lambda errors, RDS CPU.
- SAM deploy scripts; S3 sync and CloudFront invalidation scripts.

Tests:
- Unit tests for cap enforcement.
- E2E smoke with Playwright: upload→signin→parse→review→actions→letter→save item.

D) Final TDD e2e prompt (wire everything)
Goal: deliver an end-to-end MVP slice.

Steps:
1) Seed local Postgres via docker-compose. Run migrations.
2) Start SAM local API for /analyze, /events, /items.
3) Start web with Vite. Configure env for Cognito dev client.
4) In web, mock Cognito sign-in (dev mode) to bypass remote login locally.
5) Upload a synthetic Equifax text fixture (use in-memory text adapter) and parse to structured fields.
6) Run dedup and conflicts panel on a small two-line input.
7) Call /analyze and render three action cards with EV ranges and "Why this".
8) Generate an APR reduction script via backend (mock OpenAI). Save it. Confirm it appears on /saved.
9) Re-run analyze with a different engine_version and confirm saved item is marked "Stale".
10) Print the dispute letter view and confirm browser print dialog can be invoked (mock window.print in test).

Produce:
- Playwright script that covers the above.
- README with local run commands and deploy steps using `sam deploy --guided` and `aws s3 sync`.

E) Notes on best practices

Pure functions in shared-ev, high unit‑test coverage.

All API inputs validated by zod. Return typed error codes.

No raw PDFs off device.

No PII to LLM.

Browser memory tokens only.

Rate‑limit and caps enforced server‑side.

Feature flags are not required for MVP; keep config simple.

This plan is right‑sized: small units, early tests, integrated at each step, and deployable after M9.