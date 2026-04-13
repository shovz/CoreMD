import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <h1>Welcome to CoreMD</h1>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
        <button onClick={() => window.location.href = "/login"}>Login</button>
        <button onClick={() => window.location.href = "/register"}>Register</button>
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <Link to="/">Dashboard</Link>
        <Link to="/cases">Cases</Link>
        <Link to="/chat">AI Chat</Link>
      </div>
    </div>
  );
}
