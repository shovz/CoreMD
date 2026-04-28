import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAiContext } from "../context/AiContext";
import { useAuthContext } from "../context/AuthContext";

function DashboardIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function ChaptersIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function QuestionsIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CasesIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function BookmarksIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: <DashboardIcon />, end: true },
  { to: "/chapters", label: "Chapters", icon: <ChaptersIcon />, end: false },
  { to: "/questions", label: "Question Bank", icon: <QuestionsIcon />, end: false },
  { to: "/cases", label: "Cases", icon: <CasesIcon />, end: false },
  { to: "/history", label: "History", icon: <HistoryIcon />, end: false },
  { to: "/bookmarks", label: "Bookmarks", icon: <BookmarksIcon />, end: false },
  { to: "/notes", label: "Notes", icon: <NotesIcon />, end: false },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { setOpen } = useAiContext();
  const { user, logout } = useAuthContext();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleSignOut = () => {
    logout();
    navigate("/login", { replace: true });
    onNavigate?.();
  };

  const fullName = user?.full_name ?? "";
  const lastName = fullName ? fullName.split(" ").pop()! : "";
  const badgeText = fullName
    ? "DR"
    : (user?.email?.charAt(0).toUpperCase() ?? "?");

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6">
        <span className="text-lg font-bold text-[var(--ink)]">
          CoreMD<span className="text-[var(--accent)]">.</span>
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-[var(--ink-dim)] hover:bg-[var(--ink-4)] hover:text-[var(--ink)]"
              }`
            }
          >
            {icon}
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 px-3 pb-6">
        {/* Profile widget */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition hover:bg-[var(--ink-4)]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {badgeText}
            </span>
            <div className="min-w-0 flex-1 text-left">
              {lastName && (
                <div className="truncate font-medium text-[var(--ink)]">
                  {lastName}
                </div>
              )}
              <div className="text-xs text-[var(--ink-dim)]">Resident</div>
            </div>
          </button>
          {profileOpen && (
            <div
              className="absolute bottom-full left-0 right-0 mb-1 rounded-md border bg-[var(--paper-2)] py-1 shadow-md"
              style={{ borderColor: "var(--ink-4)" }}
            >
              <button
                onClick={handleSignOut}
                className="w-full px-3 py-2 text-left text-sm text-[var(--ink-dim)] transition hover:bg-[var(--ink-4)] hover:text-[var(--ink)]"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setOpen(true);
            onNavigate?.();
          }}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Ask AI
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-[220px] shrink-0 flex-col bg-[var(--paper-2)] h-screen sticky top-0 border-r"
        style={{ borderRightColor: "var(--ink-4)" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile: hamburger */}
      <button
        className="fixed left-4 top-4 z-30 md:hidden rounded-md p-2 text-[var(--ink)] bg-[var(--paper-2)] border"
        style={{ borderColor: "var(--ink-4)" }}
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        ☰
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-[220px] bg-[var(--paper-2)] border-r"
            style={{ borderRightColor: "var(--ink-4)" }}
          >
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}
