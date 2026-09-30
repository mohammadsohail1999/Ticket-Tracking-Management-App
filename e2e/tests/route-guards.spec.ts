import { test, expect } from "../support/fixtures.ts";
import { LoginPage, STORAGE_STATE, userMenuTrigger } from "../support/auth.ts";
import { E2E_USERS } from "../support/env.ts";

test.describe("Route guards: unauthenticated visitor", () => {
  for (const path of ["/", "/users", "/some/unknown/page"]) {
    test(`${path} redirects to the login page`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByLabel("Email")).toBeVisible();
    });
  }

  test("returns to the originally requested page after signing in", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL(/\/login$/);

    await new LoginPage(page).signIn(E2E_USERS.admin);

    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("an agent signing in from a /users redirect ends up on the home page", async ({
    page,
  }) => {
    await page.goto("/users");
    await new LoginPage(page).signIn(E2E_USERS.agent);

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  });

  test("backend: protected endpoints answer 401", async ({ anonApi }) => {
    const res = await anonApi.get("/api/admin/users");
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });

    const session = await anonApi.get("/api/auth/get-session");
    expect(await session.json()).toBeNull();
  });
});

test.describe("Route guards: signed-in admin", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("is redirected away from /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Welcome back, Admin" })).toBeVisible();
  });

  test("can open the Users page from the navbar and sees the seeded accounts", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Users" }).click();

    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(E2E_USERS.admin.email) })).toContainText(
      "admin",
    );
    await expect(page.getByRole("row", { name: new RegExp(E2E_USERS.agent.email) })).toContainText(
      "agent",
    );
  });

  test("backend: GET /api/admin/users returns the user list", async ({ adminApi }) => {
    const res = await adminApi.get("/api/admin/users");
    expect(res.status()).toBe(200);
    const { users } = await res.json();
    const emails = users.map((u: { email: string }) => u.email);
    expect(emails).toEqual(expect.arrayContaining([E2E_USERS.admin.email, E2E_USERS.agent.email]));
    expect(JSON.stringify(users)).not.toMatch(/password/i);
  });
});

test.describe("Route guards: signed-in agent", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test("is redirected away from /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/");
  });

  test("is bounced from /users to the home page", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Users" })).toHaveCount(0);
  });

  test("does not see the Users link in the navbar", async ({ page }) => {
    await page.goto("/");
    await expect(userMenuTrigger(page)).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  });

  test("backend: GET /api/admin/users answers 403", async ({ agentApi }) => {
    const res = await agentApi.get("/api/admin/users");
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Forbidden" });
  });
});
