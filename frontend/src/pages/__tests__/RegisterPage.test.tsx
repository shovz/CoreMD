import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mswServer";
import RegisterPage from "../RegisterPage";

const REGISTER_URL = "http://localhost:8000/api/v1/auth/register";

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillAndSubmit(
  fullName = "Jane Smith",
  email = "jane@example.com",
  password = "password123"
) {
  await userEvent.type(screen.getByPlaceholderText("Jane Smith"), fullName);
  await userEvent.type(screen.getByPlaceholderText("you@example.com"), email);
  await userEvent.type(screen.getByPlaceholderText("Create a strong password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
}

describe("RegisterPage", () => {
  it("navigates to /login on successful registration", async () => {
    server.use(
      http.post(REGISTER_URL, () =>
        HttpResponse.json({ id: "1", email: "jane@example.com", role: "user" })
      )
    );

    renderRegisterPage();
    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText("Login")).toBeInTheDocument()
    );
  });

  it("shows server error detail on failed registration", async () => {
    server.use(
      http.post(REGISTER_URL, () =>
        HttpResponse.json({ detail: "Email already registered" }, { status: 400 })
      )
    );

    renderRegisterPage();
    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText("Email already registered")).toBeInTheDocument()
    );
  });

  it("shows generic error when server returns no detail", async () => {
    server.use(
      http.post(REGISTER_URL, () => HttpResponse.json({}, { status: 500 }))
    );

    renderRegisterPage();
    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText(/Error 500: registration failed/)).toBeInTheDocument()
    );
  });

  it("disables button and shows loading text while submitting", async () => {
    let resolve!: (v: Response) => void;
    server.use(
      http.post(REGISTER_URL, () => new Promise<Response>((r) => { resolve = r; }))
    );

    renderRegisterPage();
    await fillAndSubmit();

    expect(screen.getByRole("button", { name: "Registering..." })).toBeDisabled();
    resolve(HttpResponse.json({ id: "1" }) as unknown as Response);
  });
});
