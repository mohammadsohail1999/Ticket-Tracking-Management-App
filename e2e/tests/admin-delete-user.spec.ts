import { test, expect } from "../support/fixtures.ts";
import {
  createUserViaApi,
  LoginPage,
  NEW_USER_PASSWORD,
  signInApi,
  STORAGE_STATE,
  uniqueEmail,
} from "../support/auth.ts";
import { E2E_USERS } from "../support/env.ts";

import type { APIRequestContext, Page } from "@playwright/test";

type ListedUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  banned: boolean | null;
  deletedAt: string | null;
};

async function listUsers(adminApi: APIRequestContext) {
  const res = await adminApi.get("/api/admin/users");
  expect(res.status()).toBe(200);
  return ((await res.json()) as { users: ListedUser[] }).users;
}

async function findUser(adminApi: APIRequestContext, email: string) {
  const found = (await listUsers(adminApi)).find((u) => u.email === email);
  expect(found, `user ${email} in list`).toBeDefined();
  return found!;
}

async function openDeleteDialog(page: Page, email: string) {
  await page.goto("/users");
  const row = page.getByRole("row", { name: new RegExp(email) });
  await row.getByRole("button", { name: /^Delete / }).click();
  const dialog = page.getByRole("dialog", { name: "Delete user" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Delete user: UI", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("confirming marks the row Deleted, removes its actions and keeps it counted", async ({
    page,
    adminApi,
  }) => {
    const user = await createUserViaApi(adminApi, { name: "Doomed Person" });
    await page.goto("/users");
    const total = await page.getByText(/^\d+ total$/).textContent();

    const row = page.getByRole("row", { name: new RegExp(user.email) });
    await expect(row.getByRole("button", { name: "Delete Doomed Person" })).toBeVisible();

    const dialog = await openDeleteDialog(page, user.email);
    await expect(dialog).toContainText(`Delete ${user.name} (${user.email})?`);
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();

    await test.step("confirm the deletion", async () => {
      await dialog.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.getByText("Deleted Doomed Person.")).toBeVisible();
      await expect(dialog).toBeHidden();
    });

    await test.step("the row stays with a Deleted badge and no actions", async () => {
      await expect(row).toContainText("Deleted");
      await expect(row).not.toContainText("Active");
      await expect(row.getByRole("button")).toHaveCount(0);
      await expect(page.getByText(total!, { exact: true })).toBeVisible();
    });

    await test.step("the state persists after a reload", async () => {
      await page.reload();
      await expect(row).toContainText("Deleted");
      await expect(row.getByRole("button")).toHaveCount(0);
    });

    expect(await findUser(adminApi, user.email)).toMatchObject({ banned: true });
  });

  test("Cancel leaves the user untouched", async ({ page, adminApi }) => {
    const user = await createUserViaApi(adminApi, { name: "Spared Person" });
    const dialog = await openDeleteDialog(page, user.email);

    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).toBeHidden();
    const row = page.getByRole("row", { name: new RegExp(user.email) });
    await expect(row).toContainText("Active");
    await expect(row.getByRole("button", { name: "Delete Spared Person" })).toBeVisible();
    await expect(page.getByText("Deleted Spared Person.")).toHaveCount(0);
    expect(await findUser(adminApi, user.email)).toMatchObject({ deletedAt: null, banned: false });
  });

  test("admin rows have no Delete button", async ({ page, adminApi }) => {
    const secondAdmin = await createUserViaApi(adminApi, { role: "admin", name: "Other Admin" });
    await page.goto("/users");

    for (const email of [E2E_USERS.admin.email, secondAdmin.email]) {
      const row = page.getByRole("row", { name: new RegExp(email) });
      await expect(row).toContainText("admin");
      await expect(row.getByRole("button", { name: /^Edit / })).toBeVisible();
      await expect(row.getByRole("button", { name: /^Delete / })).toHaveCount(0);
    }
  });

  test("a failed delete shows the error in the dialog and keeps it open", async ({
    page,
    adminApi,
  }) => {
    const user = await createUserViaApi(adminApi, { name: "Raced Person" });
    const dialog = await openDeleteDialog(page, user.email);
    await page.route("**/api/admin/users/*", (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({ status: 404, json: { error: "User not found" } })
        : route.fallback(),
    );

    await dialog.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog.getByRole("alert")).toContainText("User not found");
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Deleted Raced Person.")).toHaveCount(0);
  });
});

