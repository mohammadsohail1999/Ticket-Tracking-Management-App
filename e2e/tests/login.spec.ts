import { test, expect } from "@playwright/test";
import { LoginPage, userMenuTrigger } from "../support/auth.ts";
import { E2E_USERS } from "../support/env.ts";

test.describe("Login", () => {
  let login: LoginPage;

  test.beforeEach(async ({ page }) => {
    login = new LoginPage(page);
    await login.goto();
  });

  test("renders the sign-in form", async ({ page }) => {
    await expect(page.getByText("Sign in", { exact: true }).first()).toBeVisible();
    await expect(login.email).toBeVisible();
    await expect(login.password).toBeVisible();
    await expect(login.submit).toBeEnabled();
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

  test("unknown email gets the same generic error as a wrong password", async ({ page }) => {
    await login.signIn({ email: "nobody-here@example.com", password: "Test@123" });

    await expect(login.error).toHaveText("Invalid email or password");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("submitting an empty form shows field errors and sends no request", async ({ page }) => {
    const signInRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/auth/sign-in")) signInRequests.push(req.url());
    });

    await login.submit.click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();
    await expect(login.email).toHaveAttribute("aria-invalid", "true");
    expect(signInRequests).toHaveLength(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a malformed email is rejected client-side", async ({ page }) => {
    await login.signIn({ email: "not-an-email", password: "Test@123" });

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toHaveCount(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a missing password is rejected client-side", async ({ page }) => {
    await login.email.fill(E2E_USERS.admin.email);
    await login.submit.click();

    await expect(page.getByText("Password is required.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toHaveCount(0);
  });

  test("shows a friendly message when the server cannot be reached", async ({ page }) => {
    await page.route("**/api/auth/sign-in/email", (route) => route.abort());

    await login.signIn(E2E_USERS.admin);

    await expect(login.error).toHaveText("Could not reach the server. Please try again.");
    await expect(page).toHaveURL(/\/login$/);
  });
});
