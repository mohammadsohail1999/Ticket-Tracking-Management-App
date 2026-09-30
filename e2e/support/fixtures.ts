import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { newApi, STORAGE_STATE } from "./auth.ts";

type Fixtures = {
  anonApi: APIRequestContext;
  agentApi: APIRequestContext;
  adminApi: APIRequestContext;
};

// Backend request contexts, one per role, independent of the browser `page`.
export const test = base.extend<Fixtures>({
  anonApi: async ({ playwright }, use) => {
    const api = await newApi(playwright);
    await use(api);
    await api.dispose();
  },
  agentApi: async ({ playwright }, use) => {
    const api = await newApi(playwright, STORAGE_STATE.agent);
    await use(api);
    await api.dispose();
  },
  adminApi: async ({ playwright }, use) => {
    const api = await newApi(playwright, STORAGE_STATE.admin);
    await use(api);
    await api.dispose();
  },
});

export { expect };
