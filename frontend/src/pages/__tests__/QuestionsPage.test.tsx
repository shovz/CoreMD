import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mswServer";
import QuestionsPage from "../QuestionsPage";

const BASE = "http://localhost:8000/api/v1";

const MOCK_QUESTION: import("../../api/questionsApi").QuestionOut = {
  question_id: "q-test-001",
  stem: "Which enzyme is most specific for myocardial injury?",
  options: ["Troponin I", "AST", "LDH", "CK-MM"],
  topic: "Cardiology",
  chapter_id: "ch-001",
  difficulty: "medium",
};

const CORRECT_RESULT = {
  correct: true,
  correct_option: 0,
  explanation: "Troponin I is released exclusively from cardiac muscle cells.",
  option_explanations: [
    "Troponin I is the most specific option for myocardial injury.",
    "AST is nonspecific and can rise with hepatic or skeletal muscle injury.",
    "LDH is nonspecific and not preferred for myocardial injury.",
    "CK-MM reflects skeletal muscle rather than myocardium.",
  ],
};

const INCORRECT_RESULT = {
  correct: false,
  correct_option: 0,
  explanation: "Troponin I is released exclusively from cardiac muscle cells.",
  option_explanations: CORRECT_RESULT.option_explanations,
};

function setupHandlers(overrides: Parameters<typeof server.use>[0][] = []) {
  server.use(
    // Overrides come first — MSW matches in registration order (first wins)
    ...overrides,
    http.get(`${BASE}/questions/topics`, () => HttpResponse.json(["Cardiology", "Nephrology"])),
    http.get(`${BASE}/questions`, () => HttpResponse.json([MOCK_QUESTION])),
    http.post(`${BASE}/questions/:id/attempt`, () => HttpResponse.json(CORRECT_RESULT)),
    http.get(`${BASE}/bookmarks`, () => HttpResponse.json([])),
    http.post(`${BASE}/bookmarks`, () => HttpResponse.json({ bookmarked: true })),
    http.delete(`${BASE}/bookmarks/:id`, () => HttpResponse.json({ bookmarked: false }))
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <QuestionsPage />
    </MemoryRouter>
  );
}

describe("QuestionsPage", () => {
  it("renders settings screen with Question Bank heading", async () => {
    setupHandlers();
    renderPage();

    await expect(
      screen.findByRole("heading", { name: "Question Bank" })
    ).resolves.toBeInTheDocument();
  });

  it("shows topics from API when By Topic mode selected", async () => {
    setupHandlers();
    renderPage();

    // Topics only appear after switching to "By Topic" mode
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "By Topic" })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: "By Topic" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cardiology" })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "Nephrology" })).toBeInTheDocument();
  });

  it("starting a random session loads and shows question stem", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Start Session/ })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /Start Session/ }));

    await waitFor(() =>
      expect(
        screen.getByText("Which enzyme is most specific for myocardial injury?")
      ).toBeInTheDocument()
    );
  });

  it("clicking an option immediately submits and shows explanation", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Start Session/ })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /Start Session/ }));

    await waitFor(() =>
      expect(screen.getByText("Which enzyme is most specific for myocardial injury?")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: /Troponin I/ }));

    await waitFor(() =>
      expect(
        screen.getByText("Troponin I is the most specific option for myocardial injury.")
      ).toBeInTheDocument()
    );
    expect(screen.getByText("AST is nonspecific and can rise with hepatic or skeletal muscle injury.")).toBeInTheDocument();
  });

  it("shows Correct feedback when answer is right", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Start Session/ })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /Start Session/ }));
    await waitFor(() =>
      expect(screen.getByText("Which enzyme is most specific for myocardial injury?")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: /Troponin I/ }));

    await waitFor(() => expect(screen.getByText("Correct")).toBeInTheDocument());
  });

  it("shows Incorrect feedback when answer is wrong", async () => {
    setupHandlers([
      http.post(`${BASE}/questions/:id/attempt`, () => HttpResponse.json(INCORRECT_RESULT)),
    ]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Start Session/ })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /Start Session/ }));
    await waitFor(() =>
      expect(screen.getByText("Which enzyme is most specific for myocardial injury?")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: /AST/ }));

    await waitFor(() => expect(screen.getByText("Incorrect")).toBeInTheDocument());
  });

  it("← Settings button returns to settings screen", async () => {
    setupHandlers();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Start Session/ })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /Start Session/ }));
    await waitFor(() =>
      expect(screen.getByText("Which enzyme is most specific for myocardial injury?")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: /← Settings/ }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Start Session/ })).toBeInTheDocument()
    );
  });
});
