import { test as setup } from "@playwright/test";
import { signInApi, STORAGE_STATE } from "../support/auth.ts";
import { E2E_USERS } from "../support/env.ts";

for (const role of ["admin", "agent"] as const) {
  setup(`sign in as ${role} and save storage state`, async ({ playwright }) => {
    const api = await signInApi(playwright, E2E_USERS[role]);
    await api.storageState({ path: STORAGE_STATE[role] });
    await api.dispose();
  });
}
