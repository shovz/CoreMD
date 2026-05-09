import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import AssistantChat from "../AssistantChat";
import { server } from "../../test/mswServer";

const ASK_URL = "http://localhost:8000/api/v1/ai/ask";

describe("AssistantChat", () => {
  it("shows selected context and waits for the user's question before sending", async () => {
    let requestCount = 0;
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post(ASK_URL, async ({ request }) => {
        requestCount += 1;
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          answer: "This passage describes decongestion.",
          citations: [
            {
              chapter_id: "ch-001",
              chapter_title: "Heart Failure",
              section_id: "sec-001",
              section_title: "Treatment",
            },
          ],
        });
      })
    );

    render(
      <MemoryRouter>
        <AssistantChat
          compact
          selectedContext={{
            selected_text: "Loop diuretics reduce congestion.",
            chapter_id: "ch-001",
            section_id: "sec-001",
            chapter_title: "Heart Failure",
            section_title: "Treatment",
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Selected context - Heart Failure - Treatment")).toBeInTheDocument();
    expect(screen.getByText("Loop diuretics reduce congestion.")).toBeInTheDocument();
    expect(requestCount).toBe(0);

    await userEvent.type(
      screen.getByPlaceholderText(/Ask anything about Harrison/),
      "What does this mean?"
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() =>
      expect(screen.getByText("This passage describes decongestion.")).toBeInTheDocument()
    );
    expect(requestCount).toBe(1);
    expect(requestBody).toMatchObject({
      question: "What does this mean?",
      selected_context: {
        selected_text: "Loop diuretics reduce congestion.",
        chapter_id: "ch-001",
        section_id: "sec-001",
      },
    });
    expect(screen.getByRole("link", { name: "Heart Failure" })).toHaveAttribute(
      "href",
      "/chapters/ch-001/sections/sec-001"
    );
  });
});
