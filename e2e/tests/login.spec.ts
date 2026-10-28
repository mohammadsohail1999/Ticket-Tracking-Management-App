import { test, expect } from "@playwright/test";
import { LoginPage, userMenuTrigger } from "../support/auth.ts";
import { E2E_USERS } from "../support/env.ts";

test.describe("Login", () => {
  let login: LoginPage;

  test.beforeEach(async ({ page }) => {
    login = new LoginPage(page);
    await login.goto();
  });

  test("admin signs in, lands on the home page and sees the Users link", async ({ page }) => {
    await login.signIn(E2E_USERS.admin);

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Welcome back, Admin" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();

    await userMenuTrigger(page).click();
    await expect(page.getByRole("menu")).toContainText(E2E_USERS.admin.email);
    await expect(page.getByRole("menu")).toContainText("admin");
  });

  test("agent signs in, lands on the home page and gets no Users link", async ({ page }) => {
    await login.signIn(E2E_USERS.agent);

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Welcome back, Support" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);

    await userMenuTrigger(page).click();
    await expect(page.getByRole("menu")).toContainText(E2E_USERS.agent.email);
    await expect(page.getByRole("menu")).toContainText("agent");
  });

  test("a successful login establishes an HttpOnly session cookie and a server-side session", async ({
    page,
  }) => {
    await login.signIn(E2E_USERS.agent);
    await expect(page).toHaveURL("/");

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "better-auth.session_token");
    expect(sessionCookie?.httpOnly).toBe(true);

    const res = await page.request.get("/api/auth/get-session");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ email: E2E_USERS.agent.email, role: "agent" });
  });

  test("wrong password shows an error, keeps the user on /login and creates no session", async ({
    page,
  }) => {
    await login.signIn({ email: E2E_USERS.admin.email, password: "Wrong@Password1" });

    await expect(login.error).toHaveText("Invalid email or password");
    await expect(page).toHaveURL(/\/login$/);
    await expect(login.submit).toBeEnabled();

    const res = await page.request.get("/api/auth/get-session");
    expect(await res.json()).toBeNull();
  });

});
