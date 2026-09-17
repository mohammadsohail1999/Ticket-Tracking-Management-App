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

- **Backend runs TypeScript natively via Node** — no `ts-node`/`tsx`, no build step; `npm run typecheck` (`tsc --noEmit`) never emits. Requires Node ≥22.18 (pinned in `backend/.nvmrc`/`engines`). TS syntax is erasable-only (`erasableSyntaxOnly: true`) — no `enum`, `namespace`, or constructor parameter properties.
- Relative imports need explicit `.ts` extensions (`allowImportingTsExtensions: true`) — real Node ESM requires exact extensions. Backend is real ESM (`"type": "module"`).
- Prisma's config file is `backend/prisma7.config.ts` (versioned filename), not `prisma.config.ts`.
- **PrismaClient needs an explicit driver adapter** (`PrismaPg`, built in `backend/src/lib/prisma.ts`) — can't be constructed from `DATABASE_URL` alone. Always `import prisma from "../lib/prisma.ts"`; don't instantiate `PrismaClient` elsewhere.
- Uses the new `prisma-client` generator (ESM TS output) — import from `../generated/prisma/client.ts`, not `@prisma/client`. Output lives at `backend/src/generated/prisma`, git-ignored, regenerate via `npx prisma generate` after schema changes.
- Frontend API calls use relative `/api/...` paths (proxied to `:4000` by Vite dev server) — keep relative, don't hardcode a backend host.
- **Frontend TS setup intentionally differs from backend's**: `frontend/tsconfig.app.json` uses `moduleResolution: "bundler"`, no `erasableSyntaxOnly`. Don't cross-apply backend/frontend tsconfig conventions.
- `frontend/src/lib/auth-client.ts` registers the `adminClient()` plugin so `useSession()`'s type includes `role`/`banned`/etc. matching the backend's `admin` plugin — if the backend's auth plugin list changes, check whether the frontend client's needs to as well.
- Styling is Tailwind CSS v4 via `@tailwindcss/vite`, config is CSS-first in `frontend/src/index.css` (no `tailwind.config.js`); no per-component `.css` files.
- UI components are shadcn/ui, installed manually (not `npx shadcn init`) — see `frontend/components.json` (`new-york`, `neutral`, `@/*` aliases). Add primitives via `npx shadcn@latest add <component>` from `frontend/`.
- `@/*` → `frontend/src/*`, configured redundantly in three places that must stay in sync: `tsconfig.json` and `tsconfig.app.json` `paths`, and `vite.config.ts`'s `resolve.alias`.
- **Dark mode is purely OS-preference-driven** (`@media (prefers-color-scheme: dark)` in `index.css`) — no JS toggle, no `.dark` class. Don't add shadcn's `@custom-variant dark (&:is(.dark *));` line or a `.dark {}` block; nothing ever adds a `.dark` class, so it would silently do nothing.
- `sonner`'s `<Toaster />` is mounted in `frontend/src/App.tsx`. Its `next-themes` hook has no `ThemeProvider` on purpose — it falls back to `prefers-color-scheme` correctly on its own. Don't add a provider just to satisfy it.

## Authentication architecture

Email/password auth via Better Auth, accounts **admin-provisioned only** (no public sign-up). Design rationale and verification steps are in `AUTH_SETUP_PLAN.md`.

**Backend** (`backend/src/lib/auth.ts` — single `betterAuth()` instance, exported as `auth`):
- `prismaAdapter` shares the app's Postgres DB via `backend/src/lib/prisma.ts`.
- `emailAndPassword.disableSignUp: true` blocks self-serve sign-up but **not** the `admin` plugin's own create-user path — that's what makes admin-provisioning work.
- `requireEmailVerification: true` — admin-created accounts get `emailVerified: true` set directly (no self-serve flow to verify through).
- `sendResetPassword`/`sendVerificationEmail` are **console.log stubs** — no email provider wired up yet; reset/verification links only appear in the backend terminal.
- `plugins: [admin({ defaultRole: "agent", adminRoles: ["admin"] })]` adds `role`/`banned`/`banReason`/`banExpires` to `User`.
- `trustedOrigins` (Better Auth's own allowlist) and Express `cors()`'s `origin` (`backend/src/app.ts`) both read `FRONTEND_URL` and must agree with whatever port the frontend actually lands on. If Vite falls back to `:5174`, Better Auth logs `Invalid origin: ...` — check that log line first when auth calls fail after a restart.

**Request flow** (`backend/src/app.ts`): the auth handler (`app.all("/api/auth/*splat", toNodeHandler(auth))`) is mounted **before** `express.json()`, since it needs the raw request stream. `requireAuth` (`backend/src/middleware/auth.ts`) sets `req.user`/`req.session` via `auth.api.getSession(...)`, 401s if absent. `requireRole(...roles)` runs after it and 403s if `req.user.role` isn't allowed.

**Roles**: `admin` and `agent` only (no end-user role yet). Users are created exclusively through `POST /api/admin/users` (`backend/src/controllers/adminController.ts`) via `auth.api.createUser(...)`, forwarding the caller's session headers and `data: { emailVerified: true }`. Errors are narrowed with `err instanceof APIError` and mapped to `err.statusCode`/`err.body?.message`. `backend/prisma/seed.ts` bootstraps `admin@example.com`/`agent@example.com` (password `Test@123`, overridable via env vars) the same way — it wipes the auth tables first, dev only. `GET /api/admin/users` (`listUsers`, same file) lists all users via `auth.api.listUsers`, same `requireAuth`+`requireRole("admin")` guard chain — currently the only other admin endpoint besides create; list/ban/set-role/delete UI beyond viewing is not built yet.

**Frontend**: `frontend/src/lib/auth-client.ts` exports one `authClient` (`adminClient()` plugin, no `baseURL` needed — same-origin via Vite's `/api` proxy). `ProtectedRoute`/`GuestOnlyRoute` branch on `useSession()`; `ProtectedRoute` redirects to `/login` with `state: { from: location }` so `LoginPage` can send users back after sign-in. `LoginPage` special-cases `error.status === 403` (unverified email) with a distinct message. `AdminOnlyRoute` (`frontend/src/routes/AdminOnlyRoute.tsx`) is a second, role-gating guard nested inside `ProtectedRoute` for admin-only pages (currently just `/users` → `UsersPage`) — it redirects non-admins to `/` rather than `/login`, since they're authenticated, just not authorized. `Navbar` shows a "Users" link only when `session.user.role === 'admin'`; the actual authorization boundary is always the backend route guard, not this client-side check.

## Subagents

`.claude/agents/security-auditor.md` — project-scoped subagent that audits the codebase for security issues (auth, access control, injection, XSS, secrets, dependency CVEs). Defaults to a read-only audit mode that only reports findings; it only edits files in a separate follow-up invocation that explicitly names which findings to fix.