test.describe("Delete user: agent UI", () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test("an agent cannot reach the Users page or any Delete button", async ({ page }) => {
    await page.goto("/users");

    await expect(page).not.toHaveURL(/\/users$/);
    await expect(page.getByRole("button", { name: /^Delete / })).toHaveCount(0);
  });
});

test.describe("A deleted user's access", () => {
  test("cannot sign in through the API (403 BANNED_USER) and gets no session", async ({
    adminApi,
    anonApi,
  }) => {
    const user = await createUserViaApi(adminApi);
    await deleteViaApi(adminApi, (await findUser(adminApi, user.email)).id);

    const res = await anonApi.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: user.password },
    });

    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe("BANNED_USER");
    expect(await (await anonApi.get("/api/auth/get-session")).json()).toBeNull();
  });

  test("cannot sign in through the login page", async ({ page, adminApi }) => {
    const user = await createUserViaApi(adminApi);
    await deleteViaApi(adminApi, (await findUser(adminApi, user.email)).id);

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user);

    await expect(login.error).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(await (await page.request.get("/api/auth/get-session")).json()).toBeNull();
  });

  // The login page maps every 403 to the "verify your email" text, so a
  // deleted user is told something untrue.
  test("the login page does not tell a deleted user to verify their email", async ({
    page,
    adminApi,
  }) => {
    const user = await createUserViaApi(adminApi);
    await deleteViaApi(adminApi, (await findUser(adminApi, user.email)).id);

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user);

    await expect(login.error).toBeVisible();
    await expect(login.error).not.toContainText(/verify your email/i);
  });

  test("a session opened before the deletion stops working immediately", async ({
    adminApi,
    playwright,
    page,
  }) => {
    const user = await createUserViaApi(adminApi);
    const userApi = await signInApi(playwright, user);
    const userCookies = (await userApi.storageState()).cookies;
    expect(await (await userApi.get("/api/auth/get-session")).json()).toMatchObject({
      user: { email: user.email },
    });

    await deleteViaApi(adminApi, (await findUser(adminApi, user.email)).id);

    expect(await (await userApi.get("/api/auth/get-session")).json()).toBeNull();

    await test.step("the open browser tab is sent to the login page", async () => {
      await page.context().addCookies(userCookies);
      await page.goto("/");
      await expect(page).toHaveURL(/\/login/);
    });
    await userApi.dispose();
  });

  test("the email stays reserved: re-creating it is rejected", async ({ adminApi }) => {
    const user = await createUserViaApi(adminApi);
    await deleteViaApi(adminApi, (await findUser(adminApi, user.email)).id);

    const res = await adminApi.post("/api/admin/users", {
      data: { email: user.email, password: NEW_USER_PASSWORD, name: "Second Try" },
    });

    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toMatch(/User already exists/i);
    const matches = (await listUsers(adminApi)).filter((u) => u.email === user.email);
    expect(matches).toHaveLength(1);
  });
});

test.describe("Re-creating a deleted user's email in the UI", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("the create dialog shows an error and no second row appears", async ({
    page,
    adminApi,
  }) => {
    const user = await createUserViaApi(adminApi, { name: "Gone For Good" });
    await deleteViaApi(adminApi, (await findUser(adminApi, user.email)).id);
    await page.goto("/users");

    await page.getByRole("button", { name: "Create user" }).click();
    const dialog = page.getByRole("dialog", { name: "Create user" });
    await dialog.getByLabel("Name").fill("Comeback Kid");
    await dialog.getByLabel("Email").fill(user.email);
    await dialog.getByLabel("Password", { exact: true }).fill(NEW_USER_PASSWORD);
    await dialog.getByRole("button", { name: "Create user" }).click();

    await expect(dialog.getByRole("alert")).toContainText(/already exists/i);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("row", { name: new RegExp(user.email) })).toHaveCount(1);
  });
});

