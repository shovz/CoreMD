export default function Home() {


  return (
    <div style={{ padding: 24, textAlign: "center" }}>
        <h1>Welcome to CoreMD</h1>
        <button onClick={() => window.location.href = "/login"}>Login</button>
        <button onClick={() => window.location.href = "/register"}>Register</button>
    </div>
  );
}
