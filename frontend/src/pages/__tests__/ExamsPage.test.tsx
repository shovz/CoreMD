import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mswServer";
import ExamsPage from "../ExamsPage";
import { ExamGuardProvider } from "../../context/ExamGuardContext";

const BASE = "http://localhost:8000/api/v1";
const SESSION_ID = "sess-test-001";

const MOCK_SESSION = {
  session_id: SESSION_ID,
  question_count: 1,
  actual_question_count: 1,
  requested_question_count: 150,
  shortened_due_to_pool: false,
  expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  items: [
    {
      index: 1,
      question_id: "q-exam-001",
      stem: "A 55-year-old presents with chest pain and elevated troponin.",
      options: ["NSTEMI", "STEMI", "Pericarditis", "Aortic dissection"],
      topic: "Cardiology",
      selected_option: null,
      is_correct: null,
      correct_option: null,
      explanation: null,
    },
  ],
};

const MOCK_ANSWER_RESULT = { correct: true, correct_option: 0 };

const MOCK_REPORT = {
  session_id: SESSION_ID,
  question_count: 1,
  answered_count: 1,
  correct_count: 1,
  percent_correct: 100.0,
  elapsed_seconds: 120,
  shortened_due_to_pool: false,
  actual_question_count: 1,
  requested_question_count: 150,
  review_items: [
    {
      index: 1,
      question_id: "q-exam-001",
      stem: "A 55-year-old presents with chest pain and elevated troponin.",
      options: ["NSTEMI", "STEMI", "Pericarditis", "Aortic dissection"],
      topic: "Cardiology",
      selected_option: 0,
      is_correct: true,
      correct_option: 0,
      explanation: "Elevated troponin without ST elevation confirms NSTEMI.",
    },
  ],
};

function setupHandlers(overrides: Parameters<typeof server.use>[0][] = []) {
  server.use(
    ...overrides,
    http.get(`${BASE}/questions/topics`, () => HttpResponse.json(["Cardiology", "Nephrology"])),
    http.get(`${BASE}/chapters`, () => HttpResponse.json([])),
    http.get(`${BASE}/questions/exam-presets/stage-a`, () => HttpResponse.json([])),
    http.post(`${BASE}/questions/exam-sessions/stage-a/preview`, () =>
      HttpResponse.json({
        eligible_count: 42,
        requested_question_count: 150,
        actual_question_count: 42,
        shortened_due_to_pool: false,
      })
    ),
    http.post(`${BASE}/questions/exam-sessions/stage-a/start`, () =>
      HttpResponse.json(MOCK_SESSION)
    ),
    http.post(
      `${BASE}/questions/exam-sessions/stage-a/${SESSION_ID}/answer`,
      () => HttpResponse.json(MOCK_ANSWER_RESULT)
    ),
    http.post(
      `${BASE}/questions/exam-sessions/stage-a/${SESSION_ID}/finalize`,
      () => HttpResponse.json(MOCK_REPORT)
    )
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ExamGuardProvider>
        <ExamsPage />
      </ExamGuardProvider>
    </MemoryRouter>
  );
}

describe("ExamsPage", () => {
  it("renders settings screen with Exams heading and Start button", async () => {
    setupHandlers();
    renderPage();

    await expect(
      screen.findByRole("heading", { name: "Exams" })
    ).resolves.toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start Stage A Exam" })).toBeInTheDocument()
    );
  });

  it("shows topics from API in settings", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cardiology" })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "Nephrology" })).toBeInTheDocument();
  });

  it("shows preview eligible pool count after load", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Eligible pool:/)).toBeInTheDocument()
    );
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it("clicking Start Stage A Exam transitions to running phase with question visible", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start Stage A Exam" })).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: "Start Stage A Exam" }));

    await waitFor(() =>
      expect(
        screen.getByText("A 55-year-old presents with chest pain and elevated troponin.")
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("heading", { name: "Stage A Exam" })).toBeInTheDocument();
  });

  it("selecting option and submitting increments answered counter", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start Stage A Exam" })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: "Start Stage A Exam" }));

    await waitFor(() =>
      expect(
        screen.getByText("A 55-year-old presents with chest pain and elevated troponin.")
      ).toBeInTheDocument()
    );

    // Select first option (A. NSTEMI)
    await userEvent.click(screen.getByRole("button", { name: /A\..*NSTEMI/ }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(screen.getByText(/1\/1 answered/)).toBeInTheDocument()
    );
  });

  it("Finalize Exam transitions to review with report", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start Stage A Exam" })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: "Start Stage A Exam" }));

    await waitFor(() =>
      expect(
        screen.getByText("A 55-year-old presents with chest pain and elevated troponin.")
      ).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: "Finalize Exam" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Stage A Mock Report" })).toBeInTheDocument()
    );
    expect(screen.getByText("100.00%")).toBeInTheDocument();
  });

  it("Build Another Exam returns to settings from review", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start Stage A Exam" })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: "Start Stage A Exam" }));

    await waitFor(() =>
      expect(
        screen.getByText("A 55-year-old presents with chest pain and elevated troponin.")
      ).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: "Finalize Exam" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Stage A Mock Report" })).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: "Build Another Exam" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Exams" })).toBeInTheDocument()
    );
  });
});
