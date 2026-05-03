import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mswServer";
import { AuthProvider } from "../../context/AuthContext";
import LoginPage from "../LoginPage";

const LOGIN_URL = "http://localhost:8000/api/v1/auth/login";
const ME_URL = "http://localhost:8000/api/v1/auth/me";
const FAKE_USER = { id: "1", email: "doc@example.com", role: "user" };

function renderLoginPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("LoginPage", () => {
  afterEach(() => {
    localStorage.removeItem("access_token");
  });

  it("navigates to /dashboard after successful login", async () => {
    server.use(
      http.post(LOGIN_URL, () => HttpResponse.json({ access_token: "tok" })),
      http.get(ME_URL, () => HttpResponse.json(FAKE_USER))
    );

    renderLoginPage();
    // Wait for AuthProvider to finish initializing (no token → immediate)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Login" })).toBeEnabled()
    );

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "doc@example.com");
    await userEvent.type(screen.getByPlaceholderText("********"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(screen.getByText("Dashboard")).toBeInTheDocument()
    );
  });

  it("stores access_token in localStorage on success", async () => {
    server.use(
      http.post(LOGIN_URL, () => HttpResponse.json({ access_token: "my-token" })),
      http.get(ME_URL, () => HttpResponse.json(FAKE_USER))
    );

    renderLoginPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Login" })).toBeEnabled()
    );

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "doc@example.com");
    await userEvent.type(screen.getByPlaceholderText("********"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(localStorage.getItem("access_token")).toBe("my-token")
    );
  });

  it("shows server error detail on failed login", async () => {
    server.use(
      http.post(LOGIN_URL, () =>
        HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 })
      )
    );

    renderLoginPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Login" })).toBeEnabled()
    );

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "bad@example.com");
    await userEvent.type(screen.getByPlaceholderText("********"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument()
    );
  });

  it("shows generic error when server returns no detail", async () => {
    server.use(
      http.post(LOGIN_URL, () => HttpResponse.json({}, { status: 500 }))
    );

    renderLoginPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Login" })).toBeEnabled()
    );

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "doc@example.com");
    await userEvent.type(screen.getByPlaceholderText("********"), "pass");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() =>
      expect(screen.getByText(/Error 500: login failed/)).toBeInTheDocument()
    );
  });

  it("disables button and shows loading text while submitting", async () => {
    let resolve!: (v: Response) => void;
    server.use(
      http.post(LOGIN_URL, () => new Promise<Response>((r) => { resolve = r; }))
    );

    renderLoginPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Login" })).toBeEnabled()
    );

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "doc@example.com");
    await userEvent.type(screen.getByPlaceholderText("********"), "pass");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(screen.getByRole("button", { name: "Logging in..." })).toBeDisabled();
    resolve(HttpResponse.json({ access_token: "tok" }) as unknown as Response);
  });
});
