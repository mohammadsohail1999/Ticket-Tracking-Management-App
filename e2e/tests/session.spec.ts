import { test, expect } from "../support/fixtures.ts";
import { loginViaUi, newApi, STORAGE_STATE, userMenuTrigger } from "../support/auth.ts";
import { BACKEND_URL, E2E_USERS, FRONTEND_URL } from "../support/env.ts";

test.describe("Session persistence", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("reloading keeps the user signed in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome back, Admin" })).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Welcome back, Admin" })).toBeVisible();
  });

  test("reloading a role-restricted page keeps the admin on it", async ({ page }) => {
    await page.goto("/users");
    await page.reload();

    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });
});

test.describe("Logout", () => {
  // Signs in through the UI so this test owns its session: logging out revokes
  // it server-side and must not invalidate the shared storageState sessions.
  test("ends the session, redirects to login and revokes the session server-side", async ({
    page,
    playwright,
  }) => {
    await loginViaUi(page, E2E_USERS.agent);
    const cookies = await page.context().cookies();

    await userMenuTrigger(page).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();

    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    expect(await (await page.request.get("/api/auth/get-session")).json()).toBeNull();

    // The old cookie must be dead on the server, not merely cleared in the browser.
    const stale = await playwright.request.newContext({
      baseURL: BACKEND_URL,
      storageState: { cookies, origins: [] },
    });
    expect((await stale.get("/api/admin/users")).status()).toBe(401);
    await stale.dispose();
  });

  test("logging out one session leaves other sessions of the same user alive", async ({
    page,
    playwright,
  }) => {
    await loginViaUi(page, E2E_USERS.agent);
    const other = await newApi(playwright, STORAGE_STATE.agent);

    await userMenuTrigger(page).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    expect((await other.get("/api/auth/get-session")).status()).toBe(200);
    expect(await (await other.get("/api/auth/get-session")).json()).toMatchObject({
      user: { email: E2E_USERS.agent.email },
    });
    await other.dispose();
  });
});

test.describe("Invalid session cookie", () => {
  const forged = "forged-token.forged-signature";

  test("a forged session cookie is treated as signed out by the UI", async ({ page, context }) => {
    await context.addCookies([
      { name: "better-auth.session_token", value: forged, url: FRONTEND_URL },
    ]);

    await page.goto("/users");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("backend: a forged session cookie is rejected with 401", async ({ playwright }) => {
    const api = await playwright.request.newContext({
      baseURL: BACKEND_URL,
      extraHTTPHeaders: { Cookie: `better-auth.session_token=${forged}` },
    });
    expect((await api.get("/api/admin/users")).status()).toBe(401);
    await api.dispose();
  });
});
