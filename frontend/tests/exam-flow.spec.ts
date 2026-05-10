import { test, expect, type Page } from "@playwright/test";
import { createTestUser } from "./helpers/auth";

const BACKEND = "http://localhost:8000";
const SESSION_ID = "exam-sess-test-001";

const MOCK_SESSION = {
  session_id: SESSION_ID,
  exam_type: "stage-a",
  status: "active",
  blueprint_version: "1.0",
  requested_question_count: 150,
  actual_question_count: 1,
  shortened_due_to_pool: true,
  scope: { topics: [], part_numbers: [], chapter_ids: [], exclude_answered_correctly: false },
  question_count: 1,
  duration_seconds: 14400,
  started_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 14400 * 1000).toISOString(),
  finalized_at: null,
  items: [
    {
      index: 1,
      question_id: "q-exam-001",
      stem: "A 65-year-old presents with chest pain radiating to the jaw. Which enzyme confirms myocardial infarction?",
      options: ["Troponin I", "AST", "LDH", "CK-MM"],
      topic: "Cardiology",
      chapter_id: "ch-001",
      difficulty: "medium",
      selected_option: null,
      is_correct: null,
      answered_at: null,
    },
  ],
};

const MOCK_ANSWER_RESULT = {
  correct: true,
  correct_option: 0,
  explanation: "Troponin I is the most specific marker for myocardial injury.",
  option_explanations: [
    "Troponin I is the most specific marker for myocardial injury.",
    "AST is nonspecific.",
    "LDH is nonspecific.",
    "CK-MM reflects skeletal muscle.",
  ],
  answered_count: 1,
  correct_count: 1,
  remaining_seconds: 14399,
};

const MOCK_REPORT = {
  session_id: SESSION_ID,
  status: "finalized",
  question_count: 1,
  requested_question_count: 150,
  actual_question_count: 1,
  shortened_due_to_pool: true,
  scope: { topics: [], part_numbers: [], chapter_ids: [], exclude_answered_correctly: false },
  answered_count: 1,
  correct_count: 1,
  percent_correct: 100.0,
  started_at: new Date().toISOString(),
  finalized_at: new Date().toISOString(),
  duration_seconds: 14400,
  elapsed_seconds: 60,
  by_topic: [{ topic: "Cardiology", total: 1, answered: 1, correct: 1 }],
  by_difficulty: [{ difficulty: "medium", total: 1, answered: 1, correct: 1 }],
  review_items: [
    {
      index: 1,
      question_id: "q-exam-001",
      stem: "A 65-year-old presents with chest pain radiating to the jaw. Which enzyme confirms myocardial infarction?",
      options: ["Troponin I", "AST", "LDH", "CK-MM"],
      topic: "Cardiology",
      chapter_id: "ch-001",
      difficulty: "medium",
      selected_option: 0,
      is_correct: true,
      correct_option: 0,
      explanation: "Troponin I is the most specific marker for myocardial injury.",
      option_explanations: MOCK_ANSWER_RESULT.option_explanations,
    },
  ],
};

function fulfill(body: unknown) {
  return { status: 200, contentType: "application/json", body: JSON.stringify(body) };
}

async function setupExamMocks(page: Page) {
  await page.route(`${BACKEND}/api/v1/questions/topics`, (r) => r.fulfill(fulfill(["Cardiology"])));
  await page.route(`${BACKEND}/api/v1/chapters`, (r) => r.fulfill(fulfill([])));
  await page.route(`${BACKEND}/api/v1/questions/exam-presets/stage-a`, (r) => r.fulfill(fulfill([])));
  await page.route(`${BACKEND}/api/v1/questions/exam-sessions/stage-a/preview`, (r) =>
    r.fulfill(fulfill({ eligible_count: 1, requested_question_count: 150, actual_question_count: 1, shortened_due_to_pool: true }))
  );
  await page.route(`${BACKEND}/api/v1/questions/exam-sessions/stage-a/start`, (r) =>
    r.fulfill(fulfill(MOCK_SESSION))
  );
  await page.route(`${BACKEND}/api/v1/questions/exam-sessions/stage-a/${SESSION_ID}/answer`, (r) =>
    r.fulfill(fulfill(MOCK_ANSWER_RESULT))
  );
  await page.route(`${BACKEND}/api/v1/questions/exam-sessions/stage-a/${SESSION_ID}/finalize`, (r) =>
    r.fulfill(fulfill(MOCK_REPORT))
  );
}

test.describe("Exam flow", () => {
  test.beforeEach(async ({ page }) => {
    await createTestUser(page);
    await setupExamMocks(page);
  });

  test("settings page shows exam controls and preview pool size", async ({ page }) => {
    await page.goto("/exams/stage-a");
    await expect(page.getByRole("button", { name: "Start Stage A Exam" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: "Exams" })).toBeVisible();
    await expect(page.getByText(/Eligible pool/)).toBeVisible({ timeout: 3000 });
  });

  test("starting exam transitions to running phase with first question visible", async ({ page }) => {
    await page.goto("/exams/stage-a");
    await page.getByRole("button", { name: "Start Stage A Exam" }).click();

    await expect(page.getByRole("heading", { name: "Stage A Exam" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("A 65-year-old presents with chest pain radiating to the jaw")).toBeVisible();
    await expect(page.getByText("Troponin I")).toBeVisible();
  });

  test("selecting and submitting answer updates answered counter", async ({ page }) => {
    await page.goto("/exams/stage-a");
    await page.getByRole("button", { name: "Start Stage A Exam" }).click();
    await page.waitForSelector("text=A 65-year-old presents", { state: "visible" });

    await page.getByRole("button", { name: /Troponin I/ }).click();
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByText("1/1 answered")).toBeVisible({ timeout: 3000 });
  });

  test("finalizing exam without answering shows score report", async ({ page }) => {
    await page.goto("/exams/stage-a");
    await page.getByRole("button", { name: "Start Stage A Exam" }).click();
    await page.waitForSelector("text=A 65-year-old presents", { state: "visible" });

    await page.getByRole("button", { name: "Finalize Exam" }).click();

    await expect(page.getByRole("heading", { name: "Stage A Mock Report" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("100.00%")).toBeVisible();
  });

  test("report shows explanation and Build Another Exam returns to settings", async ({ page }) => {
    await page.goto("/exams/stage-a");
    await page.getByRole("button", { name: "Start Stage A Exam" }).click();
    await page.waitForSelector("text=A 65-year-old presents", { state: "visible" });

    await page.getByRole("button", { name: /Troponin I/ }).click();
    await page.getByRole("button", { name: "Submit" }).click();
    await page.getByRole("button", { name: "Finalize Exam" }).click();

    await expect(page.getByRole("heading", { name: "Stage A Mock Report" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Troponin I is the most specific marker for myocardial injury")).toBeVisible();

    await page.getByRole("button", { name: "Build Another Exam" }).click();
    await expect(page.getByRole("heading", { name: "Exams" })).toBeVisible({ timeout: 3000 });
  });
});
