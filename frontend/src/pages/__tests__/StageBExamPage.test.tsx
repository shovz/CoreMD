import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mswServer";
import StageBExamPage from "../StageBExamPage";
import { ExamGuardProvider } from "../../context/ExamGuardContext";

const BASE = "http://localhost:8000/api/v1";
const SESSION_ID = "stage_b_test001";

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
  feedback: "Good answer covering key points.",
  key_points_hit: ["troponin elevation"],
  model_answer: "NSTEMI with elevated troponin.",
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
  started_at: new Date(Date.now() - 60000).toISOString(),
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
              student_answer: "I think it's NSTEMI",
              answer_mode: "text",
              score: 0.8,
              feedback: "Good answer.",
              key_points_hit: ["troponin elevation"],
              model_answer: "NSTEMI with elevated troponin.",
              key_points: ["troponin elevation", "ischemic ECG changes"],
              answered_at: new Date().toISOString(),
            },
          ],
        },
      ],
    },
  ],
};

const MOCK_ACTIVE_SESSION = {
  ...MOCK_SESSION,
  session_id: "stage_b_active001",
};

const MOCK_PAST_SESSION = {
  session_id: "stage_b_past001",
  status: "finalized",
  difficulty: "hard",
  case_count: 2,
  duration_minutes: 60,
  voice: "echo",
  started_at: new Date(Date.now() - 86400000).toISOString(),
  finalized_at: new Date(Date.now() - 85000000).toISOString(),
  topics: ["Cardiology", "Neurology"],
  avg_score: 7.5,
};

// ---------------------------------------------------------------------------
// Handler setup helpers
// ---------------------------------------------------------------------------

function setupBaseHandlers(overrides: Parameters<typeof server.use>[0][] = []) {
  server.use(
    ...overrides,
    http.get(`${BASE}/questions/topics`, () => HttpResponse.json(["Cardiology", "Neurology"])),
    http.get(`${BASE}/stage-b/sessions/active`, () => new HttpResponse(null, { status: 404 })),
    http.get(`${BASE}/stage-b/sessions`, () => HttpResponse.json([])),
  );
}

