import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mswServer";
import CaseDetailPage from "../CaseDetailPage";

const BASE = "http://localhost:8000/api/v1";
const CASE_ID = "case-001";

const MOCK_CASE = {
  case_id: CASE_ID,
  title: "Chest Pain in a 65-Year-Old",
  specialty: "Cardiology",
  presentation: "A 65-year-old male presents with crushing chest pain.",
  history: "HTN, hyperlipidemia, prior MI.",
  physical_exam: "BP 150/90, HR 88, diaphoretic.",
  labs: "Troponin 0.8 ng/mL",
  imaging: "CXR: no acute changes",
  discussion: "ACS should be ruled out promptly.",
  diagnosis: "NSTEMI",
  management: "Aspirin, heparin, PCI.",
  chapter_id: "ch-cardio",
  chapter_title: "Ischemic Heart Disease",
};

const MOCK_QUESTIONS = [
  {
    case_question_id: "cq-001",
    case_id: CASE_ID,
    step: 1,
    stem: "What is the most likely diagnosis?",
    options: ["NSTEMI", "STEMI", "Aortic dissection", "Pulmonary embolism"],
  },
  {
    case_question_id: "cq-002",
    case_id: CASE_ID,
    step: 2,
    stem: "Which finding best confirms the diagnosis?",
    options: ["ECG changes", "Elevated troponin", "Echo", "CT-PA"],
  },
];

const CORRECT_RESULT = {
  correct: true,
  correct_option: 0,
  explanation: "NSTEMI is confirmed by elevated troponin without ST elevation.",
  option_explanations: [
    "NSTEMI fits elevated troponin without ST elevation.",
    "STEMI requires ST elevation criteria.",
    "Aortic dissection is not confirmed by the troponin pattern alone.",
    "Pulmonary embolism would require supporting respiratory or imaging findings.",
  ],
};

const INCORRECT_RESULT = {
  correct: false,
  correct_option: 0,
  explanation: "NSTEMI is confirmed by elevated troponin without ST elevation.",
  option_explanations: CORRECT_RESULT.option_explanations,
};

function setupHandlers(overrides: Parameters<typeof server.use>[0][] = []) {
  server.use(
    ...overrides,
    http.get(`${BASE}/cases/${CASE_ID}`, () => HttpResponse.json(MOCK_CASE)),
    http.get(`${BASE}/cases/${CASE_ID}/questions`, () => HttpResponse.json(MOCK_QUESTIONS)),
    http.get(`${BASE}/bookmarks`, () => HttpResponse.json([])),
    http.post(`${BASE}/cases/${CASE_ID}/questions/:qId/attempt`, () =>
      HttpResponse.json(CORRECT_RESULT)
    ),
    http.post(`${BASE}/bookmarks`, () => HttpResponse.json({ bookmarked: true })),
    http.delete(`${BASE}/bookmarks/${CASE_ID}`, () => HttpResponse.json({ bookmarked: false }))
  );
}

function renderPage(id = CASE_ID) {
  return render(
    <MemoryRouter initialEntries={[`/cases/${id}`]}>
      <Routes>
        <Route path="/cases/:id" element={<CaseDetailPage />} />
        <Route path="/cases" element={<div>Cases List</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CaseDetailPage", () => {
  it("renders case title and presentation after load", async () => {
    setupHandlers();
    renderPage();

    await expect(
      screen.findByText("Chest Pain in a 65-Year-Old")
    ).resolves.toBeInTheDocument();

    expect(
      screen.getByText("A 65-year-old male presents with crushing chest pain.")
    ).toBeInTheDocument();
  });

  it("shows error when case fetch fails", async () => {
    server.use(
      http.get(`${BASE}/cases/${CASE_ID}`, () =>
        HttpResponse.json({ detail: "not found" }, { status: 500 })
      ),
      http.get(`${BASE}/cases/${CASE_ID}/questions`, () => HttpResponse.json([])),
      http.get(`${BASE}/bookmarks`, () => HttpResponse.json([]))
    );
    renderPage();

    await expect(
      screen.findByText("Failed to load case.")
    ).resolves.toBeInTheDocument();
  });

  it("renders first question unlocked and second question locked", async () => {
    setupHandlers();
    renderPage();

    await expect(
      screen.findByText("What is the most likely diagnosis?")
    ).resolves.toBeInTheDocument();

    expect(
      screen.getByText("Locked — answer previous question first.")
    ).toBeInTheDocument();

    // First question has selectable options, not locked
    expect(screen.getByRole("button", { name: /NSTEMI/ })).toBeInTheDocument();
  });

  it("clicking option enables Submit and submitting shows Correct feedback", async () => {
    setupHandlers();
    renderPage();

    await expect(
      screen.findByText("What is the most likely diagnosis?")
    ).resolves.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /NSTEMI/ }));

    const submitBtn = screen.getByRole("button", { name: /Submit/ });
    expect(submitBtn).not.toBeDisabled();

    await userEvent.click(submitBtn);

    await waitFor(() =>
      expect(screen.getByText("Correct")).toBeInTheDocument()
    );
    expect(
      screen.getByText("NSTEMI fits elevated troponin without ST elevation.")
    ).toBeInTheDocument();
    expect(screen.getByText("STEMI requires ST elevation criteria.")).toBeInTheDocument();
  });

  it("shows Incorrect feedback when wrong answer submitted", async () => {
    setupHandlers([
      http.post(`${BASE}/cases/${CASE_ID}/questions/:qId/attempt`, () =>
        HttpResponse.json(INCORRECT_RESULT)
      ),
    ]);
    renderPage();

    await expect(
      screen.findByText("What is the most likely diagnosis?")
    ).resolves.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Aortic dissection/ }));
    await userEvent.click(screen.getByRole("button", { name: /Submit/ }));

    await waitFor(() =>
      expect(screen.getByText("Incorrect")).toBeInTheDocument()
    );
  });

  it("second question unlocks after answering the first", async () => {
    setupHandlers();
    renderPage();

    await expect(
      screen.findByText("What is the most likely diagnosis?")
    ).resolves.toBeInTheDocument();

    // Q2 starts locked
    expect(screen.getByText("Locked — answer previous question first.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /NSTEMI/ }));
    await userEvent.click(screen.getByRole("button", { name: /Submit/ }));

    await waitFor(() =>
      expect(screen.queryByText("Locked — answer previous question first.")).not.toBeInTheDocument()
    );

    // Q2 options now visible
    expect(screen.getByRole("button", { name: /Elevated troponin/ })).toBeInTheDocument();
  });

  it("toggles bookmark from unstarred to starred on click", async () => {
    setupHandlers();
    renderPage();

    await expect(
      screen.findByText("Chest Pain in a 65-Year-Old")
    ).resolves.toBeInTheDocument();

    // Initial state: not bookmarked (☆ shown)
    const starBtn = screen.getByTitle("Bookmark case");

    await userEvent.click(starBtn);

    await waitFor(() =>
      expect(screen.getByTitle("Remove bookmark")).toBeInTheDocument()
    );
  });
});
