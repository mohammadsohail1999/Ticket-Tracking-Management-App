import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'

// No baseURL: the frontend and backend are same-origin in production, and
// Vite's /api proxy (see vite.config.ts) makes them same-origin in dev too,
// so relative requests against the default basePath ("/api/auth", matching
// backend/src/lib/auth.ts) work without hardcoding a host.
export const authClient = createAuthClient({
  plugins: [adminClient()],
})

export const { useSession, signIn, signOut } = authClient
