import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mswServer";
import DashboardPage from "../DashboardPage";

vi.mock("../../context/AuthContext", () => ({
  useAuthContext: () => ({
    user: { id: "1", email: "test@example.com", full_name: "Jane Smith", role: "user" },
  }),
}));

const DASHBOARD_URL = "http://localhost:8000/api/v1/stats/dashboard";
const QUESTIONS_URL = "http://localhost:8000/api/v1/stats/questions";

const EMPTY_STATS = {
  streak_days: 0,
  questions_answered: 0,
  accuracy_pct: 0,
  last_chapter: null,
  last_question: null,
  weak_topics: [],
};

const EMPTY_PERF = { by_difficulty: {}, by_topic: [] };

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

describe("DashboardPage", () => {
  it("renders greeting with user's last name", async () => {
    server.use(
      http.get(DASHBOARD_URL, () => HttpResponse.json(EMPTY_STATS)),
      http.get(QUESTIONS_URL, () => HttpResponse.json(EMPTY_PERF))
    );

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText(/Dr\. Smith/)).toBeInTheDocument()
    );
  });

  it("shows empty state message when questions_answered is 0", async () => {
    server.use(
      http.get(DASHBOARD_URL, () => HttpResponse.json(EMPTY_STATS)),
      http.get(QUESTIONS_URL, () => HttpResponse.json(EMPTY_PERF))
    );

    renderDashboard();

    await waitFor(() =>
      expect(
        screen.getByText(/Start by reading a chapter or trying a question/)
      ).toBeInTheDocument()
    );
  });

  it("shows Continue card with chapter link when last_chapter is present", async () => {
    server.use(
      http.get(DASHBOARD_URL, () =>
        HttpResponse.json({
          ...EMPTY_STATS,
          questions_answered: 5,
          last_chapter: { id: "ch-001", title: "Heart Failure" },
        })
      ),
      http.get(QUESTIONS_URL, () => HttpResponse.json(EMPTY_PERF))
    );

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Heart Failure")).toBeInTheDocument()
    );
    expect(screen.getByText("Continue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Heart Failure" })).toHaveAttribute(
      "href",
      "/chapters/ch-001"
    );
  });

  it("shows Focus Topics section when weak_topics are returned", async () => {
    server.use(
      http.get(DASHBOARD_URL, () =>
        HttpResponse.json({
          ...EMPTY_STATS,
          questions_answered: 10,
          weak_topics: ["Cardiology", "Nephrology"],
        })
      ),
      http.get(QUESTIONS_URL, () => HttpResponse.json(EMPTY_PERF))
    );

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Focus Topics")).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "Cardiology" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nephrology" })).toBeInTheDocument();
  });

  it("shows error message when getDashboardStats fails", async () => {
    server.use(
      http.get(DASHBOARD_URL, () =>
        HttpResponse.json({ detail: "error" }, { status: 500 })
      ),
      http.get(QUESTIONS_URL, () => HttpResponse.json(EMPTY_PERF))
    );

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Failed to load dashboard.")).toBeInTheDocument()
    );
  });

  it("does not show empty state when loading is in progress", () => {
    server.use(
      http.get(DASHBOARD_URL, () => new Promise(() => {})),
      http.get(QUESTIONS_URL, () => new Promise(() => {}))
    );

    renderDashboard();

    expect(
      screen.queryByText(/Start by reading a chapter/)
    ).not.toBeInTheDocument();
  });
});
