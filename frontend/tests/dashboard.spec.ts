import { test, expect } from "@playwright/test";
import { createTestUser, registerUser } from "./helpers/auth";

const BACKEND = "http://localhost:8000";

test.describe("Dashboard page", () => {
  test("loads without 500 errors after login", async ({ page }) => {
    const failedRequests: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 500) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    await createTestUser(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    expect(failedRequests, `500 errors: ${failedRequests.join(", ")}`).toHaveLength(0);
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("stats/questions endpoint returns valid shape", async ({ page }) => {
    const { token } = await registerUser(page);

    const statsRes = await page.request.get(`${BACKEND}/api/v1/stats/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(statsRes.status()).toBe(200);

    const data = await statsRes.json();
    expect(data).toHaveProperty("by_difficulty");
    expect(data).toHaveProperty("by_topic");
    expect(typeof data.by_difficulty).toBe("object");
    expect(Array.isArray(data.by_topic)).toBe(true);
  });
});
