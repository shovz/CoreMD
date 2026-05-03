import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mswServer";
import { AuthProvider, useAuthContext } from "../AuthContext";

const ME_URL = "http://localhost:8000/api/v1/auth/me";
const FAKE_USER = { id: "abc123", email: "test@example.com", role: "user" };

function TestConsumer() {
  const { user, isInitializing, logout } = useAuthContext();
  if (isInitializing) return <div data-testid="loading">loading</div>;
  return (
    <div>
      <div data-testid="email">{user?.email ?? "null"}</div>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

describe("AuthContext", () => {
  afterEach(() => {
    localStorage.removeItem("access_token");
  });

  it("finishes initializing with no user when no token present", async () => {
    renderWithProvider();
    await waitFor(() =>
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("email")).toHaveTextContent("null");
  });

  it("fetches and sets user when token is in localStorage", async () => {
    localStorage.setItem("access_token", "valid-token");
    server.use(http.get(ME_URL, () => HttpResponse.json(FAKE_USER)));

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent("test@example.com")
    );
  });

  it("removes token from localStorage on 401 from /auth/me", async () => {
    localStorage.setItem("access_token", "expired-token");
    server.use(
      http.get(ME_URL, () =>
        HttpResponse.json({ detail: "Unauthorized" }, { status: 401 })
      )
    );

    renderWithProvider();

    await waitFor(() =>
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument()
    );
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("logout clears token and user", async () => {
    localStorage.setItem("access_token", "valid-token");
    server.use(http.get(ME_URL, () => HttpResponse.json(FAKE_USER)));

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent("test@example.com")
    );

    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    expect(screen.getByTestId("email")).toHaveTextContent("null");
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("throws when used outside AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useAuthContext must be used within AuthProvider"
    );
    spy.mockRestore();
  });
});
