import { Link } from "react-router-dom";

export default function Home() {
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-600">CoreMD</p>
      <h1 className="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">
        Study medicine with structured chapters, cases, and AI support
      </h1>
      <p className="mb-8 text-slate-600">
        Sign in to track progress, navigate chapters faster, and ask clinical questions grounded in Harrison&apos;s.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/login"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Login
        </Link>
        <Link
          to="/register"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Register
        </Link>
      </div>
    </section>
  );
}
