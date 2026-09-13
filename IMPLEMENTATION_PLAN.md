# Implementation Plan

Reference: see `project.md` for problem/solution/features/tech stack.

AI provider and real email ingestion are not yet decided (see `project.md`). This plan builds the app around stubs/manual input first (Phases 0–3), then swaps in the real AI provider (Phase 4/6) and real email (Phase 7) once those decisions are made — nothing earlier blocks on them.

---

## Phase 0 — Project Setup

- [x] Initialize git repository
- [x] Set up backend skeleton (Node.js + Express, folder structure: routes/controllers/models)
- [x] Set up frontend skeleton (React app)
- [x] Install and configure local PostgreSQL
- [x] Install Prisma, initialize schema, and confirm a first empty migration runs against local Postgres
- [x] Set up `.env` handling for both backend and frontend (DB connection, session secret, etc.)
- [x] Connect backend to local Postgres via Prisma and confirm a basic health-check endpoint works
- [x] Connect frontend to backend (basic fetch/proxy working end-to-end)

## Phase 1 — Users & Auth

- [ ] Design `users` table (id, name, email, password_hash, role, timestamps)
- [ ] Migration: create `users` table
- [ ] Design `sessions` table for database-backed sessions
- [ ] Backend: signup/login endpoint (hash passwords, create session row)
- [ ] Backend: logout endpoint (destroy session row)
- [ ] Backend: auth middleware (attach current user from session)
- [ ] Backend: role middleware (require admin / require agent)
- [ ] Seed script: create an initial admin user
- [ ] Frontend: login page
- [ ] Frontend: auth context/hook (current user, logout)
- [ ] Frontend: protected routes (redirect to login if no session)

## Phase 2 — Core Ticket Management (manual ticket creation)

- [ ] Design `tickets` table (id, subject, sender_email, status, category, priority, assigned_agent_id, timestamps)
- [ ] Design `ticket_messages` table (id, ticket_id, author_type [student/agent/ai], body, created_at)
- [ ] Migration: create `tickets` and `ticket_messages` tables
- [ ] Backend: create ticket endpoint (simulates an incoming email for now — manual form/API input)
- [ ] Backend: list tickets endpoint (filter by status/category/priority, sort by date)
- [ ] Backend: get single ticket + its message thread
- [ ] Backend: update ticket endpoint (status, category, priority, assignment)
- [ ] Backend: add reply to ticket (creates a `ticket_messages` row, agent-authored)
- [ ] Frontend: ticket list page with filter + sort controls
- [ ] Frontend: ticket detail page (thread view + reply box)
- [ ] Frontend: "new ticket" form (stand-in for real email ingestion)

## Phase 3 — Dashboard & Admin

- [ ] Backend: dashboard summary endpoint (counts by status/category/priority)
- [ ] Frontend: dashboard page (overview widgets)
- [ ] Backend: user management endpoints (list/create/deactivate agents) — admin only
- [ ] Frontend: user management page — admin only
- [ ] Frontend: role-based UI (hide admin-only pages/actions from agents)

## Phase 4 — AI Integration (stubbed)

- [ ] Define an internal AI service interface: `classify(ticket)`, `summarize(ticket)`, `suggestReply(ticket)`, `getConfidence(ticket)`
- [ ] Implement a stub version of each (canned/rule-based output) so the rest of the app can be built against a stable interface
- [ ] Wire `classify` into ticket creation (auto-fill category)
- [ ] Wire `summarize` into the ticket detail page (shown to agent)
- [ ] Wire `suggestReply` into the ticket detail page (editable draft in the reply box)
- [ ] Add a per-category "auto-send threshold" setting (admin-configurable), used later once confidence is real
- [ ] Add ticket field/flag for "AI-resolved" vs "agent-resolved" so this is trackable from day one

## Phase 5 — Knowledge Base

- [ ] Design `kb_articles` table (id, title, content, tags, timestamps)
- [ ] Migration: create `kb_articles` table
- [ ] Backend: CRUD endpoints for KB articles — admin only
- [ ] Frontend: KB management page (list/create/edit/delete articles) — admin only
- [ ] Wire KB into the stub `suggestReply` (simple keyword/title match for now; real retrieval comes in Phase 6)

## Phase 6 — Real AI Provider Integration

*(Blocked on: AI provider decision)*

- [ ] Choose and configure the AI provider/API
- [ ] Replace stub `classify`/`summarize`/`suggestReply` with real API calls
- [ ] Add embeddings + vector search (e.g. `pgvector`) for real knowledge-base retrieval (RAG)
- [ ] Implement real confidence scoring, replacing the stub
- [ ] Wire confidence score to the auto-send threshold from Phase 4: high confidence → auto-send + mark resolved; low confidence → route to agent with AI draft attached
- [ ] Log every AI decision (input, output, confidence, action taken) for accountability/debugging

## Phase 7 — Real Email Ingestion & Sending

*(Blocked on: email provider/approach decision)*

- [ ] Choose inbound email approach (e.g. provider webhook, IMAP polling, Gmail/Outlook API)
- [ ] Backend: inbound email endpoint/listener → creates a ticket (replacing the Phase 2 manual form as the primary path)
- [ ] Thread matching: detect replies to an existing ticket vs. a new ticket
- [ ] Choose outbound email approach and wire agent replies + AI auto-replies to actually send as email
- [ ] Handle bounces/auto-replies/spam filtering on inbound mail

## Phase 8 — Polish & Deployment

- [ ] Input validation and error handling across all endpoints
- [ ] Basic automated tests (auth, ticket CRUD, AI service interface)
- [ ] SLA/status lifecycle review (reopen flow, stale ticket handling)
- [ ] Host PostgreSQL (move off local)
- [ ] Deploy backend and frontend
- [ ] Production environment variables/secrets review