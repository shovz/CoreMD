import { Link } from "react-router-dom";

export default function DashboardPage() {
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <p>You are logged in 🎉</p>

      <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Link to="/chapters">Chapters</Link>
        <Link to="/questions">Question Bank</Link>
      </nav>

      <button onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
