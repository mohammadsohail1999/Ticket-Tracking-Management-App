import { test, expect } from "../support/fixtures.ts";
import { loginViaUi, NEW_USER_PASSWORD, STORAGE_STATE, uniqueEmail } from "../support/auth.ts";
import { E2E_USERS } from "../support/env.ts";

test.use({ storageState: STORAGE_STATE.admin });

test.beforeEach(async ({ page }) => {
  await page.goto("/users");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByRole("dialog", { name: "Create user" })).toBeVisible();
});

test.describe("Create user dialog", () => {
  test("shows only name, email and password fields, with no role control", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "Create user" });

    await expect(dialog.getByLabel("Name")).toBeVisible();
    await expect(dialog.getByLabel("Email")).toBeVisible();
    await expect(dialog.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Create user" })).toBeVisible();

    await expect(dialog.locator("input")).toHaveCount(3);
    await expect(dialog.getByLabel(/role/i)).toHaveCount(0);
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
  });

  test("shows validation errors for an empty submit and sends no request", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "Create user" });
    let posted = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/admin/users")) posted = true;
    });

    await dialog.getByRole("button", { name: "Create user" }).click();

    await expect(dialog.getByText("Name is required.")).toBeVisible();
    await expect(dialog.getByText("Enter a valid email address.")).toBeVisible();
    await expect(dialog.getByText("Password must be at least 8 characters.")).toBeVisible();
    expect(posted).toBe(false);
  });

  test("rejects a short password and keeps the dialog open", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "Create user" });

    await dialog.getByLabel("Name").fill("Short Pass");
    await dialog.getByLabel("Email").fill(uniqueEmail("shortpass"));
    await dialog.getByLabel("Password", { exact: true }).fill("short");
    await dialog.getByRole("button", { name: "Create user" }).click();

    await expect(dialog.getByText("Password must be at least 8 characters.")).toBeVisible();
    await expect(dialog.getByText("Name is required.")).toHaveCount(0);
    await expect(dialog.getByText("Enter a valid email address.")).toHaveCount(0);
    await expect(dialog).toBeVisible();
  });

  test("creates an agent, shows the toast and the new row, and the user can sign in", async ({
    page,
  }) => {
    const dialog = page.getByRole("dialog", { name: "Create user" });
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

  test("a duplicate email shows an error in the dialog and keeps it open", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "Create user" });

    await dialog.getByLabel("Name").fill("Duplicate Admin");
    await dialog.getByLabel("Email").fill(E2E_USERS.admin.email);
    await dialog.getByLabel("Password", { exact: true }).fill(NEW_USER_PASSWORD);
    await dialog.getByRole("button", { name: "Create user" }).click();

    await expect(dialog.getByRole("alert")).toContainText(/already exists/i);
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Created Duplicate Admin.")).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Duplicate Admin/ })).toHaveCount(0);
  });

  test("closing the dialog discards what was typed", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "Create user" });

    await dialog.getByLabel("Name").fill("Abandoned");
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Create user" }).click();
    await expect(dialog.getByLabel("Name")).toHaveValue("");
  });

  test("the password toggle reveals and re-hides the typed password, and resets on close", async ({
    page,
  }) => {
    const dialog = page.getByRole("dialog", { name: "Create user" });
    const password = dialog.getByLabel("Password", { exact: true });

    await password.fill(NEW_USER_PASSWORD);
    await expect(password).toHaveAttribute("type", "password");
    await expect(dialog.getByRole("button", { name: "Show password text" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await dialog.getByRole("button", { name: "Show password text" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue(NEW_USER_PASSWORD);
    await expect(dialog.getByRole("button", { name: "Hide password text" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await dialog.getByRole("button", { name: "Hide password text" }).click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(dialog.getByRole("button", { name: "Show password text" })).toBeVisible();

    await dialog.getByRole("button", { name: "Show password text" }).click();
    await expect(password).toHaveAttribute("type", "text");

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Create user" }).click();

    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue("");
    await expect(dialog.getByRole("button", { name: "Show password text" })).toBeVisible();
  });

  test("the password toggle does not submit the form", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "Create user" });

    await dialog.getByRole("button", { name: "Show password text" }).click();

    await expect(dialog.getByText("Name is required.")).toHaveCount(0);
    await expect(dialog).toBeVisible();
  });
});
