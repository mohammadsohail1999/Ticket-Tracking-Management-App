# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI-powered ticket management system. Product scope and feature list are in `project.md`; the phased build plan (with per-phase task checklists) is in `IMPLEMENTATION_PLAN.md` — check it before starting new work to see what phase the project is in and what's already been decided vs. still open (AI provider and email ingestion are unresolved as of writing).

The repo is two independent npm projects with no workspace/monorepo tooling — install and run commands separately in each:

- `backend/` — Express 5 API, CommonJS, Prisma 7 ORM against PostgreSQL
- `frontend/` — React 19 + Vite 8 SPA

## Commands

**Backend** (run from `backend/`):
- `npm run dev` — start with nodemon (auto-restart on change)
- `npm start` — start without auto-restart
- `npx prisma migrate dev --name <name>` — create and apply a migration in development
- `npx prisma migrate deploy` — apply committed migrations non-interactively; this is the only migration command safe for production/CI, never `migrate dev`
- `npx prisma generate` — regenerate the Prisma client; required after any `prisma/schema.prisma` change
- `npx prisma studio` — browse/edit data in a local GUI
- No test suite exists yet (`npm test` is a placeholder that exits with an error)

**Frontend** (run from `frontend/`):
- `npm run dev` — Vite dev server on :5173
- `npm run build` — production build
- `npm run lint` — runs `oxlint` (not eslint)
- `npm run preview` — serve a production build locally

**Database**: local PostgreSQL 16 via Homebrew — `brew services start|stop postgresql@16`. Dev database is `ticket_tracking_dev`, connected as the local OS user (see `backend/.env` for the connection string).

## Architecture notes

- **Prisma's config file is `backend/prisma7.config.ts`**, not the usual `prisma.config.ts` — Prisma names its config file by major version. The CLI finds it automatically when run from `backend/`; don't create a `prisma.config.ts` expecting it to take effect.
- **PrismaClient requires an explicit driver adapter in this Prisma version** — it can no longer be constructed from `DATABASE_URL` alone. `backend/src/lib/prisma.js` builds a `PrismaPg` adapter (`@prisma/adapter-pg`) and passes it into the client; always `require('../lib/prisma')` for the shared client instance instead of instantiating `PrismaClient` directly elsewhere.
- **The Prisma generator is pinned to `prisma-client-js`** (the legacy generator) rather than the new default `prisma-client` generator, because the new one only emits TypeScript source meant to be bundled, which doesn't run under this project's plain CommonJS backend.
- Generated Prisma client output lives at `backend/src/generated/prisma` (git-ignored, regenerated via `npx prisma generate`) — nothing imports from the `@prisma/client` package path directly.
- **All frontend API calls use relative `/api/...` paths**, proxied to `http://localhost:4000` by Vite's dev server (`frontend/vite.config.js`). Keep using relative paths rather than hardcoding a backend host — this is what makes the same frontend code work in dev and once both are deployed behind the same origin.
