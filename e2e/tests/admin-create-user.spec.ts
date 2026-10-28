import { test, expect } from "../support/fixtures.ts";
import { loginViaUi, NEW_USER_PASSWORD, STORAGE_STATE, uniqueEmail } from "../support/auth.ts";

// Dialog behaviour (fields, validation, password toggle, server errors, reset on
// close) is unit-tested in UserFormDialog.test.tsx; this covers the full stack.
test.use({ storageState: STORAGE_STATE.admin });

test("creates an agent through the UI, lists the new row, and the user can sign in", async ({
  page,
}) => {
  await page.goto("/users");
  await page.getByRole("button", { name: "Create user" }).click();
  const dialog = page.getByRole("dialog", { name: "Create user" });
  await expect(dialog).toBeVisible();

  const email = uniqueEmail("ui-created");
  const name = "Created In Ui";

  await test.step("submit the form", async () => {
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Password", { exact: true }).fill(NEW_USER_PASSWORD);
    await dialog.getByRole("button", { name: "Create user" }).click();
  });

  await test.step("dialog closes, toast shows and the table lists the agent", async () => {
    await expect(page.getByText(`Created ${name}.`)).toBeVisible();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(email) });
    await expect(row).toContainText(name);
    await expect(row).toContainText("agent");
    await expect(row).toContainText("Active");
  });

  await test.step("the new user signs in through the UI as an agent", async () => {
    await page.context().clearCookies();
    await loginViaUi(page, { email, password: NEW_USER_PASSWORD });
    await expect(page.getByRole("heading", { name: "Welcome back, Created" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  });
});