function setupRunningHandlers() {
  server.use(
    http.post(`${BASE}/stage-b/sessions/start`, () => HttpResponse.json(MOCK_SESSION)),
    http.post(
      `${BASE}/stage-b/sessions/:sessionId/tts/:caseIdx/:stageIdx`,
      () => new HttpResponse(null, { status: 500 }),
    ),
    http.post(
      `${BASE}/stage-b/sessions/:sessionId/answer/:caseIdx/:stageIdx/:questionNum`,
      () => HttpResponse.json(MOCK_ANSWER_RESULT),
    ),
    http.post(
      `${BASE}/stage-b/sessions/:sessionId/finalize`,
      () => HttpResponse.json(MOCK_REPORT),
    ),
    http.post(
      `${BASE}/stage-b/sessions/:sessionId/chat/:caseIdx/:stageIdx/:questionNum`,
      () => HttpResponse.json({ reply: "The vitals show HR 100." }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderPage() {
  return render(
    <MemoryRouter>
      <ExamGuardProvider>
        <StageBExamPage />
      </ExamGuardProvider>
    </MemoryRouter>
  );
}

// Helper: transitions page to running phase and waits for question stem.
async function goToRunningPhase() {
  setupBaseHandlers();
  setupRunningHandlers();
  renderPage();

  const generateBtn = await screen.findByRole("button", { name: "Generate Exam" });
  await userEvent.click(generateBtn);

  // TTS fails → showText=true → context text appears
  await screen.findByText("Patient arrives with chest pain.");
  // Wait for question stem too
  await screen.findByText("What is the most likely diagnosis?");
}

// ---------------------------------------------------------------------------
// Settings phase
// ---------------------------------------------------------------------------

describe("StageBExamPage — settings phase", () => {
  it("renders settings screen with heading and Generate button", async () => {
    setupBaseHandlers();
    renderPage();

    await expect(
      screen.findByRole("heading", { name: "Stage B — Oral Exam Simulator" })
    ).resolves.toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Generate Exam" })).toBeInTheDocument()
    );
  });

  it("shows topics from API in settings", async () => {
    setupBaseHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Cardiology")).toBeInTheDocument()
    );
    expect(screen.getByText("Neurology")).toBeInTheDocument();
  });

  it("shows Resume Active Session banner when active session exists", async () => {
    setupBaseHandlers([
      http.get(`${BASE}/stage-b/sessions/active`, () => HttpResponse.json(MOCK_ACTIVE_SESSION)),
    ]);
    renderPage();

    await expect(screen.findByText("Active session found")).resolves.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Resume Active Session" })
      ).toBeInTheDocument()
    );
  });

  it("shows Past Exams section when past sessions exist", async () => {
    setupBaseHandlers([
      http.get(`${BASE}/stage-b/sessions`, () => HttpResponse.json([MOCK_PAST_SESSION])),
    ]);
    renderPage();

    await expect(screen.findByText("Past Exams")).resolves.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retake" })).toBeInTheDocument()
    );
  });

  it("delete button removes exam from list", async () => {
    server.use(
      http.delete(`${BASE}/stage-b/sessions/${MOCK_PAST_SESSION.session_id}`, () =>
        new HttpResponse(null, { status: 204 })
      ),
    );
    setupBaseHandlers([
      http.get(`${BASE}/stage-b/sessions`, () => HttpResponse.json([MOCK_PAST_SESSION])),
    ]);
    renderPage();

    const deleteBtn = await screen.findByTitle("Delete exam");
    await userEvent.click(deleteBtn);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Retake" })).not.toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// Running phase
// ---------------------------------------------------------------------------

describe("StageBExamPage — running phase", () => {
  it("Generate Exam transitions to running phase with question visible", async () => {
    await goToRunningPhase();

    expect(screen.getByText("What is the most likely diagnosis?")).toBeInTheDocument();
    expect(screen.getByText("Patient arrives with chest pain.")).toBeInTheDocument();
  });

  it("typing answer enables Submit Answer button", async () => {
    await goToRunningPhase();

    const submitBtn = screen.getByRole("button", { name: "Submit Answer" });
    expect(submitBtn).toBeDisabled();

    await userEvent.type(
      screen.getByPlaceholderText("Type your answer…"),
      "I think it is NSTEMI"
    );

    expect(submitBtn).toBeEnabled();
  });

  it("submitting answer shows score and feedback", async () => {
    await goToRunningPhase();

    await userEvent.type(
      screen.getByPlaceholderText("Type your answer…"),
      "I think it is NSTEMI"
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit Answer" }));

    await screen.findByText("Score: 0.8/10");
    await waitFor(() =>
      expect(screen.getByText("Good answer covering key points.")).toBeInTheDocument()
    );
  });

  it("Ask the Examiner opens chat panel", async () => {
    await goToRunningPhase();

    await userEvent.click(screen.getByRole("button", { name: /Ask the Examiner/ }));

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Ask a clarifying question…")
      ).toBeInTheDocument()
    );
  });

  it("chat sends message and shows reply", async () => {
    await goToRunningPhase();

    await userEvent.click(screen.getByRole("button", { name: /Ask the Examiner/ }));

    const chatInput = await screen.findByPlaceholderText("Ask a clarifying question…");
    await userEvent.type(chatInput, "What are the vitals?");
    await userEvent.keyboard("{Enter}");

    await screen.findByText("The vitals show HR 100.");
  });

  it("Finalize Exam shows review phase", async () => {
    await goToRunningPhase();

    // Answer the question first so "Finalize Exam ✓" appears
    await userEvent.type(
      screen.getByPlaceholderText("Type your answer…"),
      "I think it is NSTEMI"
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit Answer" }));

    // Wait for the finalize button to appear (all questions answered)
    const finalizeBtn = await screen.findByRole("button", { name: /Finalize Exam/ });
    await userEvent.click(finalizeBtn);

    await screen.findByRole("heading", { name: "Exam Review" });
  });
});

// ---------------------------------------------------------------------------
// Review phase
// ---------------------------------------------------------------------------

describe("StageBExamPage — review phase", () => {
  async function goToReviewPhase() {
    await goToRunningPhase();

    await userEvent.type(
      screen.getByPlaceholderText("Type your answer…"),
      "I think it is NSTEMI"
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit Answer" }));

    const finalizeBtn = await screen.findByRole("button", { name: /Finalize Exam/ });
    await userEvent.click(finalizeBtn);

    await screen.findByRole("heading", { name: "Exam Review" });
  }

  it("review shows score stats and case accordion", async () => {
    await goToReviewPhase();

    expect(screen.getByText("Questions Answered")).toBeInTheDocument();
    // The Cardiology case accordion heading
    await waitFor(() =>
      expect(screen.getByText(/Case 1: Cardiology/)).toBeInTheDocument()
    );
  });

  it("Back to Exams navigates to /exams", async () => {
    setupBaseHandlers();
    setupRunningHandlers();

    render(
      <MemoryRouter initialEntries={["/exams/stage-b"]}>
        <Routes>
          <Route
            path="/exams/stage-b"
            element={
              <ExamGuardProvider>
                <StageBExamPage />
              </ExamGuardProvider>
            }
          />
          <Route path="/exams" element={<div>Exams Landing</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Generate → Running
    const generateBtn = await screen.findByRole("button", { name: "Generate Exam" });
    await userEvent.click(generateBtn);
    await screen.findByText("Patient arrives with chest pain.");

    // Answer → Finalize
    await userEvent.type(
      screen.getByPlaceholderText("Type your answer…"),
      "I think it is NSTEMI"
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit Answer" }));
    const finalizeBtn = await screen.findByRole("button", { name: /Finalize Exam/ });
    await userEvent.click(finalizeBtn);
    await screen.findByRole("heading", { name: "Exam Review" });

    // Navigate back
    await userEvent.click(screen.getByRole("button", { name: "Back to Exams" }));

    await waitFor(() =>
      expect(screen.getByText("Exams Landing")).toBeInTheDocument()
    );
  });
});
