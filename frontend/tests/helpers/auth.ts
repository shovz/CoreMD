import type { Page } from "@playwright/test";

const BACKEND = "http://localhost:8000";

export interface TestUser {
  email: string;
  password: string;
  token: string;
}

/** Registers + logs in a fresh user. Injects the token into localStorage via addInitScript
 *  so the app starts pre-authenticated on the next page.goto(). */
export async function createTestUser(page: Page): Promise<TestUser> {
  const { email, password, token } = await registerUser(page);
  await page.addInitScript((t: string) => localStorage.setItem("access_token", t), token);
  return { email, password, token };
}

/** Registers a fresh user and returns credentials WITHOUT injecting the token.
 *  Use this when you want to test the login form flow. */
export async function registerUser(page: Page): Promise<TestUser> {
  const email = `pw-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "Test1234!";

  const reg = await page.request.post(`${BACKEND}/api/v1/auth/register`, {
    data: { email, password, full_name: "Test User" },
  });
  if (!reg.ok()) throw new Error(`register failed: ${reg.status()} ${await reg.text()}`);

  const loginResp = await page.request.post(`${BACKEND}/api/v1/auth/login`, {
    data: { email, password },
  });
  if (!loginResp.ok()) throw new Error(`login failed: ${loginResp.status()} ${await loginResp.text()}`);

  const { access_token } = await loginResp.json();
  return { email, password, token: access_token };
}
