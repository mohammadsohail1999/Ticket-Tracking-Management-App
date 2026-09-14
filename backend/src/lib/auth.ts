import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins/admin";
import prisma from "./prisma.ts";

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:5173"],
  emailAndPassword: {
    enabled: true,
    // Admin-provisioned signup only — the admin plugin's create-user endpoint is a
    // separate code path from /sign-up/email, so it isn't blocked by this.
    disableSignUp: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      console.log(`[auth] password reset for ${user.email}: ${url}`);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`[auth] verification email for ${user.email}: ${url}`);
    },
    sendOnSignUp: true,
  },
  plugins: [admin({ defaultRole: "agent", adminRoles: ["admin"] })],
});

export default auth;
