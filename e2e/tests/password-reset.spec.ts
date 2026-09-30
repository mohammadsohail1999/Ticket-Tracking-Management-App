import { test, expect } from "../support/fixtures.ts";
import { createUserViaApi, LoginPage, NEW_USER_PASSWORD, uniqueEmail } from "../support/auth.ts";
import { FRONTEND_URL } from "../support/env.ts";
import { readPasswordResetToken } from "../support/reset-token.ts";

// The app has no forgot-password or reset-password page, so the flow is
// exercised at the API level. The reset link only goes to the backend's
// console.log stub; the token is read from the test DB (see support/reset-token.ts).

const redirectTo = `${FRONTEND_URL}/reset-password`;
const NEW_PASSWORD = "An0ther!Pass-e2e";

test.describe("Password reset (API only)", () => {
  test("requesting a reset gives the same response for known and unknown emails", async ({
    adminApi,
    anonApi,
  }) => {
    const known = await createUserViaApi(adminApi);

    const knownRes = await anonApi.post("/api/auth/request-password-reset", {
      data: { email: known.email, redirectTo },
    });
    const unknownRes = await anonApi.post("/api/auth/request-password-reset", {
      data: { email: uniqueEmail("ghost"), redirectTo },
    });

    expect(knownRes.status()).toBe(200);
    expect(unknownRes.status()).toBe(200);
    expect(await knownRes.json()).toEqual(await unknownRes.json());
  });

  test("a valid reset token changes the password, once", async ({
    adminApi,
    anonApi,
    page,
  }) => {
    const user = await createUserViaApi(adminApi);

    await test.step("request a reset", async () => {
      const res = await anonApi.post("/api/auth/request-password-reset", {
        data: { email: user.email, redirectTo },
      });
      expect(res.status()).toBe(200);
    });
    const token = readPasswordResetToken(user.email);

    await test.step("reset the password with the token", async () => {
      const res = await anonApi.post("/api/auth/reset-password", {
        data: { newPassword: NEW_PASSWORD, token },
      });
      expect(res.status()).toBe(200);
    });

    await test.step("the old password no longer works", async () => {
      const res = await anonApi.post("/api/auth/sign-in/email", {
        data: { email: user.email, password: NEW_USER_PASSWORD },
      });
      expect(res.status()).toBe(401);
    });

    await test.step("the new password works through the login UI", async () => {
      const login = new LoginPage(page);
      await login.goto();
      await login.signIn({ email: user.email, password: NEW_PASSWORD });
      await expect(page).toHaveURL("/");
    });

    await test.step("the token cannot be reused", async () => {
      const res = await anonApi.post("/api/auth/reset-password", {
        data: { newPassword: "Y3t!Another-pass", token },
      });
      expect(res.status()).toBe(400);
    });
  });

  test("an invalid reset token is rejected", async ({ anonApi }) => {
    const res = await anonApi.post("/api/auth/reset-password", {
      data: { newPassword: NEW_PASSWORD, token: "not-a-real-token" },
    });
    expect(res.status()).toBe(400);
  });
});
