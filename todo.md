# APRcut MVP — TODO

> Objective: maximize dollars saved in 3 months.  
> Guardrails: no hard pulls without explicit consent. Educational tool. Not CRA. Not credit repair. Not financial advice.

## 0) Project setup
- [ ] Create AWS account access and budget alarms
- [ ] Reserve alert email: `ben.shoemaker.xyz@gmail.com`
- [ ] Create OpenAI account and key (US, zero‑retention policy confirmed)
- [ ] Create Git repo and branch protection (require PR + CI on `main`)
- [ ] Create shared Notion/Drive space for runbooks and test fixtures

## 1) Monorepo and tooling
- [ ] Initialize pnpm workspace: `packages/shared-schemas`, `packages/shared-ev`, `services/api`, `apps/web`
- [ ] Add ESLint, Prettier, Vitest, tsconfig base with path aliases
- [ ] Add root scripts: `build`, `test`, `lint`, `format`, `typecheck`
- [ ] CI placeholder (GitHub Actions optional post‑MVP)
- [ ] Root README with local dev instructions

## 2) Shared schemas (TypeScript + zod)
- [ ] Define enums: ScoreBand, ProductType, Ownership, Status, PaymentStatus
- [ ] Define Account, Inquiry, User, and meta fields per spec
- [ ] Define AnalyzeInput and AnalyzeOutput schemas
- [ ] Export types from zod
- [ ] Unit tests: valid and invalid payloads

## 3) EV core library (`packages/shared-ev`)
- [ ] Helpers: `clampAPR`, `utilBracket`, `minPayment`
- [ ] APR estimate by product + score band; clamp 9.99–34.99
- [ ] Odds tables: APR reduction and balance transfer; clamps
- [ ] ΔAPR table by score band
- [ ] EV funcs: late fee, penalty APR, APR reduction, balance transfer
- [ ] Pay‑down simulator: monthly approximation; avalanche vs baseline B
- [ ] Scenario bounds (low/high via tier down/up)
- [ ] Unit tests: edges, brackets, example numerics

## 4) Backend scaffolding (AWS SAM + Lambda)
- [ ] SAM template: REST `POST /analyze`, `POST /events`, `POST /items`, health
- [ ] Handler skeletons in TypeScript with zod validation
- [ ] Structured JSON error format and codes
- [ ] Local SAM run script

## 5) Postgres and persistence
- [ ] Provision RDS Postgres 16 (db.t4g.small, 20GB gp3, Multi‑AZ off)
- [ ] Security group rules (API subnets/roles only)
- [ ] SSM Parameter Store: DB URL, OpenAI key, env vars; KMS encryption
- [ ] DB migrations for all tables (users, accounts, inquiries, saved_items, events, usage_caps)
- [ ] Connection helper; migration runner
- [ ] Unit tests for migrations

## 6) API implementations
### `/analyze`
- [ ] Validate input with zod
- [ ] Persist structured fields
- [ ] Deduplicate tradelines, compute conflicts, latest‑wins
- [ ] Apply utilization and APR logic
- [ ] Compute EVs and warnings
- [ ] Enforce per‑user daily cap
- [ ] Unit tests: success, cap exceeded, invalid, partial coverage

### `/events`
- [ ] Implement consent and outcome insert
- [ ] Return `event_id`, timestamp
- [ ] Unit tests for both types

### `/items`
- [ ] Save/list/delete handlers, stale flag
- [ ] Enforce caps, size limits
- [ ] Unit tests

## 7) Quotas and rate limits
- [ ] API Gateway throttles per route
- [ ] Per‑user caps (3 analyses/day, 10 scripts/day, 3 exports/day)
- [ ] Per‑IP throttles (uploads, analyze, scripts, exports)
- [ ] WAF bot control
- [ ] Tests for cap increment/reset

