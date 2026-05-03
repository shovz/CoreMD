import { test, expect, type Page } from "@playwright/test";
import { createTestUser } from "./helpers/auth";

const BACKEND = "http://localhost:8000";
const BOOKMARKS_URL = `${BACKEND}/api/v1/bookmarks`;

const QUESTION_BOOKMARKS = [
  {
    type: "question",
    item_id: "q-bm-001",
    created_at: "2024-01-01T00:00:00Z",
    document: { stem: "What is the mechanism of aspirin?" },
  },
  {
    type: "question",
    item_id: "q-bm-002",
    created_at: "2024-01-02T00:00:00Z",
    document: { stem: "Which drug inhibits ACE?" },
  },
];

const CASE_BOOKMARKS = [
  {
    type: "case",
    item_id: "case-bm-001",
    created_at: "2024-01-01T00:00:00Z",
    document: { title: "Chest Pain Case" },
  },
];

async function setupBookmarkMocks(
  page: Page,
  initialQuestions = QUESTION_BOOKMARKS,
  initialCases = CASE_BOOKMARKS
) {
  let questionBookmarks = [...initialQuestions];
  const caseBookmarks = [...initialCases];

  await page.route(`${BOOKMARKS_URL}**`, async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    const pathSuffix = route.request().url().replace(BOOKMARKS_URL, "");
    const isItemRequest = pathSuffix.startsWith("/") && pathSuffix.length > 1;

    if (method === "DELETE" && isItemRequest) {
      const itemId = pathSuffix.split("/")[1].split("?")[0];
      questionBookmarks = questionBookmarks.filter((b) => b.item_id !== itemId);
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ bookmarked: false }),
      });
    } else if (method === "GET") {
      const type = url.searchParams.get("type");
      const data = type === "case" ? caseBookmarks : questionBookmarks;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    } else if (method === "POST") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ bookmarked: true }),
      });
    } else {
      route.continue();
    }
  });
}

test.describe("Bookmarks flow", () => {
  test("shows question bookmarks on /bookmarks page load", async ({ page }) => {
    await createTestUser(page);
    await setupBookmarkMocks(page);

    await page.goto("/bookmarks");
    await page.waitForLoadState("networkidle", { timeout: 10000 });

    await expect(
      page.getByText("What is the mechanism of aspirin?")
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Which drug inhibits ACE?")).toBeVisible();
  });

  test("removes bookmark from list on ✕ click", async ({ page }) => {
    await createTestUser(page);
    await setupBookmarkMocks(page);

    await page.goto("/bookmarks");
    await expect(
      page.getByText("What is the mechanism of aspirin?")
    ).toBeVisible({ timeout: 5000 });

    // Click remove on the first bookmark
    const removeButtons = page.locator('button[title="Remove bookmark"]');
    await removeButtons.first().click();

    await expect(
      page.getByText("What is the mechanism of aspirin?")
    ).not.toBeVisible({ timeout: 3000 });

    // Second bookmark still present
    await expect(page.getByText("Which drug inhibits ACE?")).toBeVisible();
  });

  test("shows case bookmarks when Cases tab clicked", async ({ page }) => {
    await createTestUser(page);
    await setupBookmarkMocks(page);

    await page.goto("/bookmarks");
    await expect(
      page.getByText("What is the mechanism of aspirin?")
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Cases" }).click();

    await expect(page.getByText("Chest Pain Case")).toBeVisible({ timeout: 3000 });
  });
});