test.describe("DELETE /api/admin/users/:id", () => {
  test("rejects unauthenticated requests with 401 and deletes nothing", async ({
    anonApi,
    adminApi,
  }) => {
    const user = await createUserViaApi(adminApi);
    const { id } = await findUser(adminApi, user.email);

    const res = await anonApi.delete(`/api/admin/users/${id}`);

    expect(res.status()).toBe(401);
    expect(await findUser(adminApi, user.email)).toMatchObject({ deletedAt: null, banned: false });
  });

  test("rejects an agent session with 403 and deletes nothing", async ({
    agentApi,
    adminApi,
  }) => {
    const user = await createUserViaApi(adminApi);
    const { id } = await findUser(adminApi, user.email);

    const res = await agentApi.delete(`/api/admin/users/${id}`);

    expect(res.status()).toBe(403);
    expect(await findUser(adminApi, user.email)).toMatchObject({ deletedAt: null, banned: false });
  });

  test("an admin soft-deletes a user: flags set, row kept, no secrets in the response", async ({
    adminApi,
  }) => {
    const user = await createUserViaApi(adminApi, { name: "Api Doomed" });
    const { id } = await findUser(adminApi, user.email);

    const res = await adminApi.delete(`/api/admin/users/${id}`);

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ id, email: user.email, banned: true });
    expect(body.user.deletedAt).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toMatch(/password/i);
    expect(await findUser(adminApi, user.email)).toMatchObject({ id, banned: true });
  });

  test("deleting an already-deleted user is idempotent and keeps the first timestamp", async ({
    adminApi,
  }) => {
    const user = await createUserViaApi(adminApi);
    const { id } = await findUser(adminApi, user.email);
    const first = (await deleteViaApi(adminApi, id)).user.deletedAt;

    const again = await adminApi.delete(`/api/admin/users/${id}`);

    expect(again.status()).toBe(200);
    expect((await again.json()).user.deletedAt).toBe(first);
  });

  test("refuses to delete an admin with 403, including the caller themselves", async ({
    adminApi,
  }) => {
    const other = await createUserViaApi(adminApi, { role: "admin", name: "Protected Admin" });

    for (const email of [other.email, E2E_USERS.admin.email]) {
      const { id } = await findUser(adminApi, email);
      const res = await adminApi.delete(`/api/admin/users/${id}`);

      expect(res.status()).toBe(403);
      expect((await res.json()).error).toBe("Admin users cannot be deleted");
      expect(await findUser(adminApi, email)).toMatchObject({ deletedAt: null, banned: false });
    }
  });

  test("returns 404 for an unknown id", async ({ adminApi }) => {
    const res = await adminApi.delete("/api/admin/users/does-not-exist");

    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe("User not found");
  });

  test("PATCH on a deleted user returns 409 and changes nothing", async ({ adminApi }) => {
    const user = await createUserViaApi(adminApi, { name: "Frozen Person" });
    const { id } = await findUser(adminApi, user.email);
    await deleteViaApi(adminApi, id);

    const res = await adminApi.patch(`/api/admin/users/${id}`, {
      data: { name: "Thawed", email: uniqueEmail("thawed") },
    });

    expect(res.status()).toBe(409);
    expect((await res.json()).error).toBe("Deleted users cannot be edited");
    expect(await findUser(adminApi, user.email)).toMatchObject({ name: "Frozen Person" });
  });

  test("deleting one user does not disturb another user's session", async ({
    adminApi,
    playwright,
  }) => {
    const doomed = await createUserViaApi(adminApi);
    const bystander = await createUserViaApi(adminApi);
    const bystanderApi = await signInApi(playwright, bystander);

    await deleteViaApi(adminApi, (await findUser(adminApi, doomed.email)).id);

    expect(await (await bystanderApi.get("/api/auth/get-session")).json()).toMatchObject({
      user: { email: bystander.email },
    });
    await bystanderApi.dispose();
  });
});

async function deleteViaApi(adminApi: APIRequestContext, id: string) {
  const res = await adminApi.delete(`/api/admin/users/${id}`);
  expect(res.status(), `delete ${id}`).toBe(200);
  return (await res.json()) as { user: ListedUser };
}
