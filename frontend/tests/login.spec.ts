import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

test("shows error on wrong password", async ({ page }) => {
  const { email } = await registerUser(page);

  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "wrong-password");
  await page.click('button[type="submit"]');

  await expect(page.locator(".text-red-700")).toBeVisible({ timeout: 3000 });
});

test("redirects to /dashboard on valid login", async ({ page }) => {
  const { email, password } = await registerUser(page);

  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL("**/dashboard", { timeout: 5000 });
  expect(page.url()).toContain("/dashboard");
});
