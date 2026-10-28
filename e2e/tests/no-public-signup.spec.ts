import { test, expect } from "../support/fixtures.ts";
import { NEW_USER_PASSWORD, uniqueEmail } from "../support/auth.ts";

test.describe("No public sign-up: backend", () => {
  test("POST /api/auth/sign-up/email is rejected and no account is created", async ({
    anonApi,
    adminApi,
  }) => {
    const email = uniqueEmail("selfserve");

    const res = await anonApi.post("/api/auth/sign-up/email", {
      data: { email, password: NEW_USER_PASSWORD, name: "Self Serve" },
    });
    expect(res.status()).toBe(400);

    const signIn = await anonApi.post("/api/auth/sign-in/email", {
      data: { email, password: NEW_USER_PASSWORD },
    });
    expect(signIn.status()).toBe(401);

    const { users } = await (await adminApi.get("/api/admin/users")).json();
    expect(users.map((u: { email: string }) => u.email)).not.toContain(email);
  });

  test("a signed-in agent cannot use the sign-up endpoint to mint accounts either", async ({
    agentApi,
    adminApi,
  }) => {
    const email = uniqueEmail("agent-minted");

    const res = await agentApi.post("/api/auth/sign-up/email", {
      data: { email, password: NEW_USER_PASSWORD, name: "Minted" },
    });
    expect(res.ok()).toBe(false);

    const { users } = await (await adminApi.get("/api/admin/users")).json();
    expect(users.map((u: { email: string }) => u.email)).not.toContain(email);
  });
});
