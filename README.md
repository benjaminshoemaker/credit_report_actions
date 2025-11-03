# APRcut Monorepo

## Getting Started
1. Ensure Node.js 18+ and pnpm 8 are installed.
2. Install dependencies from the repo root:
   ```bash
   pnpm install
   ```
3. Bootstrap all packages:
   ```bash
   pnpm -w build
   ```

## Workspace Layout
- `packages/shared-schemas` – zod-powered TypeScript models shared across services.
- `packages/shared-ev` – APR and expected value utilities.
- `services/api` – AWS Lambda handlers and SAM infrastructure.
- `apps/web` – Vite + React + Tailwind single-page app.

## Common Commands
Run these from the repository root:
- `pnpm -w build` – build every package in dependency order.
- `pnpm -w test` – execute Vitest suites across the monorepo.
- `pnpm -w lint` – lint all workspaces with ESLint.
- `pnpm -w format` – format sources using Prettier.
- `pnpm -w typecheck` – perform TypeScript diagnostics without emit.

## Local Development
- API: `pnpm --filter services/api dev`
- Web app: `pnpm --filter apps/web dev`
- Watch build for a package: `pnpm --filter packages/shared-ev build --watch`

## Local MVP Run
1. **Start Postgres**  
   ```bash
   docker compose -f services/api/docker-compose.test.yml up -d
   export PGHOST=127.0.0.1
   export PGPORT=55432
   export PGDATABASE=aprcut_test
   export PGUSER=postgres
   export PGPASSWORD=postgres
   ```
2. **Build the API once and run migrations**  
   ```bash
   pnpm --filter services/api build
   pnpm --filter services/api migrate
   ```
3. **Run the SAM local API (`/analyze`, `/events`, `/items`)**  
   ```bash
   pnpm --filter services/api dev
   ```
4. **Configure the web app** – create `apps/web/.env.local` with:
   ```bash
   VITE_API_BASE_URL=http://localhost:3000
   VITE_COGNITO_DOMAIN=https://example.auth.us-east-1.amazoncognito.com
   VITE_COGNITO_CLIENT_ID=local-dev-client
   VITE_COGNITO_REDIRECT_URI=http://localhost:5173/auth/callback
   VITE_COGNITO_SCOPE=openid profile email
   VITE_DEV_AUTH=true
   ```
   Then start Vite:
   ```bash
   pnpm --filter apps/web dev
   ```

## Playwright MVP Flow
- Ensure the API and web dev servers are running (see steps above).
- From the repo root run:
  ```bash
  pnpm --filter apps/web test:e2e -- e2e/mvp-flow.spec.ts
  ```
  The script exercises upload ➝ review ➝ actions ➝ saved ➝ print and mocks Cognito via `VITE_DEV_AUTH=true`.

## Conventions
- Follow `Repository Guidelines` in `AGENTS.md` before opening PRs.
- Update `todo.md` items as you complete them to track cross-session progress.

## Deployment
1. **Deploy the API stack**  
   ```bash
   cd services/api
   pnpm build          # ensure dist/ is fresh
   sam deploy --guided
   ```
   When prompted, supply the desired stack name, AWS Region, and parameter overrides (database URL, OpenAI settings, etc.).
2. **Deploy the web app**  
   ```bash
   pnpm --filter apps/web build
   aws s3 sync apps/web/dist s3://<your-static-site-bucket> --delete
   ```
3. **Post-deploy**  
   - Invalidate CloudFront (if fronted by a CDN).  
   - Update Cognito callback URLs to point at the hosted SPA.  
   - Remove or disable `VITE_DEV_AUTH` for production builds.
