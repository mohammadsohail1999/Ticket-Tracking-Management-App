import { test, expect } from "../support/fixtures.ts";
import {
  createUserViaApi,
  loginViaUi,
  NEW_USER_PASSWORD,
  STORAGE_STATE,
  uniqueEmail,
} from "../support/auth.ts";
import { E2E_USERS } from "../support/env.ts";

import type { APIRequestContext, Page } from "@playwright/test";

async function openEditDialog(page: Page, email: string) {
  await page.goto("/users");
  const row = page.getByRole("row", { name: new RegExp(email) });
  await row.getByRole("button", { name: /^Edit / }).click();
  const dialog = page.getByRole("dialog", { name: "Edit user" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Edit user dialog", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("saves a new name and email, closes with a toast, and the row updates", async ({
    page,
    adminApi,
  }) => {
    const user = await createUserViaApi(adminApi, { name: "Before Edit" });
    const newEmail = uniqueEmail("edited");
    const newName = "After Edit";
    const dialog = await openEditDialog(page, user.email);

    await test.step("submit the new values", async () => {
      await dialog.getByLabel("Name").fill(newName);
      await dialog.getByLabel("Email").fill(newEmail);
      await dialog.getByRole("button", { name: "Save changes" }).click();
    });

    await test.step("dialog closes, toast shows and the row reflects the change", async () => {
      await expect(page.getByText(`Updated ${newName}.`)).toBeVisible();
      await expect(dialog).toBeHidden();

      const row = page.getByRole("row", { name: new RegExp(newEmail) });
      await expect(row).toContainText(newName);
      await expect(row).toContainText("agent");
      await expect(page.getByRole("row", { name: new RegExp(user.email) })).toHaveCount(0);
    });

    await test.step("the change persists after a reload", async () => {
      await page.reload();
      await expect(page.getByRole("row", { name: new RegExp(newEmail) })).toContainText(newName);
    });
  });

  test("the edited user signs in with the new email and the old one stops working", async ({
    page,
    adminApi,
    anonApi,
  }) => {
    const user = await createUserViaApi(adminApi, { name: "Login Switch" });
    const newEmail = uniqueEmail("renamed");
    const dialog = await openEditDialog(page, user.email);

    await dialog.getByLabel("Email").fill(newEmail);
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Updated Login Switch.")).toBeVisible();
    await expect(dialog).toBeHidden();

    const oldLogin = await anonApi.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: NEW_USER_PASSWORD },
    });
    expect(oldLogin.ok()).toBe(false);

    await page.context().clearCookies();
    await loginViaUi(page, { email: newEmail, password: NEW_USER_PASSWORD });
    await expect(page.getByRole("heading", { name: "Welcome back, Login" })).toBeVisible();
  });

});

test.describe("PATCH /api/admin/users/:id authorization and validation", () => {
  test("rejects unauthenticated requests with 401", async ({ anonApi, adminApi }) => {
    const user = await createUserViaApi(adminApi, { name: "Anon Target" });
    const id = await userId(adminApi, user.email);

    const res = await anonApi.patch(`/api/admin/users/${id}`, {
      data: { name: "Hacked", email: user.email },
    });

    expect(res.status()).toBe(401);
    expect(await userById(adminApi, id)).toMatchObject({ name: "Anon Target" });
  });

  test("rejects an agent session with 403 and changes nothing", async ({
    agentApi,
    adminApi,
  }) => {
    const user = await createUserViaApi(adminApi, { name: "Agent Target" });
    const id = await userId(adminApi, user.email);

    const res = await agentApi.patch(`/api/admin/users/${id}`, {
      data: { name: "Hacked", email: user.email },
    });

    expect(res.status()).toBe(403);
    expect(await userById(adminApi, id)).toMatchObject({ name: "Agent Target" });
  });

  test("an admin can update name and email, and the response omits secrets", async ({
    adminApi,
  }) => {
    const user = await createUserViaApi(adminApi, { name: "Api Before" });
    const id = await userId(adminApi, user.email);
    const email = uniqueEmail("api-edited");

    const res = await adminApi.patch(`/api/admin/users/${id}`, {
      data: { name: "Api After", email },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ id, name: "Api After", email, role: "agent" });
    expect(JSON.stringify(body)).not.toMatch(/password/i);
  });

  test("stores the email lowercased", async ({ adminApi }) => {
    const user = await createUserViaApi(adminApi, { name: "Case Person" });
    const id = await userId(adminApi, user.email);
    const lower = uniqueEmail("mixedcase");

    const res = await adminApi.patch(`/api/admin/users/${id}`, {
      data: { name: "Case Person", email: lower.toUpperCase() },
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).user.email).toBe(lower);
  });

  test("rejects a role change with 400 and the role stays the same", async ({ adminApi }) => {
    const user = await createUserViaApi(adminApi, { name: "Role Locked" });
    const id = await userId(adminApi, user.email);

    const res = await adminApi.patch(`/api/admin/users/${id}`, {
      data: { name: "Role Locked", email: user.email, role: "admin" },
    });

    expect(res.status()).toBe(400);
    expect(await userById(adminApi, id)).toMatchObject({ role: "agent" });
  });

  test("rejects an invalid email and a missing name with 400", async ({ adminApi }) => {
    const user = await createUserViaApi(adminApi);
    const id = await userId(adminApi, user.email);

    const res = await adminApi.patch(`/api/admin/users/${id}`, {
      data: { email: "not-an-email" },
    });

    expect(res.status()).toBe(400);
    const { details } = await res.json();
    expect(details.fieldErrors.email).toBeDefined();
    expect(details.fieldErrors.name).toBeDefined();
  });

  test("returns 409 for another user's email", async ({ adminApi }) => {
    const user = await createUserViaApi(adminApi, { name: "Conflict" });
    const id = await userId(adminApi, user.email);

    const res = await adminApi.patch(`/api/admin/users/${id}`, {
      data: { name: "Conflict", email: E2E_USERS.agent.email },
    });

    expect(res.status()).toBe(409);
    expect((await res.json()).error).toBe("A user with this email already exists");
  });

  test("returns 404 for an unknown id", async ({ adminApi }) => {
    const res = await adminApi.patch("/api/admin/users/does-not-exist", {
      data: { name: "Ghost", email: uniqueEmail("ghost") },
    });

    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe("User not found");
  });
});

async function userId(adminApi: APIRequestContext, email: string) {
  const users = await listUsers(adminApi);
  const found = users.find((u) => u.email === email);
  expect(found, `user ${email} in list`).toBeDefined();
  return found!.id;
}

async function userById(adminApi: APIRequestContext, id: string) {
  const users = await listUsers(adminApi);
  return users.find((u) => u.id === id);
}

async function listUsers(adminApi: APIRequestContext) {
  const res = await adminApi.get("/api/admin/users");
  expect(res.status()).toBe(200);
  const { users } = (await res.json()) as {
    users: { id: string; email: string; name: string; role: string }[];
  };
  return users;
}
