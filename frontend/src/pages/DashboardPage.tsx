export default function DashboardPage() {
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <p>You are logged in 🎉</p>

      <button onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
