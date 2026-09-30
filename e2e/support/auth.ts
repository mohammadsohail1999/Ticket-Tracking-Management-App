import { randomBytes } from "node:crypto";
import path from "node:path";
import { expect, type APIRequest, type APIRequestContext, type Page } from "@playwright/test";
import { BACKEND_URL, FRONTEND_URL } from "./env.ts";

type PlaywrightLike = { request: APIRequest };

export type Credentials = { email: string; password: string };

const authDir = path.resolve(import.meta.dirname, "../playwright/.auth");

// Written by tests/auth.setup.ts, consumed via test.use({ storageState }).
export const STORAGE_STATE = {
  admin: path.join(authDir, "admin.json"),
  agent: path.join(authDir, "agent.json"),
} as const;

// Talks to the backend directly. The Origin header mimics the browser: Better
// Auth checks it against trustedOrigins on cookie-bearing requests.
export function newApi(playwright: PlaywrightLike, storageState?: string): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL: BACKEND_URL,
    extraHTTPHeaders: { Origin: FRONTEND_URL },
    storageState,
  });
}

export async function signInApi(playwright: PlaywrightLike, { email, password }: Credentials) {
  const api = await newApi(playwright);
  const res = await api.post("/api/auth/sign-in/email", { data: { email, password } });
  expect(res.status(), `sign-in as ${email}`).toBe(200);
  return api;
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}@example.com`;
}

export const NEW_USER_PASSWORD = "Str0ng!Pass-e2e";

// Provisions a throwaway user through the real admin endpoint.
export async function createUserViaApi(
  adminApi: APIRequestContext,
  { role, name = "E2E Person" }: { role?: "admin" | "agent"; name?: string } = {},
) {
  const email = uniqueEmail(role ?? "agent");
  const res = await adminApi.post("/api/admin/users", {
    data: { email, password: NEW_USER_PASSWORD, name, ...(role ? { role } : {}) },
  });
  expect(res.status(), `create ${email}`).toBe(201);
  return { email, password: NEW_USER_PASSWORD, name };
}

export class LoginPage {
  readonly page: Page;
  readonly email;
  readonly password;
  readonly submit;
  readonly error;

  constructor(page: Page) {
    this.page = page;
    this.email = page.getByLabel("Email");
    this.password = page.getByLabel("Password");
    this.submit = page.getByRole("button", { name: /sign in/i });
    this.error = page.getByRole("alert");
  }

  async goto() {
    await this.page.goto("/login");
  }

  async signIn({ email, password }: Credentials) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}

export async function loginViaUi(page: Page, creds: Credentials) {
  const login = new LoginPage(page);
  await login.goto();
  await login.signIn(creds);
  await expect(page).toHaveURL("/");
}

export function userMenuTrigger(page: Page) {
  return page.getByRole("navigation").getByRole("button");
}
