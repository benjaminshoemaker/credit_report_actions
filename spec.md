APRcut MVP — TODO

Objective: maximize dollars saved in 3 months.
Guardrails: no hard pulls without explicit consent. Educational tool. Not CRA. Not credit repair. Not financial advice.

0) Project setup

 Create AWS account access and budget alarms

 Reserve alert email: ben.shoemaker.xyz@gmail.com

 Create OpenAI account and key (US, zero‑retention policy confirmed)

 Create Git repo and branch protection (require PR + CI on main)

 Create shared Notion/Drive space for runbooks and test fixtures

1) Monorepo and tooling

 Initialize pnpm workspace: packages/shared-schemas, packages/shared-ev, services/api, apps/web

 Add ESLint, Prettier, Vitest, tsconfig base with path aliases

 Add root scripts: build, test, lint, format, typecheck

 CI placeholder (GitHub Actions optional post‑MVP)

 Root README with local dev instructions

2) Shared schemas (TypeScript + zod)

 Define enums: ScoreBand, ProductType, Ownership, Status, PaymentStatus

 Define Account, Inquiry, User, and meta fields per spec

 Define AnalyzeInput and AnalyzeOutput schemas

 Export types from zod

 Unit tests: valid and invalid payloads

3) EV core library (packages/shared-ev)

 Helpers: clampAPR, utilBracket, minPayment

 APR estimate by product + score band; clamp 9.99–34.99

 Odds tables: APR reduction and balance transfer; clamps

 ΔAPR table by score band

 EV funcs: late fee, penalty APR, APR reduction, balance transfer

 Pay‑down simulator: monthly approximation; avalanche vs baseline B

 Scenario bounds (low/high via tier down/up)

 Unit tests: edges, brackets, example numerics

4) Backend scaffolding (AWS SAM + Lambda)

 SAM template: REST POST /analyze, POST /events, POST /items, health

 Handler skeletons in TypeScript with zod validation

 Structured JSON error format and codes

 Local SAM run script

5) Postgres and persistence

 Provision RDS Postgres 16 (db.t4g.small, 20GB gp3, Multi‑AZ off)

 Security group rules (API subnets/roles only)

 SSM Parameter Store: DB URL, OpenAI key, env vars; KMS encryption

 DB migrations:

 users(user_id pk, score_band, created_at, updated_at, last_activity_at)

 accounts(id pk, user_id fk, bureau, account_pseudo_id, creditor_code, display_name, product_type, ownership, status, balance, credit_limit, high_credit, limit_source, utilization_cached, payment_status, open_date, last_delinquency_date, reported_month, apr_estimate, apr_source, dispute_candidate, dispute_reasons jsonb, created_at, updated_at)

 inquiries(id pk, user_id fk, date, creditor_code, type, created_at)

 saved_items(item_id pk, user_id fk, type, template_id, payload_no_pii jsonb, engine_version, created_at, updated_at)

 events(id pk, user_id fk, type, action_type, disclosure_version, scoped_fields_snapshot jsonb, success bool, amount_saved_usd numeric, notes text, ip_trunc, user_agent, created_at)

 usage_caps(id pk, user_id, date, analyses_used int, scripts_used int, exports_used int) (for per‑user caps)

 Connection helper; migration runner

 Unit tests for migrations

6) API implementations
/analyze

 Accept AnalyzeInput; validate with zod

 Persist structured fields for the user (replace per bureau)

 Update users.last_activity_at

 Deduplicate tradelines across bureaus (strict rules); compute conflicts and latest‑wins

 Apply utilization rules (limit, high_credit proxy, missing‑limit haircut)

 Apply APR estimates where missing

 Compute EV for all actions and scenario ranges

 Build warnings array (partial coverage, missing‑limit adjustment)

 Return actions, warnings, audit {engine_version, compute_ms}

 Enforce per‑user daily cap for analyses; return 429 on exceed

 Unit tests: success path, cap exceeded, invalid payload, partial coverage

/events

 type=consent: store consent for action_type with disclosure version and snapshot

 type=outcome: store success, optional dollars saved, notes

 Return event_id, timestamp

 Retentions: consent 2y; outcomes 90d (cleanup job later)

 Unit tests for both types and validation