## 8) Frontend scaffolding
- [ ] Tailwind setup; dark mode
- [ ] Layout shell, routes `/`, `/upload`, `/review`, `/actions`, `/saved`, `/tos`, `/privacy`, `/auth/callback`
- [ ] Base components
- [ ] Landing page TOS gate
- [ ] Upload bureau picker + validation
- [ ] Unsaved changes warning
- [ ] Unit tests for upload/TOS

## 9) Auth (Cognito Hosted UI)
- [ ] Configure pool, IdPs, callback
- [ ] PKCE login flow
- [ ] In‑memory tokens, 60‑min expiry
- [ ] Tests for token parsing, no localStorage

## 10) Client parsing
- [ ] pdf.js text extraction
- [ ] Label synonyms, grammars
- [ ] Equifax mapper v1
- [ ] Confidence metrics
- [ ] Manual review gate + form
- [ ] Tests with text fixtures

## 11) Dedup + conflicts
- [ ] Auto‑merge rule
- [ ] Conflicts panel UI
- [ ] Authorized users → Excluded; joint badge
- [ ] Unit tests

## 12) EV integration UI
- [ ] Connect `/analyze` API
- [ ] Render warnings + action cards
- [ ] Add JIT prompts
- [ ] Pay‑down prompt behavior
- [ ] Unit tests for cards and state

## 13) LLM scripts + letters
- [ ] OpenAI client zero‑retention
- [ ] Payload whitelist structs
- [ ] APR reduction + Late‑fee/penalty scripts
- [ ] Dispute letter template + checklist
- [ ] Fallback static templates
- [ ] Tests for whitelist + fallback

## 14) Print/Save + Saved Items
- [ ] Print/Save letter view
- [ ] Save buttons wired to `/items`
- [ ] Saved page + stale marker + regenerate
- [ ] Cap enforcement
- [ ] Tests

## 15) Beta bureaus
- [ ] Experian/TU heuristic mappers
- [ ] Beta thresholds + manual review
- [ ] Partial‑coverage banner
- [ ] Tests

## 16) Compliance & consent
- [ ] Upload disclosure
- [ ] “Not financial advice” banner
- [ ] CROA disclaimers in TOS + pages
- [ ] Consent checkbox for hard‑pull actions
- [ ] `/events` write for consent
- [ ] TOS acceptance logged
- [ ] Tests for consent flow

## 17) Security & privacy
- [ ] Verify no PDF uploads server‑side
- [ ] 90‑day inactivity cleanup
- [ ] Retention enforcement jobs
- [ ] CloudFront headers: HSTS, CSP, etc.
- [ ] CORS allowlist
- [ ] Tests or manual verifications

## 18) Monitoring & ops
- [ ] CloudWatch alarms for API/Lambda/RDS
- [ ] SNS email alert verified
- [ ] Runbook and key rotation steps
- [ ] Log inspection (IP truncation)

## 19) Frontend polish
- [ ] Theme tokens, dark mode polish
- [ ] Conflicts + Excluded UI
- [ ] Partial‑coverage banner
- [ ] Error states 400–502
- [ ] Rate‑limit banners
- [ ] Accessibility + mobile pass

## 20) Acceptance tests
- [ ] Parser fixtures (8 cases)
- [ ] EV engine test cases (6)
- [ ] E2E flows (3)
- [ ] Security/compliance assertions (5)

## 21) Deploy
- [ ] `sam deploy --guided`
- [ ] `aws s3 sync` frontend
- [ ] CloudFront invalidation
- [ ] Callback URL to Cognito
- [ ] Smoke + alarm tests

## 22) Launch checklist
- [ ] Acceptance criteria met
- [ ] Caps enforced
- [ ] Headers verified
- [ ] Consent + Saved flow verified
- [ ] Docs + TOS finalized

## 23) Backlog (defer)
- [ ] Autopay setup
- [ ] Live BT offers
- [ ] Plan summary/export
- [ ] Privacy controls
- [ ] Non‑Chrome support
- [ ] Manual‑edit audit log
- [ ] PDF bureau auto‑detect
- [ ] RDS Proxy + CI/CD
- [ ] GLBA program
- [ ] Opt‑in LLM parser
