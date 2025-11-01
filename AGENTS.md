# Repository Guidelines

## Project Structure & Module Organization
The pnpm workspace groups shared TypeScript under `packages/` (`shared-schemas` for zod definitions, `shared-ev` for APR and EV math), serverless code in `services/api`, and the React client in `apps/web`. Place database migrations within `services/api/migrations`, infrastructure in `services/api/sam`, and acceptance fixtures under `apps/web/test-fixtures`. Co-locate unit tests as `*.test.ts` files or within `__tests__` folders near the code they cover.

## Build, Test, and Development Commands
Run `pnpm install` after cloning to sync workspace dependencies. Use `pnpm lint`, `pnpm format`, and `pnpm typecheck` from the repo root to match CI. Execute `pnpm test` for the Vitest suite; append `--filter shared-ev` (for example) to limit scope. Local endpoints run via `pnpm --filter services/api dev`, while `pnpm --filter apps/web dev` launches the web app against mocked APIs.

## Coding Style & Naming Conventions
ESLint + Prettier enforce 2-space indentation, semicolons, and single quotes. Prefer PascalCase for React components, zod schemas, and exported types; camelCase for variables and functions; kebab-case for non-component filenames. Shared helpers should live in `packages/shared-*`; avoid duplicating logic inside app or service folders.

## Testing Guidelines
Write Vitest specs that describe intent, e.g., `clampAPR.high-score.test.ts`. Cover happy paths, validations, and failure edges before opening a PR. Mock outbound calls with fixtures under `__mocks__` and keep new tests deterministic. Document any intentional coverage gaps in the PR checklist.

## Commit & Pull Request Guidelines
Use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`), scoping to a workspace where possible (`feat(shared-ev): adjust penalty bounds`). PRs must include a summary, linked issue or spec, test plan (commands executed), and UI screenshots when applicable. Require at least one approval and green CI before merge.

## Progress Tracking
After finishing any code change, review `todo.md` and check off the items covered so teammates can track incremental progress between sessions.

## Security & Configuration Tips
Never commit AWS credentials, OpenAI keys, or sample credit data. Store secrets in SSM Parameter Store and mirror required variables in `.env.example`. Any change touching consent flows or disclosure copy must note the new version in `services/api` events handling.
