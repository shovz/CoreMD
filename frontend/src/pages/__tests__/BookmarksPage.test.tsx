import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mswServer";
import BookmarksPage from "../BookmarksPage";

const BOOKMARKS_URL = "http://localhost:8000/api/v1/bookmarks";

const QUESTION_BOOKMARKS = [
  {
    type: "question",
    item_id: "q-001",
    created_at: "2024-01-01T00:00:00Z",
    document: { stem: "What is the mechanism of aspirin?" },
  },
  {
    type: "question",
    item_id: "q-002",
    created_at: "2024-01-02T00:00:00Z",
    document: { stem: "Which drug inhibits ACE?" },
  },
];

const CASE_BOOKMARKS = [
  {
    type: "case",
    item_id: "case-001",
    created_at: "2024-01-01T00:00:00Z",
    document: { title: "Chest Pain Case" },
  },
];

function setupBookmarksHandler(
  questionData = QUESTION_BOOKMARKS,
  caseData = CASE_BOOKMARKS
) {
  server.use(
    http.get(BOOKMARKS_URL, ({ request }) => {
      const url = new URL(request.url);
      const type = url.searchParams.get("type");
      if (type === "case") return HttpResponse.json(caseData);
      return HttpResponse.json(questionData);
    }),
    http.delete(`${BOOKMARKS_URL}/:itemId`, () =>
      HttpResponse.json({ bookmarked: false })
    )
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <BookmarksPage />
    </MemoryRouter>
  );
}

describe("BookmarksPage", () => {
  it("shows question bookmarks on load", async () => {
    setupBookmarksHandler();
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("What is the mechanism of aspirin?")).toBeInTheDocument()
    );
    expect(screen.getByText("Which drug inhibits ACE?")).toBeInTheDocument();
  });

  it("shows empty state when no question bookmarks", async () => {
    setupBookmarksHandler([], []);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("No bookmarked questions yet.")).toBeInTheDocument()
    );
  });

  it("shows case bookmarks when Cases tab clicked", async () => {
    setupBookmarksHandler();
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("What is the mechanism of aspirin?")).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: "Cases" }));

    await waitFor(() =>
      expect(screen.getByText("Chest Pain Case")).toBeInTheDocument()
    );
  });

  it("shows error when bookmark fetch fails", async () => {
    server.use(
      http.get(BOOKMARKS_URL, () => HttpResponse.json({ detail: "error" }, { status: 500 }))
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Failed to load bookmarks.")).toBeInTheDocument()
    );
  });

  it("removes bookmark from list on ✕ click", async () => {
    setupBookmarksHandler();
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("What is the mechanism of aspirin?")).toBeInTheDocument()
    );

    const removeButtons = screen.getAllByRole("button", { name: /Remove bookmark|✕/ });
    await userEvent.click(removeButtons[0]);

    await waitFor(() =>
      expect(screen.queryByText("What is the mechanism of aspirin?")).not.toBeInTheDocument()
    );
    // Second bookmark still present
    expect(screen.getByText("Which drug inhibits ACE?")).toBeInTheDocument();
  });

  it("does not refetch case bookmarks on second Cases tab click", async () => {
    let callCount = 0;
    server.use(
      http.get(BOOKMARKS_URL, ({ request }) => {
        const type = new URL(request.url).searchParams.get("type");
        if (type === "case") callCount++;
        return HttpResponse.json(type === "case" ? CASE_BOOKMARKS : QUESTION_BOOKMARKS);
      }),
      http.delete(`${BOOKMARKS_URL}/:itemId`, () => HttpResponse.json({ bookmarked: false }))
    );
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Cases" }));
    await waitFor(() => expect(screen.getByText("Chest Pain Case")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Questions" }));
    await userEvent.click(screen.getByRole("button", { name: "Cases" }));

    // Second tab visit uses cached data, no second fetch
    await waitFor(() => expect(callCount).toBe(1));
  });
});
