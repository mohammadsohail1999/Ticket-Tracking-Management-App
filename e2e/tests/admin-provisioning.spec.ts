import { test, expect } from "../support/fixtures.ts";
import {
  createUserViaApi,
  loginViaUi,
  NEW_USER_PASSWORD,
  uniqueEmail,
} from "../support/auth.ts";
import { E2E_USERS } from "../support/env.ts";

test.describe("Admin provisioning: happy path", () => {
  test("a new user defaults to the agent role, is verified, and can sign in", async ({
    adminApi,
    page,
  }) => {
    const email = uniqueEmail("agent");

    const res = await adminApi.post("/api/admin/users", {
      data: { email, password: NEW_USER_PASSWORD, name: "Fresh Agent" },
    });

    expect(res.status()).toBe(201);
    const { user } = await res.json();
    expect(user).toMatchObject({ email, name: "Fresh Agent", role: "agent", emailVerified: true });
    expect(JSON.stringify(user)).not.toContain(NEW_USER_PASSWORD);

    await loginViaUi(page, { email, password: NEW_USER_PASSWORD });
    await expect(page.getByRole("heading", { name: "Welcome back, Fresh" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  });

  test("a user created with role admin can sign in and open the Users page", async ({
    adminApi,
    page,
  }) => {
    const creds = await createUserViaApi(adminApi, { role: "admin", name: "Second Admin" });

    await loginViaUi(page, creds);
    await page.getByRole("link", { name: "Users" }).click();

    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("row", { name: new RegExp(creds.email) })).toContainText("admin");
  });

  test("the admin sees the new user in the Users page", async ({ adminApi, page }) => {
    const creds = await createUserViaApi(adminApi, { name: "Listed Person" });

    await loginViaUi(page, E2E_USERS.admin);
    await page.getByRole("link", { name: "Users" }).click();

    const row = page.getByRole("row", { name: new RegExp(creds.email) });
    await expect(row).toContainText("Listed Person");
    await expect(row).toContainText("agent");
    await expect(row).toContainText("Active");
  });
});

test.describe("Admin provisioning: validation", () => {
  test("rejects a request missing required fields", async ({ adminApi }) => {
    const res = await adminApi.post("/api/admin/users", {
      data: { email: uniqueEmail("incomplete") },
    });

    expect(res.status()).toBe(400);
    const { details } = await res.json();
    expect(details.fieldErrors.name).toBeDefined();
    expect(details.fieldErrors.password).toBeDefined();
    expect(details.fieldErrors.email).toBeUndefined();
  });

  test("rejects an unknown role and creates no account", async ({ adminApi, anonApi }) => {
    const email = uniqueEmail("badrole");

    const res = await adminApi.post("/api/admin/users", {
      data: { email, password: NEW_USER_PASSWORD, name: "Bad Role", role: "superuser" },
    });

    expect(res.status()).toBe(400);
    const { details } = await res.json();
    expect(details.fieldErrors.role).toBeDefined();

    const signIn = await anonApi.post("/api/auth/sign-in/email", {
      data: { email, password: NEW_USER_PASSWORD },
    });
    expect(signIn.status()).toBe(401);
  });

  test("rejects an invalid email and creates no account", async ({ adminApi }) => {
    const email = "not-an-email";

    const res = await adminApi.post("/api/admin/users", {
      data: { email, password: NEW_USER_PASSWORD, name: "Bad Email" },
    });

    expect(res.status()).toBe(400);
    const { details } = await res.json();
    expect(details.fieldErrors.email).toBeDefined();

    const { users } = await (await adminApi.get("/api/admin/users")).json();
    expect(users.map((u: { email: string }) => u.email)).not.toContain(email);
  });

  test("rejects a non-string name and creates no account", async ({ adminApi, anonApi }) => {
    const email = uniqueEmail("numname");

    const res = await adminApi.post("/api/admin/users", {
      data: { email, password: NEW_USER_PASSWORD, name: 123 },
    });

    expect(res.status()).toBe(400);
    const { details } = await res.json();
    expect(details.fieldErrors.name).toBeDefined();

    const signIn = await anonApi.post("/api/auth/sign-in/email", {
      data: { email, password: NEW_USER_PASSWORD },
    });
    expect(signIn.status()).toBe(401);
  });

  test("rejects a duplicate email", async ({ adminApi }) => {
    const res = await adminApi.post("/api/admin/users", {
      data: { email: E2E_USERS.agent.email, password: NEW_USER_PASSWORD, name: "Dup" },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("rejects a too-short password and creates no account", async ({
    adminApi,
    anonApi,
  }) => {
    const email = uniqueEmail("weak");

    const res = await adminApi.post("/api/admin/users", {
      data: { email, password: "short", name: "Weak" },
    });
    expect(res.status()).toBe(400);

    const signIn = await anonApi.post("/api/auth/sign-in/email", {
      data: { email, password: "short" },
    });
    expect(signIn.status()).toBe(401);
  });
});

test.describe("Admin provisioning: authorization boundary", () => {
  test("unauthenticated callers get 401 and no account is created", async ({
    anonApi,
    adminApi,
  }) => {
    const email = uniqueEmail("anon-created");

    const res = await anonApi.post("/api/admin/users", {
      data: { email, password: NEW_USER_PASSWORD, name: "Anon" },
    });
    expect(res.status()).toBe(401);

    const { users } = await (await adminApi.get("/api/admin/users")).json();
    expect(users.map((u: { email: string }) => u.email)).not.toContain(email);
  });

  test("agents get 403 and no account is created, even when requesting the admin role", async ({
    agentApi,
    adminApi,
  }) => {
    const email = uniqueEmail("agent-created");

    const res = await agentApi.post("/api/admin/users", {
      data: { email, password: NEW_USER_PASSWORD, name: "Escalated", role: "admin" },
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Forbidden" });

    const { users } = await (await adminApi.get("/api/admin/users")).json();
    expect(users.map((u: { email: string }) => u.email)).not.toContain(email);
  });
});
