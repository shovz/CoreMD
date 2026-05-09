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
      option_explanations: null,
    },
  ],
};

const MOCK_ANSWER_RESULT = {
  correct: true,
  correct_option: 0,
  explanation: "Elevated troponin without ST elevation confirms NSTEMI.",
  option_explanations: [
    "NSTEMI is correct because troponin is elevated without ST elevation.",
    "STEMI requires diagnostic ST elevation.",
    "Pericarditis usually has pleuritic pain and diffuse ST elevation.",
    "Aortic dissection requires a different vascular presentation.",
  ],
  answered_count: 1,
  correct_count: 1,
  remaining_seconds: 14300,
};

const MOCK_CHAPTERS = [
  {
    id: "chapter-good-health",
    title: "Promoting Good Health",
    chapter_number: 2,
    part_number: 1,
    part_title: "Introduction to Clinical Medicine",
    specialty: "General Medicine",
    sections: [],
  },
  {
    id: "chapter-parkinson",
    title: "Parkinson Disease and Other Movement Disorders",
    chapter_number: 444,
    part_number: 17,
    part_title: "Neurologic Disorders",
    specialty: "Neurology",
    sections: [],
  },
];

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
      option_explanations: MOCK_ANSWER_RESULT.option_explanations,
    },
  ],
};

function setupHandlers(overrides: Parameters<typeof server.use>[0][] = []) {
  server.use(
    ...overrides,
    http.get(`${BASE}/questions/topics`, () => HttpResponse.json(["Cardiology", "Nephrology", "Parkinson's Disease", "Pulmonary Oncology"])),
    http.get(`${BASE}/chapters`, () => HttpResponse.json(MOCK_CHAPTERS)),
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
      expect(screen.getByText(/Cardiology/)).toBeInTheDocument()
    );
    expect(screen.getByText(/Nephrology/)).toBeInTheDocument();
  });

  it("separates topic scope from chapter scope", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /By Topic/ })).toBeInTheDocument()
    );

    expect(screen.getByText("Cardiology")).toBeInTheDocument();
    expect(screen.queryByText(/Promoting Good Health/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /By Chapter/ }));

    expect(screen.getByText(/Introduction to Clinical Medicine/)).toBeInTheDocument();
    expect(screen.getByText(/Promoting Good Health/)).toBeInTheDocument();
    expect(screen.queryByText("Cardiology")).not.toBeInTheDocument();
  });

  it("chapter mode search supports partial word matching against chapter labels", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /By Chapter/ })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /By Chapter/ }));
    await userEvent.type(screen.getByPlaceholderText(/Search chapters/), "Good Health");

    expect(screen.getByText(/Promoting Good Health/)).toBeInTheDocument();
    expect(screen.queryByText(/Parkinson Disease/)).not.toBeInTheDocument();
  });

  it("sends only topic filters in topic mode and only chapter filters in chapter mode", async () => {
    const payloads: unknown[] = [];
    setupHandlers([
      http.post(`${BASE}/questions/exam-sessions/stage-a/start`, async ({ request }) => {
        payloads.push(await request.json());
        return HttpResponse.json(MOCK_SESSION);
      }),
    ]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start Stage A Exam" })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByText("Parkinson's Disease"));
    await userEvent.click(screen.getByRole("button", { name: "Start Stage A Exam" }));

    await waitFor(() => expect(payloads).toHaveLength(1));
    expect(payloads[0]).toMatchObject({
      topics: ["Parkinson's Disease"],
      part_numbers: [],
      chapter_ids: [],
    });

    await userEvent.click(screen.getByRole("button", { name: "Back to Settings" }));
    await userEvent.click(screen.getByRole("button", { name: /By Chapter/ }));
    await userEvent.click(screen.getByText(/Promoting Good Health/));
    await userEvent.click(screen.getByRole("button", { name: "Start Stage A Exam" }));

    await waitFor(() => expect(payloads).toHaveLength(2));
    expect(payloads[1]).toMatchObject({
      topics: [],
      chapter_ids: ["chapter-good-health"],
    });
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
