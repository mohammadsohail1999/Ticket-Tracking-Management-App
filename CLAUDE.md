# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI-powered ticket management system. Product scope and feature list are in `project.md`; the phased build plan (with per-phase task checklists) is in `IMPLEMENTATION_PLAN.md` — check it before starting new work to see what phase the project is in and what's already been decided vs. still open (AI provider and email ingestion are unresolved as of writing).

The repo is two independent npm projects with no workspace/monorepo tooling — install and run commands separately in each:

- `backend/` — Express 5 API, TypeScript (ESM), run natively by Node with no build step, Prisma 7 ORM against PostgreSQL
- `frontend/` — React 19 + Vite 8 SPA, TypeScript (bundled/type-checked by Vite+tsc, not run natively by Node — a different TS setup than the backend's, see Architecture notes)

## Commands

**Backend** (run from `backend/`):
- `npm run dev` — start with nodemon (auto-restart on change)
- `npm start` — start without auto-restart
- `npm run typecheck` — run `tsc --noEmit`; the compiler never emits files in this project, only type-checks
- `npx prisma migrate dev --name <name>` — create and apply a migration in development
- `npx prisma migrate deploy` — apply committed migrations non-interactively; this is the only migration command safe for production/CI, never `migrate dev`
- `npx prisma generate` — regenerate the Prisma client; required after any `prisma/schema.prisma` change
- `npx prisma studio` — browse/edit data in a local GUI
- No test suite exists yet (`npm test` is a placeholder that exits with an error)

**Frontend** (run from `frontend/`):
- `npm run dev` — Vite dev server on :5173
- `npm run build` — `tsc -b && vite build`; type errors fail the build, not just a separate check
- `npm run typecheck` — `tsc -b` alone, no bundling; same type-check the build gates on
- `npm run lint` — runs `oxlint` (not eslint), with its `typescript` plugin enabled
- `npm run preview` — serve a production build locally

**Database**: local PostgreSQL 16 via Homebrew — `brew services start|stop postgresql@16`. Dev database is `ticket_tracking_dev`, connected as the local OS user (see `backend/.env` for the connection string).

## Architecture notes

- **The backend runs TypeScript natively via Node — no `ts-node`/`tsx`, no build step.** `npm run dev`/`npm start` execute `.ts` files directly (Node's built-in type-stripping, no flag needed on Node ≥22.18/23.6). `npx tsc --noEmit` (`npm run typecheck`) is type-checking only and never emits `.js`. This requires Node ≥22.18.0 (pinned via `backend/.nvmrc` and `package.json` `engines`) and TS syntax limited to what's erasable — no `enum`, `namespace`, or constructor parameter properties (`tsconfig.json` sets `erasableSyntaxOnly: true` to catch violations at type-check time).
- **Relative imports must use explicit `.ts` extensions** (e.g. `import app from "./app.ts"`) — real Node ESM requires exact file extensions on relative specifiers, and there's no bundler/compiler rewriting them. This is enabled by `allowImportingTsExtensions: true` in `tsconfig.json` (only legal alongside `noEmit: true`, which this project always uses).
- The backend is real ESM (`"type": "module"` in `package.json`), not CommonJS.
- **Prisma's config file is `backend/prisma7.config.ts`**, not the usual `prisma.config.ts` — Prisma names its config file by major version. The CLI finds it automatically when run from `backend/`; don't create a `prisma.config.ts` expecting it to take effect.
- **PrismaClient requires an explicit driver adapter in this Prisma version** — it can no longer be constructed from `DATABASE_URL` alone. `backend/src/lib/prisma.ts` builds a `PrismaPg` adapter (`@prisma/adapter-pg`) and passes it into the client; always `import prisma from "../lib/prisma.ts"` for the shared client instance instead of instantiating `PrismaClient` directly elsewhere.
- **The Prisma generator is the new `prisma-client` generator** (not the legacy `prisma-client-js`), configured for ESM TypeScript output (`moduleFormat = "esm"`, `generatedFileExtension`/`importFileExtension = "ts"`) so it runs directly under Node's native TS execution alongside the rest of the backend. Import the client from its `/client` subpath: `import { PrismaClient } from "../generated/prisma/client.ts"`.
- Generated Prisma client output lives at `backend/src/generated/prisma` (git-ignored, regenerated via `npx prisma generate`) — nothing imports from the `@prisma/client` package path directly.
- **All frontend API calls use relative `/api/...` paths**, proxied to `http://localhost:4000` by Vite's dev server (`frontend/vite.config.ts`). Keep using relative paths rather than hardcoding a backend host — this is what makes the same frontend code work in dev and once both are deployed behind the same origin.
- **The frontend's TypeScript setup is intentionally different from the backend's**, because Vite/esbuild bundles and transpiles the frontend instead of Node executing it directly: `frontend/tsconfig.app.json` uses `moduleResolution: "bundler"` (not the backend's `nodenext`) and has no `erasableSyntaxOnly` restriction, so frontend code isn't limited to erasable-only TS syntax the way backend code is. `frontend/tsconfig.json` is a project-references root pointing at `tsconfig.app.json` (the `src/` app, `noEmit: true`, checked by Vite/the editor) and `tsconfig.node.json` (just `vite.config.ts`, which runs under Node). Don't copy backend `tsconfig.json` conventions into the frontend or vice versa.
- **The frontend's better-auth client (`frontend/src/lib/auth-client.ts`) registers the `adminClient()` plugin** (`better-auth/client/plugins`) so `useSession()`'s inferred `data.user` type includes the `role`/`banned`/`banReason`/`banExpires` fields the backend's `admin` plugin (`backend/src/lib/auth.ts`) actually adds. If the backend's auth plugin list changes, check whether the frontend client's plugin list needs to change too, or the inferred types will silently drift from what the server returns.
- **Frontend styling is Tailwind CSS v4 via the `@tailwindcss/vite` plugin** (wired into `frontend/vite.config.ts`) — there is no `tailwind.config.js`/`postcss.config.js`; all configuration is CSS-first in `frontend/src/index.css`. All other per-component `.css` files have been removed; styling is done with utility classNames directly in JSX.
- **`frontend/src/index.css` is the single Tailwind entry point**, not a stylesheet of app styles. `@import "tailwindcss";` loads the framework; a `:root` block (plus its `@media (prefers-color-scheme: dark)` override) holds the app's color tokens as plain CSS custom properties — `--text`, `--text-h`, `--bg`, `--border`, `--accent`, `--accent-bg`, `--accent-border` — which is still the **only** dark-mode mechanism (pure OS-preference-driven, no JS toggle, no `.dark` class). An `@theme inline` block re-exposes each of those as a `--color-*` theme key, which is what makes classNames like `text-text-h`, `bg-accent`, `border-border` valid Tailwind utilities; the `inline` keyword is required so the generated CSS keeps referencing `var(--text-h)` (staying reactive to the dark-mode media query) rather than baking in a resolved value at build time — dropping `inline` would silently break dark mode. A separate plain `@theme` block sets `--font-sans` to the app's font stack. An `@layer base` block carries the few truly-global styles that can't be expressed as a component className (`body` margin/font-size/color/background, plus the responsive `min-width: 1024px` bump in base font-size).

## Authentication architecture

Email/password auth via Better Auth, with accounts **admin-provisioned only** — there is no public sign-up. Design rationale and full verification steps are in `AUTH_SETUP_PLAN.md`.

**Backend** (`backend/src/lib/auth.ts` — the single `betterAuth()` instance, exported as `auth` and imported everywhere else auth is needed):
- `prismaAdapter(prisma, { provider: "postgresql" })` — sessions/users/accounts live in the same Postgres DB as the rest of the app, via the shared `prisma` client (`backend/src/lib/prisma.ts`).
- `emailAndPassword.disableSignUp: true` — blocks the self-serve `/api/auth/sign-up/email` endpoint. This does **not** block the `admin` plugin's own create-user path, which is a separate code path (see Roles below) — that distinction is what makes "admin-provisioned only" work.
- `emailAndPassword.requireEmailVerification: true` plus `emailVerification.sendOnSignUp: true` — accounts must be verified before sign-in. Since there's no self-serve sign-up flow to send a real verification email through, admin-created accounts are instead created with `emailVerified: true` set directly (see adminController below) so they aren't locked out.
- `sendResetPassword` / `sendVerificationEmail` are both **console.log stubs**, not real email delivery — there's no email provider wired up yet (tracked as an open decision in `IMPLEMENTATION_PLAN.md`/`project.md`). Password reset and verification links only ever appear in the backend's terminal output.
- `plugins: [admin({ defaultRole: "agent", adminRoles: ["admin"] })]` — the `admin` plugin. `defaultRole` applies when a created user's `role` is omitted; `adminRoles` says which role value is treated as admin for the plugin's own internal permission checks (e.g. its create-user endpoint requires the caller to hold an `adminRoles` role). This is also what adds `role`/`banned`/`banReason`/`banExpires` to the `User` model (see the Prisma schema notes above).
- `trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:5173"]` — Better Auth's **own** origin allowlist, separate from the Express `cors()` middleware's `origin` option in `backend/src/app.ts` (which also reads `FRONTEND_URL`). Both must agree with whatever port the frontend dev server actually landed on. If the frontend starts on a different port (e.g. Vite falls back to `:5174` because `:5173` was already taken by a stale process), Better Auth logs `Invalid origin: http://localhost:5174` and every auth request fails client-side with a generic error — that log line, not the frontend code, is the first place to check when auth calls mysteriously fail after a `npm run dev` restart.

**Mounting and request flow** (`backend/src/app.ts`):
- `app.all("/api/auth/*splat", toNodeHandler(auth))` is mounted **before** `express.json()` — Better Auth's handler needs the raw request stream itself, so it must not be preceded by a body-parsing middleware that would consume it.
- `requireAuth` (`backend/src/middleware/auth.ts`) calls `auth.api.getSession(...)` on every protected request, attaches the result to `req.user`/`req.session` (typed via module augmentation on `Express.Request` in that same file), and returns `401` if there's no session.
- `requireRole(...roles)` runs after `requireAuth` and returns `403` if `req.user.role` isn't in the allowed list — this is how admin-only endpoints are gated (e.g. `backend/src/routes/admin.ts`: `router.post("/users", requireAuth, requireRole("admin"), createUser)`).

**Roles and admin-provisioned users**:
- Two roles exist: `admin` and `agent` (no "customer"/end-user role yet — ticket submitters are out of scope until email ingestion is designed).
- New users are created exclusively through `POST /api/admin/users` (`backend/src/controllers/adminController.ts`, admin-only per the route guard above), which calls `auth.api.createUser(...)` — the `admin` plugin's own creation method, not the public sign-up endpoint — forwarding the calling admin's session headers so the plugin's internal permission check passes, and always passing `data: { emailVerified: true }` so the new account isn't blocked by `requireEmailVerification`.
- Errors from that call are narrowed with `err instanceof APIError` (from `better-auth`) and mapped to `err.statusCode`/`err.body?.message`, rather than special-casing individual Better Auth error strings.
- `backend/prisma/seed.ts` bootstraps two dev users the same way (`auth.api.createUser` directly, no HTTP round-trip): `admin@example.com` / `agent@example.com`, password `Test@123` by default (overridable via `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`AGENT_EMAIL`/`AGENT_PASSWORD` env vars). Run via `npm run seed` (`backend/package.json`) — it wipes `verification`/`session`/`account`/`user` tables first, so only use it in dev.

**Frontend** (`frontend/src/lib/auth-client.ts` and consumers):
- One `authClient` instance (`createAuthClient({ plugins: [adminClient()] })`), re-exporting `useSession`, `signIn`, `signOut`. No `baseURL` is configured — the frontend and backend are same-origin in production, and Vite's `/api` dev proxy makes them same-origin in dev too, so relative requests against Better Auth's default `/api/auth` basePath work without hardcoding a host.
- `ProtectedRoute`/`GuestOnlyRoute` (`frontend/src/routes/`) both branch on `useSession()`'s `isPending`/`data` — showing a loading state while pending, then either redirecting or rendering. `ProtectedRoute` redirects unauthenticated users to `/login` carrying `state: { from: location }` (typed as `AuthRedirectState`, `frontend/src/types/auth.ts`) so `LoginPage` can send them back to the page they originally wanted after signing in.
- `LoginPage` (`frontend/src/pages/LoginPage.tsx`) calls `signIn.email(...)` and special-cases `error.status === 403` (unverified email) with a distinct message from other sign-in failures — the one place in the frontend that depends on a specific Better Auth error status code rather than just showing `error.message`.
