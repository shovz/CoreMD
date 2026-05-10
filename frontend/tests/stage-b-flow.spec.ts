import { test, expect, type Page } from "@playwright/test";
import { createTestUser } from "./helpers/auth";

const BACKEND = "http://localhost:8000";
const SESSION_ID = "stage_b_e2e_001";

const MOCK_SESSION = {
  session_id: SESSION_ID,
  exam_type: "stage-b",
  status: "active",
  difficulty: "medium",
  voice: "alloy",
  case_count: 1,
  duration_minutes: 45,
  started_at: new Date(Date.now() - 60000).toISOString(),
  expires_at: new Date(Date.now() + 44 * 60 * 1000).toISOString(),
  finalized_at: null,
  current_case_idx: 0,
  current_stage_idx: 0,
  cases: [
    {
      case_index: 0,
      case_id: "test-case-001",
      title: "Cardiology",
      chief_complaint: "A 55-year-old with chest pain.",
      stages: [
        {
          stage_index: 0,
          title: "Initial Presentation",
          context: "Patient arrives with chest pain.",
          questions: [
            {
              question_id: "sbq_001",
              stage_index: 0,
              stem: "What is the most likely diagnosis?",
              topic: "Cardiology",
              difficulty: "medium",
              student_answer: null,
              answer_mode: null,
              score: null,
              feedback: null,
              key_points_hit: null,
              answered_at: null,
            },
          ],
        },
      ],
    },
  ],
};

const MOCK_ANSWER_RESULT = {
  score: 0.8,
  feedback: "Good answer.",
  key_points_hit: ["troponin elevation"],
  model_answer: "NSTEMI",
  remaining_seconds: 2640,
  all_stage_questions_answered: true,
};

const MOCK_REPORT = {
  session_id: SESSION_ID,
  status: "finalized",
  difficulty: "medium",
  voice: "alloy",
  case_count: 1,
  duration_minutes: 45,
  started_at: new Date().toISOString(),
  finalized_at: new Date().toISOString(),
  elapsed_seconds: 60,
  total_questions: 1,
  answered_count: 1,
  avg_score: 0.8,
  by_topic: [{ topic: "Cardiology", total: 1, answered: 1, avg_score: 0.8 }],
  by_difficulty: [{ difficulty: "medium", total: 1, answered: 1, avg_score: 0.8 }],
  cases: [
    {
      case_index: 0,
      case_id: "test-case-001",
      title: "Cardiology",
      chief_complaint: "A 55-year-old with chest pain.",
      answered_count: 1,
      total_questions: 1,
      avg_score: 0.8,
      stages: [
        {
          stage_index: 0,
          title: "Initial Presentation",
          context: "Patient arrives with chest pain.",
          questions: [
            {
              question_id: "sbq_001",
              stage_index: 0,
              stem: "What is the most likely diagnosis?",
              topic: "Cardiology",
              difficulty: "medium",
              student_answer: "NSTEMI",
              answer_mode: "text",
              score: 0.8,
              feedback: "Good answer.",
              key_points_hit: ["troponin elevation"],
              model_answer: "NSTEMI",
              key_points: ["troponin elevation"],
              answered_at: new Date().toISOString(),
            },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fulfill(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

async function setupStageBMocks(page: Page) {
  // Initial settings page load
  await page.route(`${BACKEND}/api/v1/stage-b/sessions/active`, (r) =>
    r.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "No active Stage B session" }),
    })
  );
  await page.route(`${BACKEND}/api/v1/stage-b/sessions`, (r) =>
    r.fulfill(fulfill([]))
  );

  // Session creation
  await page.route(`${BACKEND}/api/v1/stage-b/sessions/start`, (r) =>
    r.fulfill(fulfill(MOCK_SESSION))
  );

  // TTS: return 500 so component falls back to text display (showText = true)
  await page.route(`${BACKEND}/api/v1/stage-b/sessions/*/tts/**`, (r) =>
    r.fulfill({ status: 500, contentType: "application/json", body: "{}" })
  );

  // Answer submission
  await page.route(`${BACKEND}/api/v1/stage-b/sessions/*/answer/**`, (r) =>
    r.fulfill(fulfill(MOCK_ANSWER_RESULT))
  );

  // Finalize
  await page.route(`${BACKEND}/api/v1/stage-b/sessions/*/finalize`, (r) =>
    r.fulfill(fulfill(MOCK_REPORT))
  );
}

/** Navigate to running phase: click Generate and wait for question + context. */
async function goToRunningPhase(page: Page) {
  await page.goto("/exams/stage-b");
  await page.getByRole("button", { name: "Generate Exam" }).click();

  // TTS fails → showText → context paragraph appears
  await expect(page.getByText("Patient arrives with chest pain.")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("What is the most likely diagnosis?")).toBeVisible({ timeout: 5000 });
}

/** Go to running phase, type an answer, submit it, then click Finalize. */
async function goToReviewPhase(page: Page) {
  await goToRunningPhase(page);

  await page.fill("textarea", "My answer is NSTEMI");
  await page.getByRole("button", { name: "Submit Answer" }).click();

  // Finalize button appears once all questions answered
  await expect(page.getByRole("button", { name: /Finalize Exam/ })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /Finalize Exam/ }).click();

  await expect(page.getByRole("heading", { name: "Exam Review" })).toBeVisible({ timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Stage B exam flow", () => {
  test.beforeEach(async ({ page }) => {
    await createTestUser(page);
    await setupStageBMocks(page);
  });

  test("settings page loads at /exams/stage-b", async ({ page }) => {
    await page.goto("/exams/stage-b");

    await expect(
      page.getByRole("heading", { name: "Stage B — Oral Exam Simulator" })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Generate Exam" })).toBeVisible();
  });

  test("Generate Exam transitions to running phase with question visible", async ({ page }) => {
    await goToRunningPhase(page);

    await expect(page.getByText("What is the most likely diagnosis?")).toBeVisible();
    // Context visible because TTS failed → showText fallback
    await expect(page.getByText("Patient arrives with chest pain.")).toBeVisible();
  });

  test("typing answer and submitting shows score badge", async ({ page }) => {
    await goToRunningPhase(page);

    // Submit Answer button is disabled until text is entered
    await expect(page.getByRole("button", { name: "Submit Answer" })).toBeDisabled();

    await page.fill("textarea", "My answer is NSTEMI");

    await expect(page.getByRole("button", { name: "Submit Answer" })).toBeEnabled();
    await page.getByRole("button", { name: "Submit Answer" }).click();

    // score is 0.8 → displayed as "Score: 0.8/10"
    await expect(page.getByText("Score: 0.8/10")).toBeVisible({ timeout: 5000 });
  });

  test("Finalize Exam shows review report", async ({ page }) => {
    await goToReviewPhase(page);

    await expect(page.getByRole("heading", { name: "Exam Review" })).toBeVisible();

    // avg_score is 0.8 → displayed as "0.8/10" in the stats grid
    await expect(page.getByText("0.8/10")).toBeVisible();
  });

  test("Back to Exams navigates to exams landing", async ({ page }) => {
    await goToReviewPhase(page);

    await page.getByRole("button", { name: "Back to Exams" }).click();

    await expect(page).toHaveURL(/\/exams$/);
    // ExamsLandingPage renders an "Exams" heading
    await expect(page.getByRole("heading", { name: "Exams" })).toBeVisible({ timeout: 5000 });
  });
});
