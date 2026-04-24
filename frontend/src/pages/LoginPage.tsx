import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";
import { login } from "../api/authApi";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await login({ email, password });
      localStorage.setItem("access_token", response.data.access_token);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const detail = axiosErr.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : `Error ${axiosErr.response?.status ?? "unknown"}: login failed`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
        <div className="hidden bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 p-10 text-white lg:block">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-100">Welcome Back</p>
          <h1 className="mb-4 text-4xl font-bold leading-tight">Continue your CoreMD progress</h1>
          <p className="text-blue-100">
            Jump back into chapters, cases, and personalized learning insights.
          </p>
        </div>

        <div className="p-6 sm:p-10">
          <h2 className="mb-2 text-2xl font-bold text-slate-900">Login</h2>
          <p className="mb-6 text-sm text-slate-600">
            New to CoreMD?{" "}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
              Create an account
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
