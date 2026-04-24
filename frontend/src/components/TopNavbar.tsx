import { NavLink, useNavigate } from "react-router-dom";

interface TopNavbarProps {
  isAuthenticated: boolean;
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          isActive ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
        }`
      }
      end={to === "/dashboard" || to === "/"}
    >
      {label}
    </NavLink>
  );
}

export default function TopNavbar({ isAuthenticated }: TopNavbarProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    navigate("/login", { replace: true });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold tracking-wide text-white">
            CoreMD
          </span>
          <span className="hidden text-sm text-slate-500 sm:inline">Clinical Learning Platform</span>
        </div>

        <nav className="flex items-center gap-1">
          {isAuthenticated ? (
            <>
              <NavItem to="/dashboard" label="Dashboard" />
              <NavItem to="/chapters" label="Chapters" />
              <NavItem to="/questions" label="Question Bank" />
              <NavItem to="/cases" label="Cases" />
              <NavItem to="/chat" label="Chat" />
              <button
                onClick={handleLogout}
                className="ml-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavItem to="/" label="Home" />
              <NavItem to="/login" label="Login" />
              <NavItem to="/register" label="Register" />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
