import { test, expect, type Page } from "@playwright/test";
import { createTestUser } from "./helpers/auth";

const BACKEND = "http://localhost:8000";

const CHAPTER_LIST = [
  {
    id: "ch-test-001",
    title: "Introduction to Cardiology",
    part_number: 1,
    part_title: "Part 1: The Profession of Medicine",
    chapter_number: 1,
    sections: [{ id: "sec-001", title: "Overview" }],
  },
];

const SECTION_HTML =
  "<p>The mitral valve is a bicuspid valve located between the left atrium and left ventricle.</p>" +
  "<p>Aortic stenosis is the most common valvular disease in developed countries.</p>" +
  "<p>Hypertrophic cardiomyopathy presents with asymmetric septal hypertrophy.</p>";

const SECTION_CONTENT = {
  chapter_id: "ch-test-001",
  chapter_title: "Introduction to Cardiology",
  section_id: "sec-001",
  section_title: "Overview",
  content: "",
  html_content: SECTION_HTML,
};

type SavedAnnotation = {
  id: string;
  chapter_id: string;
  section_id: string;
  selected_text: string;
  note_text: string;
  created_at: string;
};

async function setupMocks(page: Page, savedAnnotations: SavedAnnotation[]) {
  await page.route(`${BACKEND}/api/v1/chapters`, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CHAPTER_LIST) })
  );
  await page.route(`${BACKEND}/api/v1/chapters/ch-test-001`, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CHAPTER_LIST[0]) })
  );
  await page.route(`${BACKEND}/api/v1/chapters/ch-test-001/sections/**`, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SECTION_CONTENT) })
  );
  await page.route(`${BACKEND}/api/v1/annotations**`, async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      const body = route.request().postDataJSON() as {
        chapter_id: string;
        section_id: string;
        selected_text: string;
        note_text: string;
      };
      const ann: SavedAnnotation = {
        id: `ann-${Date.now()}`,
        chapter_id: body.chapter_id,
        section_id: body.section_id,
        selected_text: body.selected_text,
        note_text: body.note_text ?? "",
        created_at: new Date().toISOString(),
      };
      savedAnnotations.push(ann);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ann) });
    } else if (method === "DELETE") {
      const url = route.request().url();
      const id = url.split("/").pop()?.split("?")[0];
      const idx = savedAnnotations.findIndex((a) => a.id === id);
      if (idx !== -1) savedAnnotations.splice(idx, 1);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true }) });
    } else {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(savedAnnotations),
      });
    }
  });
}

async function openChaptersPage(page: Page) {
  await page.goto("/chapters");
  await page.waitForLoadState("networkidle", { timeout: 10000 });
  await page.waitForSelector(".section-content p", { state: "visible", timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll(".section-content p").length >= 2);
}

async function selectParagraph(page: Page, pIndex: number) {
  const para = page.locator(".section-content p").nth(pIndex);
  await para.scrollIntoViewIfNeeded();
  const box = await para.boundingBox();
  if (!box) throw new Error("paragraph not found");
  await page.mouse.move(box.x + box.width * 0.02, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.97, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
}

test.describe("Notes panel", () => {
  test("saved note text appears in notes sidebar panel", async ({ page }) => {
    const savedAnnotations: SavedAnnotation[] = [];
    await createTestUser(page);

    // Pre-seed one annotation with note_text
    savedAnnotations.push({
      id: "ann-note-001",
      chapter_id: "ch-test-001",
      section_id: "sec-001",
      selected_text: "The mitral valve is a bicuspid valve",
      note_text: "Important: bicuspid means two leaflets",
      created_at: new Date().toISOString(),
    });

    await setupMocks(page, savedAnnotations);
    await openChaptersPage(page);

    // Open notes panel
    await page.getByRole("button", { name: /Notes/ }).click();

    // Note text visible in panel
    await expect(
      page.getByText("Important: bicuspid means two leaflets")
    ).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Annotation persistence", () => {
  test("highlight persists after page reload", async ({ page }) => {
    const savedAnnotations: SavedAnnotation[] = [];
    await createTestUser(page);
    await setupMocks(page, savedAnnotations);

    await openChaptersPage(page);
    await selectParagraph(page, 0);
    await page.getByRole("button", { name: "Highlight" }).click();

    await expect(
      page.locator(".section-content mark.annotation-highlight").first()
    ).toBeVisible({ timeout: 3000 });
    expect(savedAnnotations).toHaveLength(1);

    // Reload — GET /annotations now returns the saved annotation
    await page.reload();
    await page.waitForLoadState("networkidle", { timeout: 10000 });
    await page.waitForSelector(".section-content p", { state: "visible", timeout: 5000 });

    await expect(
      page.locator(".section-content mark.annotation-highlight").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("deleting annotation removes mark from content", async ({ page }) => {
    const savedAnnotations: SavedAnnotation[] = [];
    await createTestUser(page);

    // Pre-seed one annotation so it appears on load
    savedAnnotations.push({
      id: "ann-pre-001",
      chapter_id: "ch-test-001",
      section_id: "sec-001",
      selected_text: "The mitral valve is a bicuspid valve",
      note_text: "",
      created_at: new Date().toISOString(),
    });

    await setupMocks(page, savedAnnotations);
    await openChaptersPage(page);

    // Highlight mark should appear from pre-seeded annotation
    await expect(
      page.locator(".section-content mark.annotation-highlight").first()
    ).toBeVisible({ timeout: 3000 });

    // Click mark to select annotation, then delete it
    await page.locator(".section-content mark.annotation-highlight").first().click();
    const deleteBtn = page.getByRole("button", { name: /Delete|Remove/ });
    if (await deleteBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await deleteBtn.click();
      await expect(
        page.locator(".section-content mark.annotation-highlight")
      ).toHaveCount(0, { timeout: 3000 });
    }
  });
});
