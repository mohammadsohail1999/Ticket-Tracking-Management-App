# AI-Powered Ticket Tracking App

A ticket management system that uses AI to classify support tickets, draft replies grounded in a knowledge base, and route low-confidence cases to human agents — built to cut response time on high-volume support queues while keeping a human in the loop for anything the AI isn't confident about.

> **Status: in active development.** Project scaffolding, database, and admin-provisioned authentication are in place; ticket management, the AI pipeline, and the dashboard are being built next. See [Roadmap](#roadmap) below for what's done and what's in progress.

## Why this exists

Support teams that handle email-based tickets spend a lot of time on repetitive triage: reading each message, figuring out what it's about, and writing a reasonably personal reply. This project automates that first pass — an AI service classifies and summarizes each ticket and drafts a reply from a knowledge base. Replies the system is confident about can go out automatically; everything else is routed to an agent with the AI's draft attached as a starting point, so agents spend their time on judgment calls instead of repetitive typing.

## Features (planned + in progress)

- Ticket intake, list, and detail views with filtering/sorting by status, category, and priority
- AI-powered classification, summarization, and suggested replies grounded in a knowledge base (RAG)
- Confidence-based auto-send: high-confidence replies go out automatically, low-confidence ones route to an agent
- Role-based access (admin vs. agent) with admin-provisioned user accounts
- Admin dashboard with ticket volume/status overview and user management
- Full audit trail of AI decisions (input, output, confidence, action taken)

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite 8 |
| Backend | Node.js + Express 5, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 7 (driver adapters, `prisma-client` ESM generator) |
| Auth | [Better Auth](https://www.better-auth.com/) — email/password, admin-provisioned accounts, role-based access |
| AI provider | TBD |

### A few notable engineering decisions

- **The backend runs TypeScript natively** — no `ts-node`, no build step. Node's built-in type stripping executes `.ts` files directly; `tsc --noEmit` is used purely for type-checking. This keeps the dev loop simple and removes an entire class of build-tool configuration.
- **Prisma 7 with explicit driver adapters** — the client is constructed with a `@prisma/adapter-pg` adapter rather than a bare connection string, and generates a native-ESM TypeScript client (`prisma-client` generator) that runs directly under Node's type stripping alongside the rest of the app.
- **Auth is closed signup by design.** [Better Auth](https://www.better-auth.com/)'s email/password self-serve signup is disabled; accounts are provisioned by an admin through a separate, authenticated endpoint (`better-auth`'s admin plugin), matching how internal support tools are actually staffed.

## Project structure

This is two independent npm projects (no monorepo tooling) — install and run each separately:

```
backend/   Express API, TypeScript (ESM), Prisma 7 + PostgreSQL, Better Auth
frontend/  React 19 + Vite SPA
```

## Getting started

**Prerequisites:** Node ≥22.18.0, PostgreSQL 16.

```bash
# Database
brew services start postgresql@16
createdb ticket_tracking_dev

# Backend
cd backend
cp .env.example .env   # fill in DATABASE_URL, BETTER_AUTH_SECRET, etc.
npm install
npx prisma migrate dev
npm run dev             # http://localhost:4000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

The frontend dev server proxies `/api/*` requests to the backend, so no CORS configuration is needed locally.

## Roadmap

Full phase-by-phase plan lives in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md). High-level status:

- [x] Project scaffolding — backend/frontend skeletons, local Postgres, Prisma wired end-to-end
- [x] Authentication — Better Auth with admin-provisioned accounts and role-based access
- [ ] Core ticket management (CRUD, filtering, reply threads)
- [ ] Admin dashboard and user management UI
- [ ] AI integration (classification, summarization, suggested replies) — provider TBD
- [ ] Knowledge base + retrieval-augmented reply generation
- [ ] Real email ingestion and sending — approach TBD
- [ ] Deployment

## License

Not yet decided.