/items

 POST: save {type:letter|script, template_id, payload_no_pii, engine_version}; cap checks for saves/exports

 GET: list items with stale flag (compare engine_version)

 DELETE: remove one

 Unit tests for size limits and stale flags

7) Quotas and rate limits

 API Gateway throttles per route (sane defaults)

 Per‑user caps: 3 analyses/day, 10 scripts/day, 3 exports/day (usage_caps table)

 Per‑IP throttles: uploads ≤10/hour ≤30/day; analyze ≤5/min ≤100/day; scripts ≤20/min; exports ≤10/day

 WAF bot control (MVP config)

 Return consistent 429 with reason codes

 Tests: cap increment logic and reset at UTC midnight

8) Frontend scaffolding (React + Vite + Tailwind)

 Tailwind setup; dark mode class

 Layout shell; brand tokens (Inter, emerald #10B981)

 Routes: /, /upload, /review, /actions, /actions/*, /saved, /tos, /privacy, /auth/callback

 Components: Card, Button, Input, Select, Modal, Drawer, Alert

 Landing: TOS/Privacy checkbox gating copy

 Upload: bureau select per file, PDF constraints, error states

 Unsaved changes warning

 Unit tests: route smoke, upload validation, TOS gate

9) Auth (Cognito Hosted UI)

 Create User Pool + app client (PKCE)

 Configure Google + Apple IdPs

 Allowed callback: CloudFront default domain /auth/callback

 Implement PKCE login, nonce/state, in‑memory tokens only

 Refresh flow: re‑login after 60 min; no persistent storage

 Frontend tests: parse callback, no localStorage usage

10) Client‑side parsing

 Integrate pdf.js; extract page text in order

 Label synonyms JSON; grammars for money, date(YYYY‑MM), status tokens

 Equifax v1: map open revolving, status, ownership, balance, credit_limit, high_credit, open_date, reported_month; inquiries

 Field confidence per extraction

 Doc metrics: coverage %, numeric exact %, categorical/date %

 Accept if thresholds pass; else manual review route

 Manual review form (Gate B): require product_type, status, balance, and credit_limit or high_credit

 Save manual edits (client state) and include in /analyze body

 Unit tests: text fixtures for pass/fail, manual review flow

11) Cross‑bureau dedup and conflicts (client)

 Strict auto‑merge rule implementation

 Conflicts panel: show merged pairs and chosen values; latest‑wins; conservative ties

 Authorized user lines into “Excluded accounts”

 Joint accounts tagged and included

 Unit tests with multi‑bureau synthetic data

12) EV integration UI

 Prepare structured fields payload for /analyze

 Render warnings and action cards

 Card content: EV range, p_success, cash needed, time‑to‑effect, score‑impact, “Why this” drawer

 JIT prompts on cards:

 Any 60+ day late in last 24 months? (APR‑reduction/BT)

 Late fee in last 2 statements? (Late‑fee card)

 Penalty APR active? (Penalty card)

 Pay‑down card shows “Enter amounts” when unknown; no EV until provided

 Unit tests: card rendering, JIT prompt state, range display

13) LLM script and letter generation (backend)

 OpenAI client with zero‑retention headers; region US

 Payload whitelist structs for:

 APR reduction

 Late‑fee and penalty APR

 Dispute letter explanation payload (no PII)

 Generators:

 APR reduction call script (60s + 3 bullets + ask + escalation)

 Late‑fee/penalty APR scripts

 Dispute letter HTML template (Style A), exhibits checklist; no bureau address; placeholders only

 Fallback to static template on LLM error; return 502_LLM_ERROR

 Unit tests: whitelist enforcement, fallback behavior

14) Print/Save and Saved Items (frontend + backend)

 Letter print view with “Print / Save as PDF” (browser print)

 “Save” buttons for letters and scripts

 Wire to /items POST/GET/DELETE

 Saved page: list items, show stale label if engine_version changed; “Regenerate” action

 Enforce per‑user save/export caps

 Tests: save, list, delete, stale flow

15) Beta bureaus (client)

 Experian and TransUnion heuristic mappers

 Beta acceptance thresholds (80% coverage; 95% numeric/categorical)

 Manual review path for failed Beta fields

 Partial‑coverage banner and proceed logic

 Tests: fixtures for Beta pass/fail

16) Compliance and consent

 Upload page disclosure copy (approved)

 Actions page “Not financial advice” banner

 CROA disclaimers in TOS and on Dispute/APR/BT pages

 Consent capture UI for potential hard‑pull or issuer contact (inline checkbox)

 /events write for consent with snapshot (score band, util bracket)

 TOS/Privacy acceptance:

 Pre‑upload checkbox enforced client‑side

 On first authenticated call, log acceptance via /events (consent type tos_accept)

 Tests: consent logging, disclosure presence

17) Security, privacy, headers

 Raw PDFs restricted to client; verify no upload paths exist

 Structured data retention job (90‑day inactivity delete)

 Outcomes retention job (90 days)

 Consent retention policy (2 years; no delete job needed pre‑MVP)

 CloudFront security headers:

 HSTS 1y preload

 X‑Content‑Type‑Options nosniff

 Referrer‑Policy no‑referrer

 X‑Frame‑Options DENY

 Permissions‑Policy empty for sensors/features

 CSP per spec (Cognito + OpenAI only, self)

 Lambda/API CORS minimal allowlist

 Tests: CSP blocks unexpected domains (manual check acceptable)

18) Monitoring and ops

 CloudWatch alarms:

 API 5xx >2% (5m)

 Lambda errors >0 (5m)

 RDS CPU >70% (5m)

 SNS → email ben.shoemaker.xyz@gmail.com

 Simple runbook: how to redeploy, rotate keys, rollback

 Log policy: no request bodies; IP truncated; verify in logs

19) Frontend polish

 Theme tokens and dark mode

 Excluded accounts section

 Conflicts panel UI

 Partial‑coverage banner

 Error states for 400/401/422/429/500/502

 Rate‑limit banners with retry guidance

 Accessibility pass (focus order, labels)

 Mobile responsiveness checks

20) Acceptance tests

 Parser fixtures:

 Happy path (Equifax)

 Missing limit + High Credit proxy

 Authorized user excluded

 Joint account included

 Closed‑with‑balance excluded from optimizer

 Unknown layout variant that passes gate

 Low‑coverage triggers manual review

 Large file near 20MB under 60s p95

 EV engine cases:

 Util bracket boundaries

 BT EV with 70% up to $5k; 3% fee; 0% promo; 2.67 mo active

 Late‑fee EV with/without prior lates

 Penalty‑APR timing (1 month active)

 Avalanche vs baseline B

 Missing‑limit haircut vs High‑Credit proxy

 E2E:

 Upload → sign‑in → parse → review → actions → letter/script → save → re‑analyze → stale

 Pay‑down without surplus/lump sum shows prompt

 No actions ≥ $25 shows the no‑ROI card

21) Deploy

 Backend: sam deploy --guided (store config)

 SSM params set in env; verify Lambda access

 Frontend: aws s3 sync to S3 bucket

 CloudFront invalidation

 Copy callback URL into Cognito app client

 Smoke test on CloudFront URL

 Trigger alarms test (simulate 5xx) and confirm email alert

22) Launch checklist

 All acceptance criteria green

 Usage caps enforced

 Security headers verified

 Consent flow verified

 Saved items flow verified

 Docs: runbook, README, privacy/TOS finalized

 Backlog recorded (post‑MVP features)

23) Backlog (defer)

 Autopay setup

 Live BT offers

 Combined plan summary and export

 Privacy controls (delete/download)

 Non‑Chrome support and warnings

 Immutable manual‑edit audit log

 PDF bureau auto‑detect

 RDS Proxy, Multi‑AZ, CI/CD pipeline

 Expanded GLBA program

 Opt‑in LLM parser (policy‑dependent)

24) Notes

 Self‑reported score band overrides auto‑extracted band

 Authorized user lines excluded from ROI/odds/actions; shown for transparency

 Joint accounts fully included with badge

 Balance‑transfer and any issuer contact require explicit consent via /events

 Phone numbers: instruct “call the number on the back of your card”

 No server‑side PDFs; letters print via browser