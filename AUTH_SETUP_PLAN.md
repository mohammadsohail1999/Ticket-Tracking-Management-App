# Backend plans: TS migration (done), then Better Auth setup (pending)

> Moved here from `~/.claude/plans/` so it's tracked in the repo instead of only on one machine.

**Status:**
- ✅ **Plan 1 — TS migration**: implemented and committed (`c4f3761`, "Migrate backend from CommonJS JS to TypeScript (ESM, native Node execution)"). Kept below for reference/context.
- ⏳ **Plan 2 — Better Auth setup**: not yet implemented. Written against the pre-migration CommonJS backend — before implementing, re-check the file paths/import styles against the now-TypeScript/ESM backend (e.g. `require(...)` → `import ... from "...ts"`, `module.exports` → `export`, `src/lib/auth.js` → `src/lib/auth.ts`). The underlying design decisions (admin plugin, `disableSignUp`, email verification stub, etc.) are unaffected by the language change.

---

# Plan 1 — Migrate backend from JavaScript to TypeScript ✅ Done

## Context

The backend (`backend/src/`) is currently plain CommonJS JavaScript — five small files (`app.js`, `index.js`, `routes/health.js`, `controllers/healthController.js`, `lib/prisma.js`) plus the git-ignored generated Prisma client. No auth code was actually implemented (that plan is paused — see Plan 2 below), so this is a clean, small migration: convert these five files to TypeScript, add the compiler config, and switch Prisma's generator to its new TS-native output. There's no existing TypeScript convention anywhere else in the repo to match (the frontend has `@types/react`/`@types/react-dom` installed but no `.ts`/`.tsx` files, no `typescript` package, and no `tsconfig.json` — it's plain JS/JSX; not part of this migration).

**Decisions confirmed with the user:**
1. **Native Node.js TypeScript execution** — no build step, no `ts-node`/`tsx` dependency. The locally installed Node (`v25.9.0`, nvm-managed) runs `.ts` files directly via its built-in type-stripping. `tsc` is used only for type-checking (`tsc --noEmit`), never for emitting.
2. **Full `strict: true`** tsconfig.
3. **Switch Prisma's generator** from the legacy `prisma-client-js` to the new `prisma-client` generator (TS-native output), since the old generator's CommonJS justification (documented in `CLAUDE.md`) no longer applies once the backend is TypeScript.
4. **Switch to real ESM** (`"type": "module"` in `package.json`) rather than staying CommonJS.

These four choices reinforce each other: Prisma's new `prisma-client` generator is specifically designed to emit ESM TypeScript source meant to run directly (not through a bundler) — verified via Prisma's own docs, which show exactly this `moduleFormat: "esm"` + `importFileExtension: "ts"` configuration for native-execution setups. And going ESM removes the current reliance on Node's require-of-ESM interop for loading `better-auth` (relevant once Plan 2 resumes).

## Key technical facts verified against current docs/source (don't re-derive)

- **Node's native TS support**: type-stripping is enabled by default (no flag) from Node ≥23.6 (also backported to the 22.18 LTS line); only "erasable" syntax works without extra flags — no `enum`, no `namespace`, no parameter-property shorthand in constructors. None of the current code uses any of these, and none are needed for a small Express/Prisma backend. Add `erasableSyntaxOnly: true` to `tsconfig.json` so any accidental use of non-erasable syntax is caught by `tsc --noEmit` instead of failing at runtime.
- **Relative imports need explicit extensions.** Under real Node ESM (no bundler, no tsc emit), relative import specifiers must include the exact file extension — Node does not guess. Since we're not emitting compiled `.js`, imports must reference the real `.ts` files directly (e.g. `import app from "./app.ts"`), which requires `allowImportingTsExtensions: true` in `tsconfig.json` — a flag TypeScript only permits alongside `noEmit: true` (which we have anyway, since `tsc` is type-check-only here). This is exactly the setup TypeScript's own docs describe for "TypeScript-native runtimes."
- **New Prisma generator config** (confirmed against Prisma's docs), replacing the current `generator client` block in `backend/prisma/schema.prisma`:
  ```prisma
  generator client {
    provider = "prisma-client"
    output   = "../src/generated/prisma"

    runtime                = "nodejs"
    moduleFormat           = "esm"
    generatedFileExtension = "ts"
    importFileExtension    = "ts"
  }
  ```
  No schema model changes — this only changes generator output, so **no new migration is needed**, just `npx prisma generate`.
- **New import path for the generated client** changes from `require("../generated/prisma")` to `import { PrismaClient } from "../generated/prisma/client.ts"` — note the required `/client` subpath (confirmed in Prisma's docs/examples) plus the explicit `.ts` extension (required under our native-ESM-execution setup; Prisma's own docs examples sometimes omit the extension because they assume bundler-based resolution, which doesn't apply here).
- **`@types/express`/`@types/cors`**: added as devDependencies since neither package ships first-party `.d.ts`.
- `dotenv`, `@prisma/client`/`@prisma/adapter-pg`, and `better-auth` are all TS-native or ship their own types already — no extra `@types/*` needed for those.

## What was actually built

| File | Action |
|---|---|
| `backend/tsconfig.json` | new |
| `backend/package.json` | edited — `type`, `main`, scripts, devDependencies, `engines`, nodemon config |
| `backend/.nvmrc` | new — pins `25.9.0` |
| `backend/prisma/schema.prisma` | edited — generator block only |
| `backend/src/app.ts`, `index.ts`, `routes/health.ts`, `controllers/healthController.ts`, `lib/prisma.ts` | rewritten from `.js`, ESM syntax, explicit `.ts` import extensions |
| `CLAUDE.md` | edited — architecture notes updated for TS/ESM/native execution |

`nodemon` needed an explicit `"exec": "node"` in `nodemonConfig` — its default behavior tries to shell out to `ts-node` for `.ts` files, which isn't installed here (native execution was the whole point).

## Verification performed

1. `npm run typecheck` → zero errors.
2. `node src/index.ts` and `npm run dev` (nodemon) both serve `/api/health` correctly against the real dev DB.
3. Stopping Postgres → `503 {"status":"error","database":"unreachable"}`; restarting → back to `200`.
4. `nodemon` restarts on a `.ts` file save (confirms the `nodemonConfig.ext`/`exec` fix).
5. `better-auth` (unused in code so far, just a dependency) resolves fine under the new ESM setup.
6. Both backend (`:4000`) and frontend (`:5173`, via Vite's `/api` proxy) run together correctly.

---

# Plan 2 — Better Auth setup (email/password + database sessions) — next up

## Context

`project.md` specifies "Auth: Database-backed sessions" and two roles (Admin, Agent). `IMPLEMENTATION_PLAN.md` Phase 1 ("Users & Auth") is next up but its checklist pre-dates the decision to use Better Auth and describes a hand-rolled `users`/`sessions`/password-hash design that no longer applies.

A prior commit (`cd0e951`) already added `better-auth@^1.7.4` as a dependency and the stock Better Auth Prisma schema (`User`/`Session`/`Account`/`Verification`), with the migration applied to the local dev DB (`npx prisma migrate status` confirmed "Database schema is up to date!" at the time). Four Better Auth reference skill docs are installed under `.claude/skills/`. However **zero server-side wiring exists** — no `auth.js`/`auth.ts` config, no route mount, no middleware, no `role` field on `User`. This plan implements that wiring so Phase 1 (backend half) is complete: admins can be provisioned, agents can be created by an admin, and both can sign in with database-backed sessions.

**Decisions confirmed with the user:**
1. Add a `role` field (`"admin"` | `"agent"`) now, plus role middleware for future routes.
2. Admin-provisioned signup only — no public self-service signup.
3. Require email verification (`requireEmailVerification: true`), stubbed to `console.log` (no email provider chosen yet).
4. Wire password reset (`sendResetPassword`) now too, also stubbed to `console.log`.

**Design choice:** use Better Auth's built-in **`admin` plugin** (`admin({ defaultRole: "agent", adminRoles: ["admin"] })`) rather than hand-rolling role logic. Its `POST /admin/create-user` endpoint is a separate code path from the public `/sign-up/email` endpoint (confirmed in Better Auth's source, `plugins/admin/routes.ts`) — so it is **not** affected by `disableSignUp: true`, which is exactly the mechanism needed for admin-provisioned user creation without reimplementing password hashing/account linking by hand. Cost accepted: the plugin also adds unused `banned`/`banReason`/`banExpires` columns to `User` — no ban functionality will be built, this is just schema noise we accept in exchange for reusing an officially-supported, tested mechanism.

For bootstrapping the very first admin, Better Auth ships a purpose-built CLI command, `create-admin` (confirmed in Better Auth's CLI docs/README), which uses the same server-side `auth.api.createUser` path, hashes the password, and **auto-marks the created admin's email as verified by default** — this avoids writing a custom seed script and sidesteps any question about calling admin-plugin endpoints without a request/session context.

## Files to add/change

| File | Action |
|---|---|
| `backend/.env.example` / `backend/.env` | remove stale `SESSION_SECRET`; add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FRONTEND_URL` |
| `backend/prisma/schema.prisma` | regenerate via Better Auth CLI — add `role`, `banned`, `banReason`, `banExpires` to `User` |
| `backend/prisma/migrations/<ts>_add_role_and_admin_fields/` | new migration (`prisma migrate dev`) |
| `backend/src/lib/auth.ts` | new — the Better Auth server instance |
| `backend/src/app.ts` | edit — mount auth handler before body parser, fix CORS |
| `backend/src/middleware/auth.ts` | new — `requireAuth`, `requireRole` |
| `backend/src/routes/admin.ts` + `backend/src/controllers/adminController.ts` | new — admin-only `POST /api/admin/users` |
| `IMPLEMENTATION_PLAN.md` | **not edited** — flagged as a followup only (see below) |

No new npm installs — `better-auth`, `@prisma/adapter-pg`, `@prisma/client` are already dependencies; the schema-generation CLI runs transiently via `npx`.

## 1. Environment variables

`backend/.env.example` and `backend/.env`:
- Remove `SESSION_SECRET` (grep-confirmed unused anywhere in code — a stale leftover from the pre-Better-Auth plan).
- Add `BETTER_AUTH_SECRET` (32+ chars — generate via `openssl rand -base64 32` for `.env`; placeholder comment in `.env.example`).
- Add `BETTER_AUTH_URL="http://localhost:4000"` — the **backend's own origin** (where `/api/auth/*` is mounted), not the frontend's Vite origin.
- Add `FRONTEND_URL="http://localhost:5173"` — used for CORS `origin` and Better Auth `trustedOrigins` (the browser sends this as its `Origin` header even though requests are proxied through Vite).

## 2. `backend/src/lib/auth.ts` (new)

The single Better Auth server instance, reused by `app.ts`, `middleware/auth.ts`, and `controllers/adminController.ts`.

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins/admin"; // fallback: import { admin } from "better-auth/plugins"
import prisma from "./prisma.ts"; // existing shared singleton — never instantiate a new PrismaClient here
```

Config:
- `database: prismaAdapter(prisma, { provider: "postgresql" })`
- `secret: process.env.BETTER_AUTH_SECRET`, `baseURL: process.env.BETTER_AUTH_URL`
- `trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:5173"]`
- `emailAndPassword: { enabled: true, disableSignUp: true, requireEmailVerification: true, sendResetPassword: async ({ user, url }) => console.log(...) }`
- `emailVerification: { sendVerificationEmail: async ({ user, url }) => console.log(...), sendOnSignUp: true }`
- `session`: leave defaults — database-backed sessions is already the stock strategy for this schema. Deliberately **do not** enable `cookieCache`/stateless mode (would introduce stale-session risk not asked for).
- `plugins: [admin({ defaultRole: "agent", adminRoles: ["admin"] })]`

`export default auth;`

Include a short comment explaining why `disableSignUp` doesn't block `admin.createUser`, and why admin-created users need `data: { emailVerified: true }` passed explicitly (see §5) since they never go through the self-serve verification loop.

## 3. Prisma schema + migration

1. With `lib/auth.ts` written, run: `npx @better-auth/cli generate --config src/lib/auth.ts --output prisma/schema.prisma` (from `backend/`). Inspect the diff — it should only add `role`, `banned`, `banReason`, `banExpires` to `User`, leaving `Session`/`Account`/`Verification` and existing `@@map`/index annotations untouched.
   - If the CLI doesn't cleanly resolve this config or clobbers the existing schema, fall back to hand-editing `schema.prisma` directly, adding to `User`:
     ```prisma
     role       String?   @default("agent")
     banned     Boolean?  @default(false)
     banReason  String?
     banExpires DateTime?
     ```
2. `npx prisma migrate dev --name add_role_and_admin_fields`
3. `npx prisma generate` (required per CLAUDE.md after any schema change)

## 4. `backend/src/app.ts` (edit)

```ts
import { toNodeHandler } from "better-auth/node";
import auth from "./lib/auth.ts";
import adminRouter from "./routes/admin.ts";

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

// Must be mounted before express.json() — needs the raw request stream.
app.all("/api/auth/*splat", toNodeHandler(auth)); // *splat is Express 5 syntax; bare * is Express 4 and will throw here

app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/admin", adminRouter);
```

Two required changes to the current file: (a) `cors()` currently has no options — must add explicit `origin` + `credentials: true` or the browser won't send/receive the session cookie; (b) the auth handler must be mounted before `express.json()` is registered.

## 5. `backend/src/middleware/auth.ts` (new)

```ts
import { fromNodeHeaders } from "better-auth/node";
import auth from "../lib/auth.ts";
```

- `requireAuth`: `await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`; if absent → `401`; else attach `req.user`/`req.session`, `next()`. Wrap in try/catch → `500` on unexpected error.
- `requireRole(...allowedRoles)`: assumes `requireAuth` ran first; `403` if `req.user.role` not in `allowedRoles`, else `next()`.

Export `requireAuth`, `requireRole` — this is the general-purpose pattern future routes (ticket routes in Phase 2+) will also use.

## 6. `backend/src/routes/admin.ts` + `backend/src/controllers/adminController.ts` (new)

Follows the existing `routes/health.ts` → `controllers/healthController.ts` split.

`routes/admin.ts`: `router.post("/users", requireAuth, requireRole("admin"), createUser);`

`controllers/adminController.ts`:
```ts
import { fromNodeHeaders } from "better-auth/node";
import auth from "../lib/auth.ts";

export async function createUser(req: Request, res: Response) {
  const { email, password, name, role } = req.body;
  // validate email/password/name present; role optional, must be "admin" or "agent" if given
  try {
    const result = await auth.api.createUser({
      body: { email, password, name, role: role || "agent", data: { emailVerified: true } },
      headers: fromNodeHeaders(req.headers), // forwards the calling admin's session so the plugin's own adminMiddleware check passes
    });
    res.status(201).json({ user: result.user });
  } catch (err: any) {
    res.status(err.status === "CONFLICT" ? 409 : 400).json({ error: err.message || "Could not create user" });
  }
}
```

`data: { emailVerified: true }` is load-bearing — without it, admin-created users default to `emailVerified: false` and can never sign in under `requireEmailVerification: true`, since this path sends no verification email and there's no resend flow built. Verify the exact `APIError` shape/`status` values Better Auth actually throws at implementation time rather than assuming.

## 7. Bootstrap the first admin (no custom seed script)

Use Better Auth's own CLI, from `backend/`:
```
npx @better-auth/cli create-admin --email admin@example.com --name "Admin" --role admin
```
(Docs reference both `npx auth@latest create-admin` and `@better-auth/cli create-admin` — confirm which resolves against the installed `better-auth@1.7.4` at implementation time; they likely alias the same CLI.) It prompts for a password, hashes it via Better Auth's own scheme, links the credential account, and **auto-marks the email verified** — no custom `prisma/seed.ts` needed. It also prompts for confirmation if users already exist (skip with `--force`/`--yes`).

## Build order

1. Env vars → 2. `src/lib/auth.ts` → 3. Schema/migration/generate → 4. `src/app.ts` → 5. `src/middleware/auth.ts` → 6. `src/routes/admin.ts` + `src/controllers/adminController.ts` → 7. Bootstrap admin via CLI → 8. Manual verification.

Steps 1–3 come first since everything downstream imports `lib/auth.ts` and assumes the new DB columns exist.

## Verification (manual, from `backend/` with `npm run dev` running)

1. `curl -i http://localhost:4000/api/auth/session` → JSON response (not Express's default 404 HTML), confirming the handler is mounted.
2. Bootstrap admin via `create-admin` CLI (above); re-run it → should report the user already exists rather than erroring.
3. Sign in: `curl -i -c cookies.txt -X POST http://localhost:4000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"..."}'` → `200` + `Set-Cookie` (confirms `emailVerified: true` propagated correctly).
4. Create an agent as the admin: `curl -i -b cookies.txt -X POST http://localhost:4000/api/admin/users -H "Content-Type: application/json" -d '{"email":"agent1@example.com","password":"...","name":"Agent One","role":"agent"}'` → `201`.
5. Sign in as the new agent → `200` (confirms `emailVerified: true` works for admin-controller-created users too).
6. `POST /api/admin/users` with no cookie → `401`. Same request signed in as the **agent** → `403`.
7. `POST /api/auth/sign-up/email` unauthenticated → rejected (confirms `disableSignUp: true` is enforced).
8. Trigger `POST /api/auth/forget-password` for a known user → confirm the `console.log` stub fires in the server terminal.
9. Repeat step 3 with `-H "Origin: http://localhost:5173"` → response should include `Access-Control-Allow-Origin: http://localhost:5173` and `Access-Control-Allow-Credentials: true`.

## Follow-up (flagged, not part of this implementation)

`IMPLEMENTATION_PLAN.md`'s Phase 1 checklist pre-dates the Better Auth decision and describes hand-rolled tables/hashing. Once this plan lands, that checklist should be rewritten to reference Better Auth's actual endpoints (`/api/auth/sign-in/email` etc., `requireAuth`/`requireRole`, the CLI-based admin bootstrap) instead of the original hand-rolled design — out of scope here.
