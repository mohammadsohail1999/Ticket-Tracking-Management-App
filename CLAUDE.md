# CLAUDE.md

AI-powered ticket management system. Scope is in `project.md`; the phased build plan and open decisions (AI provider, email ingestion) are in `IMPLEMENTATION_PLAN.md` — check it before starting new work.

Three independent npm projects, no workspace tooling — install/run in each: `backend/` (Express 5, Prisma 7, PostgreSQL), `frontend/` (React 19 + Vite 8), `e2e/` (Playwright, no specs yet).

## Commands

Scripts are in each `package.json`; only the non-obvious ones are listed here.

**Backend**
- `npm run typecheck` — `tsc --noEmit`; the compiler never emits (no build step).
- `npx prisma generate` — required after any `schema.prisma` change.
- `npx prisma migrate dev --name <name>` in dev; `npx prisma migrate deploy` is the only one safe for prod/CI.
- `npm run studio` — Prisma Studio on the dev DB (E2E DB: `npm run db:studio` in `e2e/`).
- No test suite (`npm test` is a placeholder).

**Frontend**
- `npm run build` is `tsc -b && vite build` — type errors fail it; `npm run typecheck` is the same check alone.
- `npm run lint` runs `oxlint`, not eslint.
- `npm test` runs Vitest + React Testing Library (jsdom); `npm run test:watch` for watch mode. Tests are colocated as `*.test.tsx` under `src/`, so `tsc -b` typechecks them. Vitest globals are off — import `describe`/`it`/`expect`/`vi` from `vitest` (`src/test/setup.ts` registers jest-dom matchers and RTL cleanup). Stub the network with `vi.spyOn(api, 'get')` from `@/lib/api` rather than mocking hooks, and use a fresh `QueryClient({ defaultOptions: { queries: { retry: false } } })` per render, not the shared `queryClient`.

**E2E**
- `npm run db:prepare` (also Playwright's `globalSetup`) creates `ticket_tracking_test`, runs `migrate deploy`, and reseeds — **the test DB is wiped on every run**.
- Playwright boots its own backend (:4100) and Vite (:5273), so it can run alongside `npm run dev`.

**Database**: Postgres 16 via Homebrew (`brew services start|stop postgresql@16`). Dev DB `ticket_tracking_dev` (connection string in `backend/.env`); E2E uses `ticket_tracking_test` (override: `E2E_DATABASE_URL`). `e2e/support/env.ts` throws unless the DB name ends in `_test`, so an override can't wipe dev data.

## Architecture notes

- **Backend runs TS natively on Node ≥22.18** (no ts-node/tsx). Real ESM: relative imports need explicit `.ts` extensions. `erasableSyntaxOnly` is on — no `enum`, `namespace`, or constructor parameter properties.
- **Backend request bodies are validated with zod**: define the schema in `backend/src/schemas/` and mount `validate(schema)` (`middleware/validate.ts`) after the auth guards. Failures become a `ValidationError` → 400 `{ error: "<field>: <msg>; ...", details: { fieldErrors } }`; `error` must stay a single string because the frontend `ApiError` reads it.
- **Frontend TS setup intentionally differs** (`moduleResolution: "bundler"`, no `erasableSyntaxOnly`). Don't cross-apply tsconfig conventions.
- Prisma config file is `backend/prisma7.config.ts`, not `prisma.config.ts`.
- **PrismaClient needs the `PrismaPg` driver adapter** — always `import prisma from "../lib/prisma.ts"`; never instantiate it elsewhere. Import generated types from `../generated/prisma/client.ts` (git-ignored, output of `prisma generate`), not `@prisma/client`.
- Frontend API calls use relative `/api/...` (Vite proxies to :4000, or `API_PROXY_TARGET`) — never hardcode a backend host.
- **E2E isolation depends on `dotenv/config` not overriding already-set vars**: `e2e/playwright.config.ts` injects `DATABASE_URL`, `PORT`, `FRONTEND_URL` etc. (`BACKEND_ENV` in `e2e/support/env.ts`) into spawned processes, beating `backend/.env`. Its `webServer` entries use `reuseExistingServer: false` on purpose — reusing a dev server would hit the dev DB.
- **Server data goes through TanStack Query v5**: one `queryClient` in `frontend/src/lib/query-client.ts`, HTTP via the shared axios instance `api` (`lib/api.ts`; its interceptor turns every failure into an `ApiError` with `status`, 0 for network errors), and one `use*` hook per resource in `frontend/src/hooks/` built on `queryOptions()`. Mutations should `invalidateQueries` the affected key. `Navbar` calls `queryClient.clear()` on sign-out. Session state stays on Better Auth's `useSession` — don't move it into Query.
- Tailwind v4, CSS-first config in `frontend/src/index.css` (no `tailwind.config.js`, no per-component `.css`). shadcn/ui installed manually: add primitives with `npx shadcn@latest add <component>` from `frontend/`.
- `@/*` → `frontend/src/*`, defined in three places that must stay in sync: `tsconfig.json`, `tsconfig.app.json`, `vite.config.ts`.
- **Dark mode is OS-preference only** (`prefers-color-scheme` in `index.css`). Don't add a `.dark` class, shadcn's `@custom-variant dark` line, or a `ThemeProvider` — nothing would use them. Same reason `sonner`'s `<Toaster />` (in `App.tsx`) has no provider.

## Authentication

Better Auth, email/password, **admin-provisioned only** (no public sign-up). Rationale in `AUTH_SETUP_PLAN.md`.

- Single `betterAuth()` instance in `backend/src/lib/auth.ts`. `disableSignUp: true` blocks self-serve sign-up but not the `admin` plugin's create-user path, which is how provisioning works. Default role `agent`; roles are `admin`/`agent` only.
- **`rateLimit.enabled` is on unless `NODE_ENV` is explicitly `development` or `test`.** Don't simplify to `!== "production"` — an unset `NODE_ENV` in a deploy must keep brute-force protection on (a prior security audit fixed this).
- `sendResetPassword`/`sendVerificationEmail` are `console.log` stubs — links only appear in the backend terminal.
- Admin-created users get `emailVerified: true` directly (`requireEmailVerification` is on). Users are created only via `POST /api/admin/users` (`adminController.ts`); `seed.ts` bootstraps `admin@example.com`/`agent@example.com` (`Test@123`) and wipes auth tables — dev only.
- `trustedOrigins` and Express `cors()` both read `FRONTEND_URL` and must match the frontend's real port. If Vite falls back to :5174, look for `Invalid origin: ...` in the backend log first.
- **Request flow** (`backend/src/app.ts`): the auth handler is mounted **before** `express.json()` (needs the raw stream). `requireAuth` sets `req.user`/`req.session` (401 if absent); `requireRole(...)` runs after it (403).
- Frontend: one `authClient` in `frontend/src/lib/auth-client.ts` with `adminClient()` — keep its plugins in sync with the backend's so `useSession()` types include `role`. `ProtectedRoute`/`GuestOnlyRoute`/`AdminOnlyRoute` branch on the session; the real authorization boundary is always the backend guard, not client-side checks.

## Subagents

`.claude/agents/security-auditor.md` audits for security issues; read-only by default, edits only when a follow-up invocation names findings to fix.

`.claude/agents/e2e-test-writer.md` writes and runs Playwright specs in `e2e/`. **Any request to write or extend E2E tests goes to this agent automatically** (`subagent_type: "e2e-test-writer"`) — the user shouldn't have to name it. It never edits `backend/` or `frontend/`; app bugs it finds are reported back.
