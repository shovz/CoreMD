import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ExamsLandingPage from "../ExamsLandingPage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/exams"]}>
      <Routes>
        <Route path="/exams" element={<ExamsLandingPage />} />
        <Route path="/exams/stage-a" element={<div>Stage A Page</div>} />
        <Route path="/exams/stage-b" element={<div>Stage B Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ExamsLandingPage", () => {
  it("Stage A card navigates to /exams/stage-a when clicked", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /Stage A/ }));

    expect(screen.getByText("Stage A Page")).toBeInTheDocument();
  });

  it("Stage B card navigates to /exams/stage-b when clicked", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /Stage B/ }));

    expect(screen.getByText("Stage B Page")).toBeInTheDocument();
  });
});
